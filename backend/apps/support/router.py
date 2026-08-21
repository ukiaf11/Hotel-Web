from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from apps.authentication.jwt_auth import any_auth
from apps.authentication.schemas import MessageOut
from apps.notifications.services import notify

from .models import FAQ, SupportTicket, TicketMessage
from .schemas import FAQOut, TicketIn, TicketOut, TicketReplyIn
from .services import ticket_payload

router = Router(tags=["support"])


@router.get("/faqs/", response=list[FAQOut])
def faqs(request, search: str = ""):
    qs = FAQ.objects.all()
    if search:
        qs = qs.filter(question__icontains=search)
    return list(qs)


@router.get("/tickets/", response=list[TicketOut], auth=any_auth)
def tickets(request):
    qs = request.user.tickets.all().prefetch_related("responses")
    return [ticket_payload(ticket) for ticket in qs]


@router.post("/tickets/create/", response=TicketOut, auth=any_auth)
def create_ticket(request, payload: TicketIn):
    if not payload.subject.strip() or not payload.message.strip():
        raise HttpError(400, "Both a subject and a message are required.")
    ticket = SupportTicket.objects.create(
        user=request.user,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        order_id=payload.order_id,
    )
    notify(
        request.user,
        "Support ticket created",
        f"Ticket #{ticket.id} — we'll get back to you shortly.",
        kind="ticket",
        link="/help",
    )
    return ticket_payload(ticket)


@router.post("/tickets/{ticket_id}/reply/", response=TicketOut, auth=any_auth)
def reply_ticket(request, ticket_id: int, payload: TicketReplyIn):
    ticket = get_object_or_404(SupportTicket, pk=ticket_id, user=request.user)
    if not payload.message.strip():
        raise HttpError(400, "Message cannot be empty.")
    TicketMessage.objects.create(
        ticket=ticket, sender=request.user.name, message=payload.message.strip()
    )
    ticket.status = SupportTicket.Status.OPEN
    ticket.save(update_fields=["status", "updated_at"])
    return ticket_payload(ticket)


@router.post("/tickets/{ticket_id}/close/", response=MessageOut, auth=any_auth)
def close_ticket(request, ticket_id: int):
    ticket = get_object_or_404(SupportTicket, pk=ticket_id, user=request.user)
    ticket.status = SupportTicket.Status.RESOLVED
    ticket.save(update_fields=["status", "updated_at"])
    return MessageOut(message="Ticket closed.")
