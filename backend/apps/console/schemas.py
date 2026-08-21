from ninja import Schema


class PendingHotelOut(Schema):
    id: int
    name: str
    owner_name: str
    owner_email: str
    contact_number: str
    address: str
    latitude: float | None
    longitude: float | None
    created_at: str
    is_verified: bool


class VerifyIn(Schema):
    approved: bool
    reason: str = ""


class AdminTicketOut(Schema):
    id: int
    subject: str
    message: str
    status: str
    user_email: str
    user_name: str
    order_id: int | None
    updated_at: str
    responses: list[dict]


class AdminReplyIn(Schema):
    message: str
    close: bool = False


class SiteConfigOut(Schema):
    maintenance_mode: bool
    maintenance_message: str
    allow_registrations: bool


class SiteConfigIn(Schema):
    maintenance_mode: bool
    maintenance_message: str = ""
    allow_registrations: bool = True


class PlatformStatsOut(Schema):
    total_users: int
    total_hotels: int
    pending_hotels: int
    total_orders: int
    gross_volume: float
    open_tickets: int
