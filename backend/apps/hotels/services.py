"""Shared hotel helpers: card serialisation and delivery-slot generation."""

from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.utils import timezone

SLOT_BLOCKS = {
    "morning": (time(9, 0), time(12, 0)),
    "afternoon": (time(12, 0), time(17, 0)),
    "evening": (time(17, 0), time(22, 0)),
}


def hotel_card(hotel) -> dict:
    return {
        "id": hotel.id,
        "name": hotel.name,
        "place": hotel.place,
        "contact_number": hotel.contact_number,
        "google_map_url": hotel.map_url,
        "banner_image": hotel.banner_image,
        "cuisine": hotel.cuisine,
        "rating": hotel.rating,
        "rating_count": hotel.rating_count,
        "has_delivery": hotel.has_delivery,
        "is_open": hotel.is_open_now,
        "avg_delivery_minutes": hotel.avg_delivery_minutes,
    }


def hotel_detail(hotel) -> dict:
    return {
        **hotel_card(hotel),
        "description": hotel.description,
        "opening_time": hotel.opening_time.strftime("%H:%M:%S"),
        "closing_time": hotel.closing_time.strftime("%H:%M:%S"),
        "latitude": hotel.latitude,
        "longitude": hotel.longitude,
        "min_order_amount": float(hotel.min_order_amount),
        "flat_delivery_fee": float(hotel.flat_delivery_fee),
        "delivery_radius_km": hotel.delivery_radius_km,
        "gallery_images": hotel.gallery_images or [],
        "is_online": hotel.is_online,
        "is_verified": hotel.is_verified,
    }


def _slot_is_enabled(hotel, slot_start: time) -> bool:
    for block, (start, end) in SLOT_BLOCKS.items():
        if start <= slot_start < end:
            return getattr(hotel, f"slot_{block}")
    # Slots outside the three configured blocks follow the hotel's opening hours only.
    return True


def build_slots(hotel, target: date, booked_counts: dict[str, int] | None = None) -> list[dict]:
    """30-minute slots inside operating hours, flagged full when capacity is reached."""
    booked_counts = booked_counts or {}
    step = timedelta(minutes=settings.SLOT_MINUTES)
    cursor = datetime.combine(target, hotel.opening_time)
    end = datetime.combine(target, hotel.closing_time)
    if hotel.closing_time <= hotel.opening_time:  # overnight service
        end += timedelta(days=1)

    now = timezone.localtime().replace(tzinfo=None)
    slots: list[dict] = []
    while cursor + step <= end:
        label = f"{cursor.strftime('%H:%M')}-{(cursor + step).strftime('%H:%M')}"
        slots.append(
            {
                "slot": label,
                "start": cursor.strftime("%H:%M"),
                "is_full": booked_counts.get(label, 0) >= 8,
                "is_past": cursor <= now,
                "is_enabled": _slot_is_enabled(hotel, cursor.time()),
            }
        )
        cursor += step
    return slots
