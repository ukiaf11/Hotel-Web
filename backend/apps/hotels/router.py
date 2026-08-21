from datetime import datetime

from django.db.models import Count, Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from apps.authentication.jwt_auth import current_hotel, distributor_auth, manager_auth
from apps.menu.models import FoodItem

from .models import Hotel
from .schemas import (
    DeliveryConfigIn,
    DeliveryConfigOut,
    HotelCardOut,
    HotelDetailOut,
    HotelProfileIn,
    OnlineStatusOut,
)
from .services import build_slots, hotel_card, hotel_detail

router = Router(tags=["hotels"])


@router.get("/", response=list[HotelCardOut])
def list_hotels(request, search: str = "", filter_type: str = "all"):
    """Public home feed (doc 01). Only verified hotels are ever exposed."""
    qs = Hotel.objects.filter(is_verified=True)
    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(place__icontains=search)
            | Q(cuisine__icontains=search)
            | Q(food_items__name__icontains=search)
        ).distinct()

    if filter_type in {"delivery", "delivery_available"}:
        qs = qs.filter(has_delivery=True)
    elif filter_type == "fast_delivery":
        qs = qs.filter(has_delivery=True, avg_delivery_minutes__lt=30)
    elif filter_type == "top_rated":
        qs = qs.filter(rating__gte=4.0).order_by("-rating")

    cards = [hotel_card(hotel) for hotel in qs]
    if filter_type == "open_now":
        cards = [card for card in cards if card["is_open"]]
    return cards


@router.get("/{hotel_id}/", response=HotelDetailOut)
def hotel_details(request, hotel_id: int):
    return hotel_detail(get_object_or_404(Hotel, pk=hotel_id, is_verified=True))


@router.get("/{hotel_id}/menu/")
def hotel_menu(request, hotel_id: int):
    hotel = get_object_or_404(Hotel, pk=hotel_id, is_verified=True)
    items = hotel.food_items.filter(is_available=True)
    categories = list(dict.fromkeys(item.category for item in items))
    return {
        "categories": categories,
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "price": float(item.price),
                "category": item.category,
                "image": item.image,
                "is_available": item.is_available,
                "is_veg": item.is_veg,
                "is_custom_order": item.is_custom_order,
                "preparation_time_hours": item.preparation_time_hours,
            }
            for item in items
        ],
    }


@router.get("/{hotel_id}/delivery-slots/")
def delivery_slots(request, hotel_id: int, date: str = ""):
    from apps.orders.models import Order

    hotel = get_object_or_404(Hotel, pk=hotel_id, is_verified=True)
    try:
        target = datetime.strptime(date, "%Y-%m-%d").date() if date else timezone.localdate()
    except ValueError:
        raise HttpError(400, "Date must be formatted as YYYY-MM-DD.")

    booked = dict(
        Order.objects.filter(hotel=hotel, scheduled_date=target)
        .exclude(status=Order.Status.CANCELLED)
        .values_list("scheduled_slot")
        .annotate(total=Count("id"))
    )
    return {
        "date": target.isoformat(),
        "operating_hours": {
            "open": hotel.opening_time.strftime("%H:%M:%S"),
            "close": hotel.closing_time.strftime("%H:%M:%S"),
        },
        "booked_slots_capacity": build_slots(hotel, target, booked),
    }


# --- distributor workspace (docs 09, 10, 12) --------------------------------

distributor_router = Router(tags=["distributor"])


@distributor_router.get("/hotel/", response=HotelDetailOut, auth=distributor_auth)
def my_hotel(request):
    return hotel_detail(current_hotel(request))


@distributor_router.put("/hotel/update/", response=HotelDetailOut, auth=manager_auth)
def update_my_hotel(request, payload: HotelProfileIn):
    hotel = current_hotel(request)
    data = payload.dict()
    try:
        opening = datetime.strptime(data.pop("opening_time")[:5], "%H:%M").time()
        closing = datetime.strptime(data.pop("closing_time")[:5], "%H:%M").time()
    except ValueError:
        raise HttpError(400, "Operating hours must be formatted as HH:MM.")
    if opening == closing:
        raise HttpError(400, "Closing time must be after opening time.")

    for field, value in data.items():
        setattr(hotel, field, value)
    hotel.opening_time = opening
    hotel.closing_time = closing
    hotel.save()
    return hotel_detail(hotel)


@distributor_router.post("/status/toggle/", response=OnlineStatusOut, auth=distributor_auth)
def toggle_online(request):
    hotel = current_hotel(request)
    hotel.is_online = not hotel.is_online
    hotel.save(update_fields=["is_online"])
    return {"success": True, "is_online": hotel.is_online}


@distributor_router.get("/delivery-settings/", response=DeliveryConfigOut, auth=distributor_auth)
def delivery_settings(request):
    hotel = current_hotel(request)
    return {
        "has_delivery": hotel.has_delivery,
        "min_order_amount": float(hotel.min_order_amount),
        "flat_delivery_fee": float(hotel.flat_delivery_fee),
        "delivery_radius_km": hotel.delivery_radius_km,
        "avg_delivery_minutes": hotel.avg_delivery_minutes,
        "active_slots": hotel.active_slots,
    }


@distributor_router.put(
    "/delivery-settings/update/", response=DeliveryConfigOut, auth=manager_auth
)
def update_delivery_settings(request, payload: DeliveryConfigIn):
    hotel = current_hotel(request)
    hotel.has_delivery = payload.has_delivery
    hotel.min_order_amount = payload.min_order_amount
    hotel.flat_delivery_fee = payload.flat_delivery_fee
    hotel.delivery_radius_km = payload.delivery_radius_km
    hotel.avg_delivery_minutes = payload.avg_delivery_minutes
    slots = payload.active_slots or {}
    hotel.slot_morning = bool(slots.get("morning", True))
    hotel.slot_afternoon = bool(slots.get("afternoon", True))
    hotel.slot_evening = bool(slots.get("evening", True))
    hotel.save()
    return delivery_settings(request)
