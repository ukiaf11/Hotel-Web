from django.db import models


class SiteConfig(models.Model):
    """Singleton row holding platform-wide switches (doc 18)."""

    maintenance_mode = models.BooleanField(default=False)
    maintenance_message = models.CharField(
        max_length=200,
        default="System undergoing maintenance. New orders are temporarily paused.",
    )
    allow_registrations = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "site configuration"

    def __str__(self):
        return "Platform configuration"

    @classmethod
    def load(cls) -> "SiteConfig":
        config, _ = cls.objects.get_or_create(pk=1)
        return config
