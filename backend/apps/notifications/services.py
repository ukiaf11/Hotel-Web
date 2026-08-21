from .models import Notification


def notify(user, title: str, body: str = "", kind: str = "system", link: str = "") -> Notification | None:
    """Fire-and-forget notification fan-out. Safe to call with a missing user."""
    if user is None:
        return None
    return Notification.objects.create(user=user, title=title, body=body, type=kind, link=link)
