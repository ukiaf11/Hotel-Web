from django.db.models import Sum
from django.shortcuts import get_object_or_404
from ninja import Router

from apps.authentication.jwt_auth import admin_auth
from apps.authentication.models import Role, User
from apps.authentication.schemas import MessageOut
from apps.hotels.models import Hotel
from apps.notifications.services import notify
from apps.orders.models import Order
from apps.support.models import SupportTicket, TicketMessage

from .models import SiteConfig
from .schemas import (
    AdminReplyIn,
    AdminTicketOut,
    PendingHotelOut,
    PlatformStatsOut,
    SiteConfigIn,
    SiteConfigOut,
    VerifyIn,
)

router = Router(tags=["admin"])


def _hotel_payload(hotel: Hotel) -> dict:
    return {
        "id": hotel.id,
        "name": hotel.name,
        "owner_name": hotel.owner.name,
        "owner_email": hotel.owner.email,
        "contact_number": hotel.contact_number,
        "address": hotel.place,
        "latitude": hotel.latitude,
        "longitude": hotel.longitude,
        "created_at": hotel.created_at.isoformat(),
        "is_verified": hotel.is_verified,
    }


@router.get("/stats/", response=PlatformStatsOut, auth=admin_auth)
def platform_stats(request):
    gross = Order.objects.filter(status=Order.Status.COMPLETED).aggregate(
        total=Sum("total_amount")
    )["total"]
    return {
        "total_users": User.objects.filter(role=Role.CUSTOMER).count(),
        "total_hotels": Hotel.objects.filter(is_verified=True).count(),
        "pending_hotels": Hotel.objects.filter(is_verified=False).count(),
        "total_orders": Order.objects.count(),
        "gross_volume": float(gross or 0),
        "open_tickets": SupportTicket.objects.exclude(
            status=SupportTicket.Status.RESOLVED
        ).count(),
    }


@router.get("/hotels/pending/", response=list[PendingHotelOut], auth=admin_auth)
def pending_hotels(request):
    qs = Hotel.objects.filter(is_verified=False).select_related("owner")
    return [_hotel_payload(hotel) for hotel in qs]


@router.get("/hotels/", response=list[PendingHotelOut], auth=admin_auth)
def all_hotels(request):
    return [_hotel_payload(hotel) for hotel in Hotel.objects.select_related("owner")]


@router.post("/hotels/{hotel_id}/verify/", response=MessageOut, auth=admin_auth)
def verify_hotel(request, hotel_id: int, payload: VerifyIn):
    hotel = get_object_or_404(Hotel, pk=hotel_id)
    hotel.is_verified = payload.approved
    hotel.rejection_reason = "" if payload.approved else payload.reason
    if payload.approved:
        hotel.is_online = True
    hotel.save(update_fields=["is_verified", "rejection_reason", "is_online"])

    if payload.approved:
        notify(
            hotel.owner,
            "Hotel approved",
            f"{hotel.name} is now live on the customer home feed.",
            kind="system",
            link="/distributor",
        )
        return MessageOut(message=f"{hotel.name} approved and published.")
    notify(
        hotel.owner,
        "Hotel listing rejected",
        payload.reason or "Your listing needs changes before it can go live.",
        kind="system",
        link="/distributor/profile",
    )
    return MessageOut(message=f"{hotel.name} was rejected.")


@router.get("/tickets/", response=list[AdminTicketOut], auth=admin_auth)
def admin_tickets(request, status: str = "open"):
    qs = SupportTicket.objects.select_related("user").prefetch_related("responses")
    if status == "open":
        qs = qs.exclude(status=SupportTicket.Status.RESOLVED)
    elif status in {"resolved", "pending"}:
        qs = qs.filter(status=status)
    return [
        {
            "id": ticket.id,
            "subject": ticket.subject,
            "message": ticket.message,
            "status": ticket.status,
            "user_email": ticket.user.email,
            "user_name": ticket.user.name,
            "order_id": ticket.order_id,
            "updated_at": ticket.updated_at.isoformat(),
            "responses": [
                {
                    "sender": response.sender,
                    "message": response.message,
                    "timestamp": response.created_at.isoformat(),
                }
                for response in ticket.responses.all()
            ],
        }
        for ticket in qs
    ]


@router.post("/tickets/{ticket_id}/reply/", response=MessageOut, auth=admin_auth)
def reply_ticket(request, ticket_id: int, payload: AdminReplyIn):
    ticket = get_object_or_404(SupportTicket, pk=ticket_id)
    if payload.message.strip():
        TicketMessage.objects.create(
            ticket=ticket, sender="Support team", message=payload.message.strip()
        )
    ticket.status = (
        SupportTicket.Status.RESOLVED if payload.close else SupportTicket.Status.PENDING
    )
    ticket.save(update_fields=["status", "updated_at"])
    notify(
        ticket.user,
        "Support replied" if not payload.close else "Ticket resolved",
        f"Ticket #{ticket.id}: {payload.message.strip()[:120] or 'Your ticket was closed.'}",
        kind="ticket",
        link="/help",
    )
    return MessageOut(message="Reply sent.")


@router.get("/settings/", response=SiteConfigOut, auth=admin_auth)
def get_settings(request):
    return SiteConfig.load()


@router.put("/settings/", response=SiteConfigOut, auth=admin_auth)
def update_settings(request, payload: SiteConfigIn):
    config = SiteConfig.load()
    config.maintenance_mode = payload.maintenance_mode
    if payload.maintenance_message:
        config.maintenance_message = payload.maintenance_message
    config.allow_registrations = payload.allow_registrations
    config.save()
    return config
