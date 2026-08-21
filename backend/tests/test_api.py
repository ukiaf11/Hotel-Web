"""Integration tests for the public, customer, distributor and admin API surfaces."""

from datetime import date, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.authentication.models import Role, User
from apps.console.models import SiteConfig
from apps.hotels.models import Hotel
from apps.menu.models import FoodItem
from apps.orders.models import Order
from apps.support.models import FAQ

API = "/api/v1"


class BaseAPITest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@test.dev", password="Owner1234", name="Owner", role=Role.DISTRIBUTOR
        )
        self.hotel = Hotel.objects.create(
            owner=self.owner,
            name="Test Kitchen",
            place="1 Test Street",
            contact_number="+911234567890",
            latitude=19.0,
            longitude=72.0,
            opening_time=time(0, 0),
            closing_time=time(23, 30),
            is_verified=True,
            is_online=True,
            has_delivery=True,
            flat_delivery_fee=Decimal("2.00"),
            min_order_amount=Decimal("5.00"),
            delivery_radius_km=10,
        )
        self.instant = FoodItem.objects.create(
            hotel=self.hotel, name="Instant Dish", price=Decimal("10.00"), category="Mains"
        )
        self.custom = FoodItem.objects.create(
            hotel=self.hotel,
            name="Slow Roast",
            price=Decimal("30.00"),
            category="Mains",
            is_custom_order=True,
            preparation_time_hours=4,
        )
        self.customer = User.objects.create_user(
            email="buyer@test.dev", password="Buyer1234", name="Buyer", phone_number="+919000000000"
        )

    def auth(self, email: str, password: str) -> dict:
        response = self.client.post(
            f"{API}/auth/login/",
            {"email": email, "password": password},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        return {"HTTP_AUTHORIZATION": f"Bearer {response.json()['access']}"}

    def tomorrow(self) -> str:
        return (timezone.localdate() + timedelta(days=1)).isoformat()


class PublicFeedTests(BaseAPITest):
    def test_only_verified_hotels_are_listed(self):
        hidden_owner = User.objects.create_user(email="h@test.dev", password="Hidden1234", name="H")
        Hotel.objects.create(owner=hidden_owner, name="Unverified Kitchen", is_verified=False)

        response = self.client.get(f"{API}/hotels/")
        names = [row["name"] for row in response.json()]
        self.assertIn("Test Kitchen", names)
        self.assertNotIn("Unverified Kitchen", names)

    def test_search_matches_menu_items(self):
        response = self.client.get(f"{API}/hotels/?search=Slow Roast")
        self.assertEqual(len(response.json()), 1)

    def test_menu_hides_unavailable_items(self):
        self.instant.is_available = False
        self.instant.save()
        payload = self.client.get(f"{API}/hotels/{self.hotel.id}/menu/").json()
        self.assertEqual([item["name"] for item in payload["items"]], ["Slow Roast"])

    def test_slots_are_half_hourly(self):
        payload = self.client.get(
            f"{API}/hotels/{self.hotel.id}/delivery-slots/?date={self.tomorrow()}"
        ).json()
        slots = payload["booked_slots_capacity"]
        self.assertEqual(slots[0]["slot"], "00:00-00:30")
        self.assertEqual(slots[1]["slot"], "00:30-01:00")

    def test_health_endpoint(self):
        self.assertEqual(self.client.get(f"{API}/health/").json()["status"], "ok")


class AuthTests(BaseAPITest):
    def test_registration_rejects_weak_password(self):
        response = self.client.post(
            f"{API}/auth/register/",
            {"name": "Weak", "email": "weak@test.dev", "password": "weak", "role": "customer"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 422)

    def test_distributor_registration_creates_unverified_hotel(self):
        response = self.client.post(
            f"{API}/auth/register/",
            {
                "name": "New Owner",
                "email": "new@test.dev",
                "phone": "+919812345678",
                "password": "Str0ngPass",
                "role": "distributor",
                "hotel_name": "New Kitchen",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        hotel = Hotel.objects.get(name="New Kitchen")
        self.assertFalse(hotel.is_verified)
        self.assertFalse(hotel.is_online)

    def test_duplicate_email_is_rejected(self):
        response = self.client.post(
            f"{API}/auth/register/",
            {"name": "Dup", "email": "buyer@test.dev", "password": "Str0ngPass", "role": "customer"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)

    def test_protected_endpoint_requires_a_token(self):
        self.assertEqual(self.client.get(f"{API}/auth/me/").status_code, 401)


class OrderFlowTests(BaseAPITest):
    def place(self, headers, **overrides):
        payload = {
            "hotel_id": self.hotel.id,
            "items": [{"food_item_id": self.instant.id, "quantity": 2}],
            "delivery_date": self.tomorrow(),
            "delivery_time_slot": "13:00-13:30",
            "delivery_type": "pickup",
        }
        payload.update(overrides)
        return self.client.post(
            f"{API}/orders/create/", payload, content_type="application/json", **headers
        )

    def test_totals_include_fee_and_tax(self):
        headers = self.auth("buyer@test.dev", "Buyer1234")
        response = self.place(
            headers, delivery_type="delivery", address="1 Buyer Road", latitude=19.01, longitude=72.01
        )
        self.assertEqual(response.status_code, 200, response.content)
        order = Order.objects.get(pk=response.json()["order_id"])
        self.assertEqual(order.subtotal, Decimal("20.00"))
        self.assertEqual(order.delivery_fee, Decimal("2.00"))
        self.assertEqual(order.tax_amount, Decimal("1.00"))
        self.assertEqual(order.total_amount, Decimal("23.00"))

    def test_delivery_is_blocked_when_hotel_has_it_disabled(self):
        self.hotel.has_delivery = False
        self.hotel.save()
        headers = self.auth("buyer@test.dev", "Buyer1234")
        response = self.place(headers, delivery_type="delivery", address="1 Buyer Road")
        self.assertEqual(response.status_code, 409)

    def test_outside_delivery_radius_is_rejected(self):
        headers = self.auth("buyer@test.dev", "Buyer1234")
        response = self.place(
            headers, delivery_type="delivery", address="Far away", latitude=28.6, longitude=77.2
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("delivery boundary", response.json()["detail"])

    def test_lead_time_blocks_a_slot_that_is_too_soon(self):
        headers = self.auth("buyer@test.dev", "Buyer1234")
        response = self.place(
            headers,
            items=[{"food_item_id": self.custom.id, "quantity": 1}],
            delivery_date=timezone.localdate().isoformat(),
            delivery_time_slot="00:00-00:30",
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("preparation lead time", response.json()["detail"])

    def test_scheduling_beyond_the_horizon_is_rejected(self):
        headers = self.auth("buyer@test.dev", "Buyer1234")
        far = (timezone.localdate() + timedelta(days=20)).isoformat()
        self.assertEqual(self.place(headers, delivery_date=far).status_code, 400)

    def test_minimum_order_amount_is_enforced(self):
        self.hotel.min_order_amount = Decimal("100.00")
        self.hotel.save()
        headers = self.auth("buyer@test.dev", "Buyer1234")
        response = self.place(
            headers, delivery_type="delivery", address="1 Buyer Road", latitude=19.01, longitude=72.01
        )
        self.assertEqual(response.status_code, 409)

    def test_cancellation_window_closes_once_accepted(self):
        buyer = self.auth("buyer@test.dev", "Buyer1234")
        owner = self.auth("owner@test.dev", "Owner1234")
        order_id = self.place(buyer).json()["order_id"]

        self.client.post(
            f"{API}/distributor/orders/{order_id}/update-status/",
            {"status": "accepted"},
            content_type="application/json",
            **owner,
        )
        response = self.client.post(f"{API}/orders/{order_id}/cancel/", **buyer)
        self.assertEqual(response.status_code, 409)

    def test_illegal_status_transition_is_rejected(self):
        buyer = self.auth("buyer@test.dev", "Buyer1234")
        owner = self.auth("owner@test.dev", "Owner1234")
        order_id = self.place(buyer).json()["order_id"]

        response = self.client.post(
            f"{API}/distributor/orders/{order_id}/update-status/",
            {"status": "completed"},
            content_type="application/json",
            **owner,
        )
        self.assertEqual(response.status_code, 409)

    def test_invoice_is_a_pdf(self):
        buyer = self.auth("buyer@test.dev", "Buyer1234")
        order_id = self.place(buyer).json()["order_id"]
        response = self.client.get(f"{API}/orders/{order_id}/invoice/", **buyer)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_review_requires_a_completed_order(self):
        buyer = self.auth("buyer@test.dev", "Buyer1234")
        order_id = self.place(buyer).json()["order_id"]
        early = self.client.post(
            f"{API}/orders/{order_id}/review/",
            {"rating": 5},
            content_type="application/json",
            **buyer,
        )
        self.assertEqual(early.status_code, 409)

        Order.objects.filter(pk=order_id).update(status=Order.Status.COMPLETED)
        accepted = self.client.post(
            f"{API}/orders/{order_id}/review/",
            {"rating": 5, "comment": "Great"},
            content_type="application/json",
            **buyer,
        )
        self.assertEqual(accepted.status_code, 200)
        self.hotel.refresh_from_db()
        self.assertEqual(self.hotel.rating_count, 1)

    def test_maintenance_mode_blocks_new_orders(self):
        config = SiteConfig.load()
        config.maintenance_mode = True
        config.save()
        buyer = self.auth("buyer@test.dev", "Buyer1234")
        self.assertEqual(self.place(buyer).status_code, 503)

        config.maintenance_mode = False
        config.save()
        self.assertEqual(self.place(buyer).status_code, 200)


class RolePermissionTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.cook = User.objects.create_user(
            email="cook@test.dev", password="Cook12345", name="Cook", role=Role.COOK, hotel=self.hotel
        )
        self.courier = User.objects.create_user(
            email="courier@test.dev",
            password="Courier1234",
            name="Courier",
            role=Role.COURIER,
            hotel=self.hotel,
        )
        self.admin = User.objects.create_user(
            email="admin@test.dev", password="Admin1234", name="Admin", role=Role.ADMIN
        )

    def test_cook_cannot_read_sales_reports(self):
        headers = self.auth("cook@test.dev", "Cook12345")
        response = self.client.get(f"{API}/distributor/orders/reports/sales/", **headers)
        self.assertEqual(response.status_code, 403)

    def test_cook_can_read_the_queue(self):
        headers = self.auth("cook@test.dev", "Cook12345")
        self.assertEqual(self.client.get(f"{API}/distributor/orders/", **headers).status_code, 200)

    def test_courier_cannot_accept_orders(self):
        buyer = self.auth("buyer@test.dev", "Buyer1234")
        order_id = self.client.post(
            f"{API}/orders/create/",
            {
                "hotel_id": self.hotel.id,
                "items": [{"food_item_id": self.instant.id, "quantity": 1}],
                "delivery_date": self.tomorrow(),
                "delivery_time_slot": "13:00-13:30",
                "delivery_type": "pickup",
            },
            content_type="application/json",
            **buyer,
        ).json()["order_id"]

        headers = self.auth("courier@test.dev", "Courier1234")
        response = self.client.post(
            f"{API}/distributor/orders/{order_id}/update-status/",
            {"status": "accepted"},
            content_type="application/json",
            **headers,
        )
        self.assertEqual(response.status_code, 403)

    def test_customer_cannot_reach_the_admin_console(self):
        headers = self.auth("buyer@test.dev", "Buyer1234")
        self.assertEqual(self.client.get(f"{API}/admin/stats/", **headers).status_code, 403)

    def test_admin_can_verify_a_hotel(self):
        pending_owner = User.objects.create_user(
            email="pending@test.dev", password="Pending1234", name="Pending", role=Role.DISTRIBUTOR
        )
        pending = Hotel.objects.create(owner=pending_owner, name="Pending Kitchen", is_verified=False)

        headers = self.auth("admin@test.dev", "Admin1234")
        response = self.client.post(
            f"{API}/admin/hotels/{pending.id}/verify/",
            {"approved": True},
            content_type="application/json",
            **headers,
        )
        self.assertEqual(response.status_code, 200)
        pending.refresh_from_db()
        self.assertTrue(pending.is_verified)


class MenuManagementTests(BaseAPITest):
    def test_zero_price_is_rejected(self):
        headers = self.auth("owner@test.dev", "Owner1234")
        response = self.client.post(
            f"{API}/distributor/menu/items/",
            {"name": "Free lunch", "price": 0},
            content_type="application/json",
            **headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_stock_toggle_flips_availability(self):
        headers = self.auth("owner@test.dev", "Owner1234")
        response = self.client.put(
            f"{API}/distributor/menu/items/{self.instant.id}/toggle-stock/", **headers
        )
        self.assertFalse(response.json()["is_available"])

    def test_delivery_settings_round_trip(self):
        headers = self.auth("owner@test.dev", "Owner1234")
        response = self.client.put(
            f"{API}/distributor/delivery-settings/update/",
            {
                "has_delivery": False,
                "min_order_amount": 12,
                "flat_delivery_fee": 4,
                "delivery_radius_km": 7,
                "avg_delivery_minutes": 20,
                "active_slots": {"morning": True, "afternoon": False, "evening": True},
            },
            content_type="application/json",
            **headers,
        )
        self.assertEqual(response.status_code, 200)
        self.hotel.refresh_from_db()
        self.assertFalse(self.hotel.has_delivery)
        self.assertFalse(self.hotel.slot_afternoon)

    def test_online_toggle(self):
        headers = self.auth("owner@test.dev", "Owner1234")
        first = self.client.post(f"{API}/distributor/status/toggle/", **headers).json()
        self.assertFalse(first["is_online"])
        second = self.client.post(f"{API}/distributor/status/toggle/", **headers).json()
        self.assertTrue(second["is_online"])


class ReportingTests(BaseAPITest):
    def test_report_aggregates_completed_orders(self):
        order = Order.objects.create(
            buyer=self.customer,
            hotel=self.hotel,
            scheduled_date=date.today(),
            scheduled_slot="13:00-13:30",
            status=Order.Status.COMPLETED,
            delivery_type=Order.DeliveryType.PICKUP,
            subtotal=Decimal("20.00"),
            total_amount=Decimal("21.00"),
            completed_at=timezone.now(),
        )
        order.items.create(
            food_item=self.instant, name=self.instant.name, quantity=2, price_at_purchase=Decimal("10.00")
        )

        headers = self.auth("owner@test.dev", "Owner1234")
        payload = self.client.get(f"{API}/distributor/orders/reports/sales/", **headers).json()
        self.assertEqual(payload["total_orders"], 1)
        self.assertEqual(payload["top_items"][0]["qty_sold"], 2)

    def test_csv_export(self):
        headers = self.auth("owner@test.dev", "Owner1234")
        response = self.client.get(
            f"{API}/distributor/orders/reports/export/?format=csv", **headers
        )
        self.assertEqual(response["Content-Type"], "text/csv")


class SupportTests(BaseAPITest):
    def test_ticket_lifecycle(self):
        FAQ.objects.create(question="How does pickup work?", answer="Collect at the counter.")
        self.assertEqual(len(self.client.get(f"{API}/support/faqs/").json()), 1)

        buyer = self.auth("buyer@test.dev", "Buyer1234")
        created = self.client.post(
            f"{API}/support/tickets/create/",
            {"subject": "Late", "message": "It was late"},
            content_type="application/json",
            **buyer,
        )
        self.assertEqual(created.status_code, 200)

        admin = User.objects.create_user(
            email="a@test.dev", password="Admin1234", name="A", role=Role.ADMIN
        )
        self.assertTrue(admin.pk)
        admin_headers = self.auth("a@test.dev", "Admin1234")
        ticket_id = created.json()["id"]
        replied = self.client.post(
            f"{API}/admin/tickets/{ticket_id}/reply/",
            {"message": "Looking into it", "close": True},
            content_type="application/json",
            **admin_headers,
        )
        self.assertEqual(replied.status_code, 200)

        tickets = self.client.get(f"{API}/support/tickets/", **buyer).json()
        self.assertEqual(tickets[0]["status"], "resolved")
        self.assertEqual(len(tickets[0]["responses"]), 1)


class NotificationTests(BaseAPITest):
    def test_order_creation_notifies_both_parties(self):
        buyer = self.auth("buyer@test.dev", "Buyer1234")
        self.client.post(
            f"{API}/orders/create/",
            {
                "hotel_id": self.hotel.id,
                "items": [{"food_item_id": self.instant.id, "quantity": 1}],
                "delivery_date": self.tomorrow(),
                "delivery_time_slot": "13:00-13:30",
                "delivery_type": "pickup",
            },
            content_type="application/json",
            **buyer,
        )
        self.assertEqual(self.customer.notifications.count(), 1)
        self.assertEqual(self.owner.notifications.count(), 1)

        notifications = self.client.get(f"{API}/notifications/", **buyer).json()
        self.assertFalse(notifications[0]["is_read"])

        self.client.post(
            f"{API}/notifications/mark-read/",
            {"notification_ids": []},
            content_type="application/json",
            **buyer,
        )
        self.assertEqual(self.customer.notifications.filter(is_read=False).count(), 0)
