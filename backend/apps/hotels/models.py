from datetime import time

from django.db import models
from django.utils import timezone


class Hotel(models.Model):
    owner = models.OneToOneField(
        "authentication.User", on_delete=models.CASCADE, related_name="hotel_profile"
    )
    name = models.CharField(max_length=140)
    place = models.CharField(max_length=200, blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    cuisine = models.CharField(max_length=80, blank=True)
    banner_image = models.URLField(blank=True)
    gallery_images = models.JSONField(default=list, blank=True)

    google_map_url = models.URLField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    opening_time = models.TimeField(default=time(8, 0))
    closing_time = models.TimeField(default=time(22, 0))

    is_online = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    rejection_reason = models.TextField(blank=True)

    # --- logistics (doc 12) ---
    has_delivery = models.BooleanField(default=True)
    min_order_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    flat_delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    delivery_radius_km = models.FloatField(default=10)
    avg_delivery_minutes = models.PositiveIntegerField(default=35)
    slot_morning = models.BooleanField(default=True)
    slot_afternoon = models.BooleanField(default=True)
    slot_evening = models.BooleanField(default=True)

    rating = models.FloatField(default=0)
    rating_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-rating", "name"]

    def __str__(self):
        return self.name

    @property
    def is_open_now(self) -> bool:
        """Open = distributor toggled online AND local clock is inside operating hours."""
        if not self.is_online:
            return False
        now = timezone.localtime().time()
        if self.opening_time <= self.closing_time:
            return self.opening_time <= now <= self.closing_time
        # overnight window, e.g. 18:00 -> 02:00
        return now >= self.opening_time or now <= self.closing_time

    @property
    def map_url(self) -> str:
        if self.google_map_url:
            return self.google_map_url
        if self.latitude is not None and self.longitude is not None:
            return f"https://www.google.com/maps/search/?api=1&query={self.latitude},{self.longitude}"
        query = (self.name + " " + self.place).strip().replace(" ", "+")
        return f"https://www.google.com/maps/search/?api=1&query={query}"

    @property
    def active_slots(self) -> dict:
        return {
            "morning": self.slot_morning,
            "afternoon": self.slot_afternoon,
            "evening": self.slot_evening,
        }

    def register_rating(self, stars: int) -> None:
        total = self.rating * self.rating_count + stars
        self.rating_count += 1
        self.rating = round(total / self.rating_count, 2)
        self.save(update_fields=["rating", "rating_count"])
