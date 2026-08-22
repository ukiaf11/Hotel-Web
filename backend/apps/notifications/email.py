"""Transactional order email.

Two messages go out the moment an order is placed: a kitchen ticket for the
distributor (food list plus customer details) and a confirmation for the buyer.

Sending is best-effort by design — a mail outage must never cost a customer their
order, so every failure here is logged and swallowed.
"""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


def _line_items(order) -> list[dict]:
    return [
        {
            "name": line.name,
            "quantity": line.quantity,
            "unit_price": line.price_at_purchase,
            "line_total": line.line_total,
        }
        for line in order.items.all()
    ]


def order_context(order) -> dict:
    """Everything both templates need, resolved once."""
    hotel = order.hotel
    buyer = order.buyer
    is_delivery = order.delivery_type == order.DeliveryType.DELIVERY

    return {
        "order": order,
        "hotel": hotel,
        "buyer": buyer,
        "items": _line_items(order),
        "item_count": sum(line.quantity for line in order.items.all()),
        "is_delivery": is_delivery,
        "fulfilment": "Home delivery" if is_delivery else "Self-pickup",
        "placed_at": timezone.localtime(order.created_at),
        "customer_map_url": (
            f"https://www.google.com/maps/search/?api=1&query={order.latitude},{order.longitude}"
            if order.latitude is not None and order.longitude is not None
            else ""
        ),
        "hotel_map_url": hotel.map_url,
        "queue_url": f"{settings.FRONTEND_URL}/distributor/orders",
        "track_url": f"{settings.FRONTEND_URL}/orders/track/{order.id}",
        "currency": "$",
    }


def _compose(subject: str, template: str, context: dict, to: list[str]) -> EmailMultiAlternatives:
    text_body = render_to_string(f"email/{template}.txt", context)
    html_body = render_to_string(f"email/{template}.html", context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to,
    )
    message.attach_alternative(html_body, "text/html")
    return message


def build_distributor_email(order) -> EmailMultiAlternatives | None:
    """The kitchen ticket. Reply-To is the buyer so the hotel can answer directly."""
    recipient = order.hotel.owner.email
    if not recipient:
        return None

    context = order_context(order)
    message = _compose(
        subject=f"New order #{order.id} — {context['item_count']} item(s) for {order.scheduled_slot}",
        template="order_distributor",
        context=context,
        to=[recipient],
    )
    if order.buyer.email:
        message.reply_to = [order.buyer.email]
    return message


def build_customer_email(order) -> EmailMultiAlternatives | None:
    recipient = order.buyer.email
    if not recipient:
        return None

    context = order_context(order)
    message = _compose(
        subject=f"Order #{order.id} confirmed — {order.hotel.name}",
        template="order_customer",
        context=context,
        to=[recipient],
    )
    if order.hotel.owner.email:
        message.reply_to = [order.hotel.owner.email]
    return message


def send_order_emails(order_id: int) -> int:
    """Render and send both messages. Returns how many were actually sent."""
    from apps.orders.models import Order

    if not settings.ORDER_EMAILS_ENABLED:
        logger.info("Order emails are disabled; skipping order %s", order_id)
        return 0

    order = (
        Order.objects.select_related("hotel__owner", "buyer")
        .prefetch_related("items")
        .filter(pk=order_id)
        .first()
    )
    if order is None:
        logger.warning("Cannot send order email: order %s no longer exists", order_id)
        return 0

    messages = []
    if settings.ORDER_EMAIL_TO_DISTRIBUTOR:
        messages.append(build_distributor_email(order))
    if settings.ORDER_EMAIL_TO_CUSTOMER:
        messages.append(build_customer_email(order))
    messages = [message for message in messages if message is not None]
    if not messages:
        return 0

    sent = 0
    for message in messages:
        try:
            sent += message.send(fail_silently=False)
        except Exception:  # noqa: BLE001 — never let mail break the order flow
            logger.exception("Failed to send order email for order %s to %s", order_id, message.to)
    logger.info("Sent %s/%s order email(s) for order %s", sent, len(messages), order_id)
    return sent


def dispatch_order_emails(order) -> None:
    """Hand off to Celery when a broker is reachable, otherwise send inline.

    Scheduled on transaction commit so the email can never describe an order that
    was rolled back.
    """

    order_id = order.id

    def _dispatch() -> None:
        try:
            from .tasks import send_order_emails_task

            send_order_emails_task.delay(order_id)
        except Exception:  # noqa: BLE001 — broker down or missing: fall back to inline
            logger.warning("Queueing order email failed for order %s; sending inline", order_id)
            send_order_emails(order_id)

    transaction.on_commit(_dispatch)
