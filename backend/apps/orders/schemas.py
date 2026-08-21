from ninja import Schema


class OrderLineIn(Schema):
    food_item_id: int
    quantity: int = 1


class OrderCreateIn(Schema):
    hotel_id: int
    items: list[OrderLineIn]
    delivery_date: str
    delivery_time_slot: str
    delivery_type: str = "pickup"
    address: str = ""
    latitude: float | None = None
    longitude: float | None = None
    payment_method: str = "offline"
    special_instructions: str = ""


class OrderCreateOut(Schema):
    success: bool = True
    order_id: int
    status: str
    delivery_type: str
    scheduled_time: str
    total_amount: float


class OrderLineOut(Schema):
    name: str
    quantity: int
    price: float


class OrderStatusOut(Schema):
    order_id: int
    status: str
    eta: str
    delivery_type: str
    hotel_name: str
    hotel_phone: str
    hotel_address: str
    hotel_map_url: str
    hotel_coordinates: dict | None
    user_coordinates: dict | None
    user_address: str
    total_amount: float
    payment_method: str
    can_cancel: bool
    placed_at: str
    accepted_at: str | None
    completed_at: str | None
    items: list[OrderLineOut]
    special_instructions: str


class OrderHistoryOut(Schema):
    id: int
    hotel_id: int
    hotel_name: str
    order_date: str
    scheduled_time: str
    status: str
    items_summary: str
    items: list[OrderLineOut]
    total_amount: float
    payment_method: str
    delivery_type: str
    can_cancel: bool
    has_review: bool


class OrderHistoryPage(Schema):
    results: list[OrderHistoryOut]
    current_page: int
    total_pages: int
    total_count: int


class ReviewIn(Schema):
    rating: int
    comment: str = ""


class QueueCardOut(Schema):
    id: int
    customer_name: str
    customer_phone: str
    items: list[OrderLineOut]
    delivery_type: str
    address: str
    scheduled_time: str
    placed_at: str
    total_price: float
    status: str
    special_instructions: str
    map_url: str


class QueueOut(Schema):
    incoming: list[QueueCardOut]
    preparing: list[QueueCardOut]
    ready: list[QueueCardOut]
    completed: list[QueueCardOut]


class StatusUpdateIn(Schema):
    status: str
    rejection_reason: str = ""


class KPIOut(Schema):
    today_revenue: float
    active_orders_count: int
    scheduled_orders_count: int
    active_deliveries_count: int
    weekly_sales_trend: list[dict]


class TopItemOut(Schema):
    name: str
    qty_sold: int
    revenue: float
    rating: float


class SalesReportOut(Schema):
    total_sales: float
    avg_order_value: float
    total_orders: int
    top_items: list[TopItemOut]
    daily_series: list[dict]
