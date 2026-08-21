from datetime import datetime, timedelta

from django.db import models
from django.utils import timezone


class Order(models.Model):
    class Status(models.TextChoices):
        PLACED = "placed", "Placed"
        ACCEPTED = "accepted", "Accepted"
        PREPARING = "preparing", "Preparing"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        READY_FOR_PICKUP = "ready_for_pickup", "Ready for pickup"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    ACTIVE_STATUSES = [
        Status.PLACED,
        Status.ACCEPTED,
        Status.PREPARING,
        Status.OUT_FOR_DELIVERY,
        Status.READY_FOR_PICKUP,
    ]

    class DeliveryType(models.TextChoices):
        DELIVERY = "delivery", "Home delivery"
        PICKUP = "pickup", "Self pickup"

    buyer = models.ForeignKey(
        "authentication.User", on_delete=models.CASCADE, related_name="orders"
    )
    hotel = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="orders")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    scheduled_date = models.DateField()
    scheduled_slot = models.CharField(max_length=16, help_text="HH:MM-HH:MM")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLACED)
    delivery_type = models.CharField(
        max_length=10, choices=DeliveryType.choices, default=DeliveryType.PICKUP
    )
    address = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    payment_method = models.CharField(max_length=20, default="offline")
    special_instructions = models.TextField(blank=True)
    rejection_reason = models.CharField(max_length=200, blank=True)

    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.id} — {self.hotel.name}"

    @property
    def is_active(self) -> bool:
        return self.status in self.ACTIVE_STATUSES

    @property
    def can_cancel(self) -> bool:
        """Doc 05: cancellation is only allowed before the distributor accepts."""
        return self.status == self.Status.PLACED

    @property
    def slot_start(self) -> datetime:
        raw = self.scheduled_slot.split("-")[0] if self.scheduled_slot else "00:00"
        hour, minute = (int(part) for part in raw.split(":"))
        naive = datetime.combine(self.scheduled_date, datetime.min.time()) + timedelta(
            hours=hour, minutes=minute
        )
        return timezone.make_aware(naive, timezone.get_current_timezone())

    @property
    def items_summary(self) -> str:
        return ", ".join(f"{line.name} (x{line.quantity})" for line in self.items.all())


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    food_item = models.ForeignKey(
        "menu.FoodItem", null=True, on_delete=models.SET_NULL, related_name="order_lines"
    )
    name = models.CharField(max_length=140)
    quantity = models.PositiveIntegerField(default=1)
    price_at_purchase = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        return f"{self.name} x{self.quantity}"

    @property
    def line_total(self):
        return self.price_at_purchase * self.quantity


class Review(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="review")
    hotel = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="reviews")
    author = models.ForeignKey("authentication.User", on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rating}★ on order #{self.order_id}"
