from ninja import Schema


class FAQOut(Schema):
    id: int
    question: str
    answer: str
    category: str


class TicketMessageOut(Schema):
    sender: str
    message: str
    timestamp: str


class TicketOut(Schema):
    id: int
    subject: str
    message: str
    order_id: int | None
    status: str
    created_at: str
    updated_at: str
    responses: list[TicketMessageOut]


class TicketIn(Schema):
    subject: str
    message: str
    order_id: int | None = None


class TicketReplyIn(Schema):
    message: str
