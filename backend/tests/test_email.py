"""Order notification email: content, routing, toggles and failure isolation."""

from datetime import time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.authentication.models import Role, User
from apps.hotels.models import Hotel
from apps.menu.models import FoodItem

API = "/api/v1"


class OrderEmailTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="kitchen@test.dev", password="Owner1234", name="Kitchen Owner", role=Role.DISTRIBUTOR
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
            delivery_radius_km=50,
        )
        self.samosa = FoodItem.objects.create(
            hotel=self.hotel, name="Samosa Platter", price=Decimal("10.00"), category="Starters"
        )
        self.lassi = FoodItem.objects.create(
            hotel=self.hotel, name="Mango Lassi", price=Decimal("4.00"), category="Drinks"
        )
        self.buyer = User.objects.create_user(
            email="buyer@test.dev",
            password="Buyer1234",
            name="Priya Sharma",
            phone_number="+919812345678",
        )

    def auth(self) -> dict:
        response = self.client.post(
            f"{API}/auth/login/",
            {"email": "buyer@test.dev", "password": "Buyer1234"},
            content_type="application/json",
        )
        return {"HTTP_AUTHORIZATION": f"Bearer {response.json()['access']}"}

    def place(self, **overrides):
        """Place an order, running on_commit hooks so the mail actually dispatches."""
        payload = {
            "hotel_id": self.hotel.id,
            "items": [
                {"food_item_id": self.samosa.id, "quantity": 2},
                {"food_item_id": self.lassi.id, "quantity": 1},
            ],
            "delivery_date": (timezone.localdate() + timedelta(days=1)).isoformat(),
            "delivery_time_slot": "13:00-13:30",
            "delivery_type": "delivery",
            "address": "42 Buyer Lane, Apt 9",
            "latitude": 19.01,
            "longitude": 72.01,
            "special_instructions": "No chilli please",
        }
        payload.update(overrides)
        headers = self.auth()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"{API}/orders/create/", payload, content_type="application/json", **headers
            )
        return response

    # --- delivery ---------------------------------------------------------

    def test_placing_an_order_sends_two_emails(self):
        response = self.place()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(mail.outbox), 2)

    def test_distributor_email_carries_the_food_list_and_customer_details(self):
        order_id = self.place().json()["order_id"]
        message = next(m for m in mail.outbox if m.to == ["kitchen@test.dev"])

        self.assertIn(f"New order #{order_id}", message.subject)
        self.assertEqual(message.reply_to, ["buyer@test.dev"])

        body = message.body
        # food list
        self.assertIn("2 x Samosa Platter", body)
        self.assertIn("1 x Mango Lassi", body)
        # customer details
        self.assertIn("Priya Sharma", body)
        self.assertIn("+919812345678", body)
        self.assertIn("buyer@test.dev", body)
        self.assertIn("42 Buyer Lane, Apt 9", body)
        # money and schedule
        self.assertIn("13:00-13:30", body)
        self.assertIn("$24.00", body)          # subtotal 24.00
        self.assertIn("No chilli please", body)

    def test_distributor_email_has_an_html_alternative_with_the_same_facts(self):
        self.place()
        message = next(m for m in mail.outbox if m.to == ["kitchen@test.dev"])
        self.assertEqual(len(message.alternatives), 1)
        html, mimetype = message.alternatives[0]
        self.assertEqual(mimetype, "text/html")
        self.assertIn("Samosa Platter", html)
        self.assertIn("Priya Sharma", html)
        self.assertIn("<table", html)

    def test_plain_text_urls_are_not_html_escaped(self):
        self.place()
        for message in mail.outbox:
            self.assertNotIn("&amp;", message.body)

    def test_customer_email_confirms_the_order(self):
        order_id = self.place().json()["order_id"]
        message = next(m for m in mail.outbox if m.to == ["buyer@test.dev"])

        self.assertIn(f"Order #{order_id} confirmed", message.subject)
        self.assertEqual(message.reply_to, ["kitchen@test.dev"])
        self.assertIn("Samosa Platter", message.body)
        self.assertIn(f"/orders/track/{order_id}", message.body)
        self.assertIn("offline", message.body.lower())

    # --- pickup -----------------------------------------------------------

    def test_pickup_order_says_pickup_and_omits_an_address(self):
        self.place(delivery_type="pickup", address="", latitude=None, longitude=None)
        message = next(m for m in mail.outbox if m.to == ["kitchen@test.dev"])
        self.assertIn("Self-pickup", message.body)
        self.assertIn("collects at the counter", message.body)
        self.assertNotIn("42 Buyer Lane", message.body)

    # --- toggles ----------------------------------------------------------

    @override_settings(ORDER_EMAILS_ENABLED=False)
    def test_master_switch_disables_all_order_email(self):
        self.place()
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(ORDER_EMAIL_TO_CUSTOMER=False)
    def test_customer_confirmation_can_be_turned_off_independently(self):
        self.place()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["kitchen@test.dev"])

    @override_settings(ORDER_EMAIL_TO_DISTRIBUTOR=False)
    def test_distributor_ticket_can_be_turned_off_independently(self):
        self.place()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["buyer@test.dev"])

    # --- failure isolation -------------------------------------------------

    def test_a_broken_mail_server_never_fails_the_order(self):
        from apps.orders.models import Order

        with patch(
            "django.core.mail.EmailMultiAlternatives.send",
            side_effect=OSError("smtp is down"),
        ):
            response = self.place()

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(Order.objects.filter(pk=response.json()["order_id"]).exists())

    def test_a_missing_recipient_is_skipped_rather_than_crashing(self):
        self.owner.email = ""
        self.owner.save(update_fields=["email"])
        response = self.place()
        self.assertEqual(response.status_code, 200)
        self.assertEqual([m.to for m in mail.outbox], [["buyer@test.dev"]])

    def test_email_is_not_sent_when_the_order_is_rejected(self):
        # radius guard rejects this one, so no order and therefore no mail
        self.hotel.delivery_radius_km = 1
        self.hotel.save(update_fields=["delivery_radius_km"])
        response = self.place(latitude=28.6, longitude=77.2)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(len(mail.outbox), 0)
