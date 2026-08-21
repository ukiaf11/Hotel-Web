from django.db import models


class FAQ(models.Model):
    question = models.CharField(max_length=200)
    answer = models.TextField()
    category = models.CharField(max_length=60, default="General")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = "FAQ"

    def __str__(self):
        return self.question


class SupportTicket(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PENDING = "pending", "Pending response"
        RESOLVED = "resolved", "Resolved"

    user = models.ForeignKey(
        "authentication.User", on_delete=models.CASCADE, related_name="tickets"
    )
    subject = models.CharField(max_length=160)
    message = models.TextField()
    order = models.ForeignKey(
        "orders.Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets"
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"#{self.id} {self.subject}"


class TicketMessage(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="responses")
    sender = models.CharField(max_length=60, default="Support")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
