from ninja import Router

from apps.authentication.jwt_auth import any_auth
from apps.authentication.schemas import MessageOut

from .models import Notification
from .schemas import MarkReadIn, NotificationOut

router = Router(tags=["notifications"])


@router.get("/", response=list[NotificationOut], auth=any_auth)
def list_notifications(request):
    return [
        {
            "id": item.id,
            "title": item.title,
            "body": item.body,
            "type": item.type,
            "link": item.link,
            "is_read": item.is_read,
            "created_at": item.created_at.isoformat(),
        }
        for item in request.user.notifications.all()[:60]
    ]


@router.post("/mark-read/", response=MessageOut, auth=any_auth)
def mark_read(request, payload: MarkReadIn):
    qs = Notification.objects.filter(user=request.user, is_read=False)
    if payload.notification_ids:
        qs = qs.filter(id__in=payload.notification_ids)
    qs.update(is_read=True)
    return MessageOut(message="Notifications marked as read.")
