"""Order pricing, geo checks, serialisation and PDF invoice rendering."""

import io
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from math import asin, cos, radians, sin, sqrt

from django.conf import settings
from django.utils import timezone

from .models import Order

TWO_PLACES = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Great-circle distance, used for the delivery radius check (doc 12)."""
    radius = 6371.0
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * radius * asin(sqrt(a))


def price_order(hotel, lines, delivery_type: str) -> dict:
    """lines: iterable of (FoodItem, quantity)."""
    subtotal = sum((money(item.price) * qty for item, qty in lines), Decimal("0"))
    fee = money(hotel.flat_delivery_fee) if delivery_type == Order.DeliveryType.DELIVERY else Decimal("0")
    tax = money(subtotal * Decimal(str(settings.PLATFORM_TAX_RATE)))
    return {
        "subtotal": money(subtotal),
        "delivery_fee": fee,
        "tax_amount": tax,
        "total_amount": money(subtotal + fee + tax),
    }


def order_lines(order: Order) -> list[dict]:
    return [
        {"name": line.name, "quantity": line.quantity, "price": float(line.price_at_purchase)}
        for line in order.items.all()
    ]


def estimated_eta(order: Order):
    """Slot start, nudged by the hotel's average delivery duration for home delivery."""
    eta = order.slot_start
    if order.delivery_type == Order.DeliveryType.DELIVERY:
        eta += timedelta(minutes=order.hotel.avg_delivery_minutes)
    return eta


def status_payload(order: Order) -> dict:
    hotel = order.hotel
    return {
        "order_id": order.id,
        "status": order.status,
        "eta": estimated_eta(order).isoformat(),
        "delivery_type": order.delivery_type,
        "hotel_name": hotel.name,
        "hotel_phone": hotel.contact_number,
        "hotel_address": hotel.place,
        "hotel_map_url": hotel.map_url,
        "hotel_coordinates": (
            {"lat": hotel.latitude, "lng": hotel.longitude}
            if hotel.latitude is not None and hotel.longitude is not None
            else None
        ),
        "user_coordinates": (
            {"lat": order.latitude, "lng": order.longitude}
            if order.latitude is not None and order.longitude is not None
            else None
        ),
        "user_address": order.address,
        "total_amount": float(order.total_amount),
        "payment_method": order.payment_method,
        "can_cancel": order.can_cancel,
        "placed_at": order.created_at.isoformat(),
        "accepted_at": order.accepted_at.isoformat() if order.accepted_at else None,
        "completed_at": order.completed_at.isoformat() if order.completed_at else None,
        "items": order_lines(order),
        "special_instructions": order.special_instructions,
    }


def history_payload(order: Order) -> dict:
    return {
        "id": order.id,
        "hotel_id": order.hotel_id,
        "hotel_name": order.hotel.name,
        "order_date": order.created_at.isoformat(),
        "scheduled_time": f"{order.scheduled_date.isoformat()} {order.scheduled_slot}",
        "status": order.status,
        "items_summary": order.items_summary,
        "items": order_lines(order),
        "total_amount": float(order.total_amount),
        "payment_method": order.payment_method,
        "delivery_type": order.delivery_type,
        "can_cancel": order.can_cancel,
        "has_review": hasattr(order, "review"),
    }


def queue_payload(order: Order) -> dict:
    return {
        "id": order.id,
        "customer_name": order.buyer.name,
        "customer_phone": order.buyer.phone_number,
        "items": order_lines(order),
        "delivery_type": order.delivery_type,
        "address": order.address,
        "scheduled_time": f"{order.scheduled_date.isoformat()} {order.scheduled_slot}",
        "placed_at": order.created_at.isoformat(),
        "total_price": float(order.total_amount),
        "status": order.status,
        "special_instructions": order.special_instructions,
        "map_url": (
            f"https://www.google.com/maps/search/?api=1&query={order.latitude},{order.longitude}"
            if order.latitude is not None and order.longitude is not None
            else ""
        ),
    }


def render_invoice_pdf(order: Order) -> bytes:
    """A4 offline-payment voucher (doc 08, endpoint 3)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 25 * mm

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(20 * mm, y, "Hotel Express — Tax Invoice")
    y -= 8 * mm
    pdf.setFont("Helvetica", 10)
    pdf.drawString(20 * mm, y, f"Invoice for Order #{order.id}")
    y -= 5 * mm
    pdf.drawString(20 * mm, y, f"Issued: {timezone.localtime(order.created_at):%d %b %Y, %I:%M %p}")

    y -= 12 * mm
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(20 * mm, y, order.hotel.name)
    pdf.setFont("Helvetica", 10)
    y -= 5 * mm
    pdf.drawString(20 * mm, y, order.hotel.place or "-")
    y -= 5 * mm
    pdf.drawString(20 * mm, y, f"Tel: {order.hotel.contact_number or '-'}")

    y -= 10 * mm
    pdf.drawString(20 * mm, y, f"Billed to: {order.buyer.name} ({order.buyer.email})")
    y -= 5 * mm
    mode = "Home delivery" if order.delivery_type == Order.DeliveryType.DELIVERY else "Self pickup"
    pdf.drawString(20 * mm, y, f"Fulfilment: {mode} — {order.scheduled_date} {order.scheduled_slot}")
    if order.address:
        y -= 5 * mm
        pdf.drawString(20 * mm, y, f"Address: {order.address[:90]}")

    y -= 12 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(20 * mm, y, "Item")
    pdf.drawRightString(130 * mm, y, "Qty")
    pdf.drawRightString(160 * mm, y, "Unit")
    pdf.drawRightString(190 * mm, y, "Amount")
    y -= 2 * mm
    pdf.line(20 * mm, y, 190 * mm, y)
    pdf.setFont("Helvetica", 10)

    for line in order.items.all():
        y -= 6 * mm
        pdf.drawString(20 * mm, y, line.name[:55])
        pdf.drawRightString(130 * mm, y, str(line.quantity))
        pdf.drawRightString(160 * mm, y, f"{line.price_at_purchase:.2f}")
        pdf.drawRightString(190 * mm, y, f"{line.line_total:.2f}")

    y -= 4 * mm
    pdf.line(120 * mm, y, 190 * mm, y)
    for label, value in (
        ("Subtotal", order.subtotal),
        ("Delivery fee", order.delivery_fee),
        ("Tax", order.tax_amount),
    ):
        y -= 6 * mm
        pdf.drawRightString(160 * mm, y, label)
        pdf.drawRightString(190 * mm, y, f"{value:.2f}")

    y -= 8 * mm
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawRightString(160 * mm, y, "Total")
    pdf.drawRightString(190 * mm, y, f"{order.total_amount:.2f}")

    y -= 14 * mm
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.drawString(20 * mm, y, "Payment method: Offline (cash on delivery / pay at the hotel counter).")
    y -= 5 * mm
    pdf.drawString(20 * mm, y, f"Order status at time of download: {order.get_status_display()}.")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
