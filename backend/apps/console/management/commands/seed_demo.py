"""Populate the database with a realistic demo dataset.

    uv run python manage.py seed_demo [--reset]
"""

import random
from datetime import time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.authentication.models import Address, Role, User
from apps.console.models import SiteConfig
from apps.hotels.models import Hotel
from apps.menu.models import FoodItem, MenuCategory
from apps.notifications.services import notify
from apps.orders.models import Order, OrderItem, Review
from apps.orders.services import price_order
from apps.support.models import FAQ, SupportTicket, TicketMessage

UNSPLASH = "https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=900&q=70"

HOTELS = [
    {
        "email": "royal@hotelexpress.dev",
        "owner": "Aarav Menon",
        "name": "Royal Palace Kitchen",
        "place": "12 Marine Drive, Downtown",
        "cuisine": "North Indian • Mughlai",
        "phone": "+919812340001",
        "banner": "1517248135467-4c7edcad34c4",
        "lat": 19.0760,
        "lng": 72.8777,
        "delivery": True,
        "fee": 2.50,
        "min_order": 12,
        "radius": 12,
        "avg_minutes": 28,
        "open": time(9, 0),
        "close": time(23, 0),
        "rating": 4.7,
        "rating_count": 218,
        "menu": [
            ("Spicy Paneer Tikka", "Cottage cheese cubes marinated in yoghurt and tandoori spice.", 12.50, "Starters", True, True, 1.0, "1567188040759-fb8a883dc6d8"),
            ("Tandoori Chicken Half", "Charcoal-grilled, 24-hour marinated chicken.", 14.00, "Starters", False, False, 0, "1610057099443-fde8c4d50f91"),
            ("Butter Chicken", "Slow-simmered tomato and cashew gravy.", 16.50, "Main Course", False, False, 0, "1588166524941-3bf61a9c41db"),
            ("Dal Makhani", "Black lentils finished with cream overnight.", 11.00, "Main Course", False, True, 0, "1546833999-b9f581a1996d"),
            ("Garlic Naan", "Tandoor bread brushed with garlic butter.", 3.50, "Breads", False, True, 0, "1601050690597-df0568f70950"),
            ("Royal Biryani Platter", "Whole-pot dum biryani for four, made to order.", 42.00, "Main Course", True, False, 3.0, "1563379091339-03b21ab4a4f8"),
            ("Gulab Jamun", "Warm milk dumplings in cardamom syrup.", 5.00, "Desserts", False, True, 0, "1666190092159-3171cf0fbb12"),
            ("Masala Chai", "Brewed with fresh ginger and lemongrass.", 2.50, "Drinks", False, True, 0, "1571934811356-5cc061b6821f"),
        ],
    },
    {
        "email": "greenvalley@hotelexpress.dev",
        "owner": "Nisha Kapoor",
        "name": "Green Valley Dine",
        "place": "88 West Side Avenue",
        "cuisine": "Vegan • Health bowls",
        "phone": "+919812340002",
        "banner": "1467003909585-2f8a72700288",
        "lat": 19.1136,
        "lng": 72.8697,
        "delivery": True,
        "fee": 0,
        "min_order": 18,
        "radius": 8,
        "avg_minutes": 25,
        "open": time(8, 0),
        "close": time(21, 0),
        "rating": 4.5,
        "rating_count": 143,
        "menu": [
            ("Buddha Power Bowl", "Quinoa, roasted chickpeas, avocado and tahini.", 13.00, "Bowls", False, True, 0, "1512621776951-a57141f2eefd"),
            ("Avocado Sourdough", "Smashed avocado, chilli flakes, micro greens.", 9.50, "Breakfast", False, True, 0, "1541519227354-08fa5d50c44d"),
            ("Cold Pressed Greens", "Kale, cucumber, green apple and ginger.", 6.00, "Drinks", False, True, 0, "1610970881699-44a5587cabec"),
            ("Vegan Lasagna Tray", "Cashew béchamel, roasted vegetables — baked fresh.", 28.00, "Main Course", True, True, 2.0, "1574894709920-11b28e7367e3"),
            ("Berry Chia Parfait", "Overnight chia, coconut yoghurt, seasonal berries.", 7.00, "Desserts", False, True, 0, "1488477181946-6428a0291777"),
            ("Roasted Pumpkin Soup", "Coconut cream and toasted seeds.", 8.00, "Starters", False, True, 0, "1547592166-23ac45744acd"),
        ],
    },
    {
        "email": "ocean@hotelexpress.dev",
        "owner": "Rahul Dsouza",
        "name": "Ocean Breeze Inn",
        "place": "Coastal Road, Lighthouse Point",
        "cuisine": "Seafood • Coastal",
        "phone": "+919812340003",
        "banner": "1514933651103-005eec06c04b",
        "lat": 18.9220,
        "lng": 72.8347,
        "delivery": False,
        "fee": 0,
        "min_order": 0,
        "radius": 0,
        "avg_minutes": 40,
        "open": time(11, 0),
        "close": time(23, 30),
        "rating": 4.8,
        "rating_count": 302,
        "menu": [
            ("Garlic Butter Prawns", "Tiger prawns seared in garlic butter.", 18.00, "Starters", False, False, 0, "1559737558-2f5a35f4523b"),
            ("Grilled Catch of the Day", "Whole fish, charred lemon, herb oil.", 24.00, "Main Course", False, False, 0, "1519708227418-c8fd9a32b7a2"),
            ("Coastal Fish Curry", "Coconut, kokum and curry leaf.", 17.50, "Main Course", False, False, 0, "1455619452474-d2be8b1e70cd"),
            ("Crab Feast Platter", "Whole mud crab, needs 4 hours notice.", 55.00, "Main Course", True, False, 4.0, "1550966871-3ed3cdb5ed0c"),
            ("Mojito", "Fresh mint, lime and cane sugar.", 6.50, "Drinks", False, True, 0, "1551538827-9c037cb4f32a"),
            ("Lemon Butter Calamari", "Crisp rings with aioli.", 12.00, "Starters", False, False, 0, "1604909052743-94e838986d24"),
        ],
    },
    {
        "email": "sunrise@hotelexpress.dev",
        "owner": "Meera Iyer",
        "name": "Sunrise Tiffin House",
        "place": "45 Temple Street, Old Town",
        "cuisine": "South Indian • Breakfast",
        "phone": "+919812340004",
        "banner": "1630383249896-424e482df921",
        "lat": 19.0176,
        "lng": 72.8562,
        "delivery": True,
        "fee": 1.50,
        "min_order": 8,
        "radius": 6,
        "avg_minutes": 22,
        "open": time(6, 30),
        "close": time(15, 0),
        "rating": 4.4,
        "rating_count": 96,
        "menu": [
            ("Ghee Podi Dosa", "Crisp dosa with house gunpowder.", 6.00, "Breakfast", False, True, 0, "1630383249896-424e482df921"),
            ("Idli Sambar (4 pc)", "Steamed rice cakes, lentil stew.", 4.50, "Breakfast", False, True, 0, "1589301760014-d929f3979dbc"),
            ("Filter Coffee", "Chicory blend, brewed to order.", 2.00, "Drinks", False, True, 0, "1509042239860-f550ce710b93"),
            ("Festive Sweet Box", "Assorted sweets, prepared on order.", 22.00, "Desserts", True, True, 6.0, "1666190092159-3171cf0fbb12"),
            ("Medu Vada (3 pc)", "Crisp lentil doughnuts with chutney.", 4.00, "Breakfast", False, True, 0, "1610192244261-3f33de3f55e4"),
        ],
    },
    {
        "email": "urbanwok@hotelexpress.dev",
        "owner": "Kenji Rao",
        "name": "Urban Wok",
        "place": "Tech Park Boulevard, Sector 21",
        "cuisine": "Pan-Asian • Noodles",
        "phone": "+919812340005",
        "banner": "1552611052-33e04de081de",
        "lat": 19.0500,
        "lng": 72.9000,
        "delivery": True,
        "fee": 3.00,
        "min_order": 15,
        "radius": 15,
        "avg_minutes": 32,
        "open": time(11, 0),
        "close": time(22, 30),
        "rating": 4.2,
        "rating_count": 74,
        "menu": [
            ("Chilli Garlic Ramen", "Slow-braised broth, chilli oil, soft egg.", 13.50, "Main Course", False, False, 0, "1591814468924-caf88d1232e1"),
            ("Crispy Chilli Tofu", "Wok-tossed with peppers and sesame.", 10.00, "Starters", False, True, 0, "1546069901-ba9599a7e63c"),
            ("Bao Trio", "Steamed buns, three fillings.", 11.00, "Starters", False, False, 0, "1563245372-f21724e3856d"),
            ("Wok Party Box", "Family-size noodle and dumpling spread.", 38.00, "Main Course", True, False, 2.5, "1552611052-33e04de081de"),
            ("Matcha Cheesecake", "Baked, with black sesame crumb.", 7.50, "Desserts", False, True, 0, "1533134242443-d4fd215305ad"),
        ],
    },
    {
        "email": "casaverde@hotelexpress.dev",
        "owner": "Lucia Fernandes",
        "name": "Casa Verde Trattoria",
        "place": "7 Garden Lane, Hill Quarter",
        "cuisine": "Italian • Wood-fired",
        "phone": "+919812340006",
        "banner": "1555396273-367ea4eb4db5",
        "lat": 19.0330,
        "lng": 72.8400,
        "delivery": True,
        "fee": 2.00,
        "min_order": 20,
        "radius": 10,
        "avg_minutes": 35,
        "open": time(12, 0),
        "close": time(23, 0),
        "rating": 4.6,
        "rating_count": 187,
        "menu": [
            ("Margherita Napoletana", "San Marzano, fior di latte, basil.", 12.00, "Pizza", False, True, 0, "1574071318508-1cdbab80d002"),
            ("Truffle Mushroom Pizza", "Wild mushrooms, truffle cream.", 17.00, "Pizza", False, True, 0, "1513104890138-7c749659a591"),
            ("Handmade Tagliatelle", "Slow ragù, 6-hour braise.", 15.50, "Pasta", False, False, 0, "1621996346565-e3dbc646d9a9"),
            ("Tiramisu", "Mascarpone, espresso, cocoa.", 8.00, "Desserts", False, True, 0, "1571877227200-a0d98ea607e9"),
            ("Celebration Cake", "Custom sponge, decorated to order.", 45.00, "Desserts", True, True, 24.0, "1578985545062-69928b1d9587"),
        ],
    },
]

CUSTOMERS = [
    ("jane@hotelexpress.dev", "Jane Doe", "+919800000001", "221B Maple Residency, Downtown", 19.0730, 72.8790),
    ("arjun@hotelexpress.dev", "Arjun Patel", "+919800000002", "5 Skyline Towers, West Side", 19.1100, 72.8700),
    ("sara@hotelexpress.dev", "Sara Khan", "+919800000003", "18 Palm Grove, Hill Quarter", 19.0350, 72.8420),
]

FAQS = [
    ("How does self-pickup work?", "Choose “Self-Pickup” at checkout, pick a time slot, and collect your order at the hotel counter at the scheduled time. You pay at the counter when you collect.", "Orders"),
    ("What payment methods do you support?", "Currently we only support offline cash payments — Cash on Delivery or Pay at Hotel. Online card and UPI payments will be added in a future phase.", "Payments"),
    ("Why can't I pick an earlier time slot?", "Some dishes are marked “On-Order” and need advance preparation. The scheduler disables any slot earlier than the longest preparation lead time in your cart.", "Scheduling"),
    ("Can I cancel my order?", "Yes — while the order is still in the “Placed” stage. Once the hotel accepts it and preparation begins, cancellation is disabled and you should call the hotel directly.", "Orders"),
    ("Why is home delivery unavailable for a hotel?", "Each hotel decides whether it offers home delivery. When it is switched off, only self-pickup is offered, and the hotel details page shows an amber notice.", "Delivery"),
    ("How do I register my restaurant?", "Choose “Hotel Owner / Distributor” in the sign-up modal. Your listing goes into the admin verification queue and appears on the home feed once approved.", "Distributors"),
    ("How is the delivery fee calculated?", "Each hotel sets a flat delivery fee plus a minimum order amount and a delivery radius. The fee is added to your summary only when Home Delivery is selected.", "Delivery"),
    ("Where can I download my invoice?", "Open Order History and use “Download Invoice” on any order — a PDF voucher is generated on demand.", "Payments"),
]


class Command(BaseCommand):
    help = "Seed the platform with demo hotels, menus, users, orders and support content."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing data first.")

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)
        if options["reset"]:
            Order.objects.all().delete()
            Hotel.objects.all().delete()
            User.objects.all().delete()
            FAQ.objects.all().delete()
            self.stdout.write(self.style.WARNING("Existing data cleared."))

        SiteConfig.load()

        admin, created = User.objects.get_or_create(
            email="admin@hotelexpress.dev",
            defaults={"name": "Platform Admin", "role": Role.ADMIN, "is_staff": True, "is_superuser": True},
        )
        if created:
            admin.set_password("Admin1234")
            admin.save()

        for entry in FAQS:
            FAQ.objects.get_or_create(
                question=entry[0], defaults={"answer": entry[1], "category": entry[2]}
            )

        hotels = []
        for index, spec in enumerate(HOTELS):
            owner, created = User.objects.get_or_create(
                email=spec["email"],
                defaults={"name": spec["owner"], "role": Role.DISTRIBUTOR, "phone_number": spec["phone"]},
            )
            if created:
                owner.set_password("Distributor1")
                owner.save()

            hotel, _ = Hotel.objects.get_or_create(
                owner=owner,
                defaults={
                    "name": spec["name"],
                    "place": spec["place"],
                    "cuisine": spec["cuisine"],
                    "contact_number": spec["phone"],
                    "banner_image": UNSPLASH.format(id=spec["banner"]),
                    "latitude": spec["lat"],
                    "longitude": spec["lng"],
                    "opening_time": spec["open"],
                    "closing_time": spec["close"],
                    "has_delivery": spec["delivery"],
                    "flat_delivery_fee": spec["fee"],
                    "min_order_amount": spec["min_order"],
                    "delivery_radius_km": spec["radius"] or 5,
                    "avg_delivery_minutes": spec["avg_minutes"],
                    "rating": spec["rating"],
                    "rating_count": spec["rating_count"],
                    # the last hotel stays unverified so the admin queue has work to show
                    "is_verified": index < len(HOTELS) - 1,
                    "is_online": True,
                    "description": f"{spec['cuisine']} served fresh at {spec['place']}.",
                },
            )
            hotels.append(hotel)

            for position, name in enumerate(dict.fromkeys(row[3] for row in spec["menu"])):
                MenuCategory.objects.get_or_create(hotel=hotel, name=name, defaults={"position": position})

            for row in spec["menu"]:
                name, description, price, category, custom, veg, prep, image = row
                FoodItem.objects.get_or_create(
                    hotel=hotel,
                    name=name,
                    defaults={
                        "description": description,
                        "price": price,
                        "category": category,
                        "image": UNSPLASH.format(id=image),
                        "is_custom_order": custom,
                        "is_veg": veg,
                        "preparation_time_hours": prep,
                    },
                )

        # A staff roster for the first hotel so the permission matrix is demonstrable.
        for name, email, role in (
            ("Alice Smith", "alice@hotelexpress.dev", Role.MANAGER),
            ("Bob Jones", "bob@hotelexpress.dev", Role.COOK),
            ("Charlie Brown", "charlie@hotelexpress.dev", Role.COURIER),
        ):
            member, created = User.objects.get_or_create(
                email=email, defaults={"name": name, "role": role, "hotel": hotels[0]}
            )
            if created:
                member.set_password("Staff12345")
                member.save()

        customers = []
        for email, name, phone, line, lat, lng in CUSTOMERS:
            customer, created = User.objects.get_or_create(
                email=email, defaults={"name": name, "role": Role.CUSTOMER, "phone_number": phone}
            )
            if created:
                customer.set_password("Customer1")
                customer.save()
                Address.objects.create(
                    user=customer, label="Home", address_line=line, latitude=lat, longitude=lng, is_default=True
                )
            customers.append(customer)

        if not Order.objects.exists():
            self._seed_orders(hotels[:5], customers)

        SupportTicket.objects.get_or_create(
            user=customers[0],
            subject="Order arrived later than the selected slot",
            defaults={
                "message": "My order was scheduled for 13:00 but arrived at 13:40. Could you look into it?",
                "status": SupportTicket.Status.PENDING,
            },
        )
        ticket = SupportTicket.objects.filter(user=customers[0]).first()
        if ticket and not ticket.responses.exists():
            TicketMessage.objects.create(
                ticket=ticket,
                sender="Support team",
                message="Thanks for flagging this — we've contacted the hotel and are checking their dispatch log.",
            )

        notify(customers[0], "Welcome to Hotel Express", "Browse hotels near you and schedule your first order.", "system", "/")
        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write("  admin@hotelexpress.dev / Admin1234")
        self.stdout.write("  royal@hotelexpress.dev / Distributor1")
        self.stdout.write("  jane@hotelexpress.dev / Customer1")

    def _seed_orders(self, hotels, customers):
        now = timezone.now()
        statuses = [
            (Order.Status.COMPLETED, 22), (Order.Status.COMPLETED, 18), (Order.Status.COMPLETED, 14),
            (Order.Status.COMPLETED, 9), (Order.Status.COMPLETED, 6), (Order.Status.COMPLETED, 4),
            (Order.Status.COMPLETED, 3), (Order.Status.COMPLETED, 2), (Order.Status.COMPLETED, 1),
            (Order.Status.CANCELLED, 7), (Order.Status.PREPARING, 0), (Order.Status.PLACED, 0),
            (Order.Status.OUT_FOR_DELIVERY, 0), (Order.Status.READY_FOR_PICKUP, 0),
        ]
        for index, (status, days_ago) in enumerate(statuses):
            hotel = hotels[index % len(hotels)]
            buyer = customers[index % len(customers)]
            menu = list(hotel.food_items.filter(is_custom_order=False))
            if not menu:
                continue
            picks = random.sample(menu, k=min(len(menu), random.randint(1, 3)))
            lines = [(item, random.randint(1, 3)) for item in picks]
            delivery_type = (
                Order.DeliveryType.DELIVERY if hotel.has_delivery and index % 2 == 0
                else Order.DeliveryType.PICKUP
            )
            totals = price_order(hotel, lines, delivery_type)
            created = now - timedelta(days=days_ago, hours=random.randint(1, 8))
            address = buyer.addresses.first()

            order = Order.objects.create(
                buyer=buyer,
                hotel=hotel,
                scheduled_date=(created + timedelta(hours=2)).date(),
                scheduled_slot="13:00-13:30",
                status=status,
                delivery_type=delivery_type,
                address=address.address_line if address and delivery_type == Order.DeliveryType.DELIVERY else "",
                latitude=address.latitude if address else None,
                longitude=address.longitude if address else None,
                special_instructions="Please keep the spice level mild." if index % 4 == 0 else "",
                **totals,
            )
            Order.objects.filter(pk=order.pk).update(created_at=created)
            if status in {Order.Status.COMPLETED, Order.Status.CANCELLED}:
                Order.objects.filter(pk=order.pk).update(
                    accepted_at=created + timedelta(minutes=4),
                    completed_at=created + timedelta(hours=1) if status == Order.Status.COMPLETED else None,
                )
            OrderItem.objects.bulk_create(
                [
                    OrderItem(order=order, food_item=item, name=item.name, quantity=qty, price_at_purchase=item.price)
                    for item, qty in lines
                ]
            )
            if status == Order.Status.COMPLETED and index % 3 == 0:
                Review.objects.create(
                    order=order, hotel=hotel, author=buyer,
                    rating=random.choice([4, 5, 5]),
                    comment="Food arrived hot and exactly on schedule.",
                )
