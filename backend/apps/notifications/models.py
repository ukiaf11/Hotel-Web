from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        ORDER = "order", "Order"
        TICKET = "ticket", "Ticket"
        SYSTEM = "system", "System"

    user = models.ForeignKey(
        "authentication.User", on_delete=models.CASCADE, related_name="notifications"
    )
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=255, blank=True)
    type = models.CharField(max_length=12, choices=Kind.choices, default=Kind.SYSTEM)
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
