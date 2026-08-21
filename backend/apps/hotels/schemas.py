from ninja import Schema


class HotelCardOut(Schema):
    """Shape consumed by the customer home feed (doc 01)."""

    id: int
    name: str
    place: str
    contact_number: str
    google_map_url: str
    banner_image: str
    cuisine: str
    rating: float
    rating_count: int
    has_delivery: bool
    is_open: bool
    avg_delivery_minutes: int


class HotelDetailOut(HotelCardOut):
    description: str
    opening_time: str
    closing_time: str
    latitude: float | None
    longitude: float | None
    min_order_amount: float
    flat_delivery_fee: float
    delivery_radius_km: float
    gallery_images: list[str]
    is_online: bool
    is_verified: bool


class HotelProfileIn(Schema):
    name: str
    place: str = ""
    contact_number: str = ""
    description: str = ""
    cuisine: str = ""
    opening_time: str
    closing_time: str
    latitude: float | None = None
    longitude: float | None = None
    google_map_url: str = ""
    banner_image: str = ""
    gallery_images: list[str] = []


class DeliveryConfigOut(Schema):
    has_delivery: bool
    min_order_amount: float
    flat_delivery_fee: float
    delivery_radius_km: float
    avg_delivery_minutes: int
    active_slots: dict


class DeliveryConfigIn(Schema):
    has_delivery: bool
    min_order_amount: float = 0
    flat_delivery_fee: float = 0
    delivery_radius_km: float = 10
    avg_delivery_minutes: int = 35
    active_slots: dict = {"morning": True, "afternoon": True, "evening": True}


class OnlineStatusOut(Schema):
    success: bool = True
    is_online: bool
