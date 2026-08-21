from datetime import datetime, timedelta

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from apps.authentication.jwt_auth import any_auth
from apps.authentication.schemas import MessageOut
from apps.console.models import SiteConfig
from apps.hotels.models import Hotel
from apps.menu.models import FoodItem
from apps.notifications.services import notify

from .models import Order, OrderItem, Review
from .schemas import (
    OrderCreateIn,
    OrderCreateOut,
    OrderHistoryPage,
    OrderStatusOut,
    ReviewIn,
)
from .services import haversine_km, history_payload, price_order, status_payload

router = Router(tags=["orders"])
PAGE_SIZE = 6


@router.post("/create/", response=OrderCreateOut, auth=any_auth)
def create_order(request, payload: OrderCreateIn):
    config = SiteConfig.load()
    if config.maintenance_mode:
        raise HttpError(503, config.maintenance_message)

    hotel = get_object_or_404(Hotel, pk=payload.hotel_id, is_verified=True)
    if not payload.items:
        raise HttpError(400, "Your cart is empty.")
    if not hotel.is_online:
        raise HttpError(409, "This hotel is currently closed and not accepting orders.")

    delivery_type = payload.delivery_type
    if delivery_type == Order.DeliveryType.DELIVERY and not hotel.has_delivery:
        raise HttpError(409, "This hotel does not offer home delivery. Please choose self-pickup.")

    try:
        scheduled_date = datetime.strptime(payload.delivery_date, "%Y-%m-%d").date()
    except ValueError:
        raise HttpError(400, "Delivery date must be formatted as YYYY-MM-DD.")

    today = timezone.localdate()
    if scheduled_date < today:
        raise HttpError(400, "You cannot schedule an order in the past.")
    if scheduled_date > today + timedelta(days=14):
        raise HttpError(400, "Orders can only be scheduled up to 14 days ahead.")

    wanted = {line.food_item_id: line.quantity for line in payload.items}
    items = list(FoodItem.objects.filter(id__in=wanted, hotel=hotel, is_available=True))
    if len(items) != len(wanted):
        raise HttpError(409, "Some items are no longer available. Please refresh the menu.")

    lines = [(item, wanted[item.id]) for item in items]
    totals = price_order(hotel, lines, delivery_type)

    if delivery_type == Order.DeliveryType.DELIVERY:
        if not payload.address.strip():
            raise HttpError(400, "A delivery address is required for home delivery.")
        if float(totals["subtotal"]) < float(hotel.min_order_amount):
            raise HttpError(
                409,
                f"Minimum order amount for home delivery from this hotel is "
                f"{hotel.min_order_amount:.2f}.",
            )
        if (
            payload.latitude is not None
            and payload.longitude is not None
            and hotel.latitude is not None
            and hotel.longitude is not None
        ):
            distance = haversine_km(hotel.latitude, hotel.longitude, payload.latitude, payload.longitude)
            if distance > hotel.delivery_radius_km:
                raise HttpError(
                    409,
                    f"Your location is {distance:.1f} km away, outside this hotel's "
                    f"{hotel.delivery_radius_km:.0f} km delivery boundary.",
                )

    # Lead-time guard mirrors the client-side slot lockout (doc 03).
    max_prep = max((item.preparation_time_hours for item, _ in lines), default=0)
    slot_start_raw = payload.delivery_time_slot.split("-")[0]
    try:
        hour, minute = (int(part) for part in slot_start_raw.split(":"))
    except ValueError:
        raise HttpError(400, "Time slot must be formatted as HH:MM-HH:MM.")
    slot_dt = timezone.make_aware(
        datetime.combine(scheduled_date, datetime.min.time()) + timedelta(hours=hour, minutes=minute),
        timezone.get_current_timezone(),
    )
    if slot_dt < timezone.now() + timedelta(hours=max_prep):
        raise HttpError(
            409,
            "That slot no longer satisfies the preparation lead time for your items. "
            "Please pick a later slot.",
        )

    with transaction.atomic():
        order = Order.objects.create(
            buyer=request.user,
            hotel=hotel,
            scheduled_date=scheduled_date,
            scheduled_slot=payload.delivery_time_slot,
            delivery_type=delivery_type,
            address=payload.address,
            latitude=payload.latitude,
            longitude=payload.longitude,
            payment_method="offline",
            special_instructions=payload.special_instructions,
            **totals,
        )
        OrderItem.objects.bulk_create(
            [
                OrderItem(
                    order=order,
                    food_item=item,
                    name=item.name,
                    quantity=qty,
                    price_at_purchase=item.price,
                )
                for item, qty in lines
            ]
        )

    notify(
        hotel.owner,
        "New order received",
        f"Order #{order.id} has been placed for {order.scheduled_slot}.",
        kind="order",
        link=f"/distributor/orders?focus={order.id}",
    )
    notify(
        request.user,
        "Order placed",
        f"Order #{order.id} at {hotel.name} is awaiting confirmation.",
        kind="order",
        link=f"/orders/track/{order.id}",
    )
    return {
        "success": True,
        "order_id": order.id,
        "status": order.status,
        "delivery_type": order.delivery_type,
        "scheduled_time": f"{order.scheduled_date} {order.scheduled_slot}",
        "total_amount": float(order.total_amount),
    }


@router.get("/active/", response=list[OrderStatusOut], auth=any_auth)
def active_orders(request):
    orders = Order.objects.filter(
        buyer=request.user, status__in=Order.ACTIVE_STATUSES
    ).select_related("hotel")
    return [status_payload(order) for order in orders]


@router.get("/{order_id}/status/", response=OrderStatusOut, auth=any_auth)
def order_status(request, order_id: int):
    order = get_object_or_404(Order, pk=order_id, buyer=request.user)
    return status_payload(order)


@router.post("/{order_id}/cancel/", response=MessageOut, auth=any_auth)
def cancel_order(request, order_id: int):
    order = get_object_or_404(Order, pk=order_id, buyer=request.user)
    if not order.can_cancel:
        raise HttpError(
            409,
            "This order is being prepared and can no longer be cancelled. "
            "Contact the hotel for adjustments.",
        )
    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status"])
    notify(
        order.hotel.owner,
        "Order cancelled",
        f"Order #{order.id} was cancelled by the customer.",
        kind="order",
    )
    return MessageOut(message="Order cancelled.")


@router.get("/history/", response=OrderHistoryPage, auth=any_auth)
def order_history(request, page: int = 1, status: str = "all"):
    qs = Order.objects.filter(buyer=request.user).select_related("hotel")
    if status == "active":
        qs = qs.filter(status__in=Order.ACTIVE_STATUSES)
    elif status in {Order.Status.COMPLETED, Order.Status.CANCELLED}:
        qs = qs.filter(status=status)

    total = qs.count()
    total_pages = max(1, -(-total // PAGE_SIZE))
    page = min(max(page, 1), total_pages)
    window = qs[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
    return {
        "results": [history_payload(order) for order in window],
        "current_page": page,
        "total_pages": total_pages,
        "total_count": total,
    }


@router.post("/{order_id}/review/", response=MessageOut, auth=any_auth)
def submit_review(request, order_id: int, payload: ReviewIn):
    order = get_object_or_404(Order, pk=order_id, buyer=request.user)
    if order.status != Order.Status.COMPLETED:
        raise HttpError(409, "You can only review completed orders.")
    if hasattr(order, "review"):
        raise HttpError(409, "You have already reviewed this order.")
    if not 1 <= payload.rating <= 5:
        raise HttpError(400, "Rating must be between 1 and 5 stars.")

    Review.objects.create(
        order=order,
        hotel=order.hotel,
        author=request.user,
        rating=payload.rating,
        comment=payload.comment,
    )
    order.hotel.register_rating(payload.rating)
    return MessageOut(message="Review recorded.")


@router.get("/{order_id}/invoice/", auth=any_auth)
def invoice(request, order_id: int):
    from .services import render_invoice_pdf

    order = get_object_or_404(Order, pk=order_id, buyer=request.user)
    response = HttpResponse(render_invoice_pdf(order), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="invoice-{order.id}.pdf"'
    return response
