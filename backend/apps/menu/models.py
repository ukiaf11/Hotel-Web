from django.db import models


class MenuCategory(models.Model):
    hotel = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=60)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        unique_together = ("hotel", "name")
        verbose_name_plural = "menu categories"

    def __str__(self):
        return self.name


class FoodItem(models.Model):
    hotel = models.ForeignKey("hotels.Hotel", on_delete=models.CASCADE, related_name="food_items")
    name = models.CharField(max_length=140)
    description = models.CharField(max_length=200, blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    category = models.CharField(max_length=60, default="Mains")
    image = models.URLField(blank=True)
    is_available = models.BooleanField(default=True)
    is_veg = models.BooleanField(default=True)
    #: "on-order" dishes need advance notice; drives the scheduling lead time (doc 03)
    is_custom_order = models.BooleanField(default=False)
    preparation_time_hours = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.name} ({self.hotel.name})"
