from ninja import Schema


class NotificationOut(Schema):
    id: int
    title: str
    body: str
    type: str
    link: str
    is_read: bool
    created_at: str


class MarkReadIn(Schema):
    notification_ids: list[int] = []
