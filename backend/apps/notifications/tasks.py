from celery import shared_task

from .email import send_order_emails


@shared_task(bind=True, max_retries=3, default_retry_delay=30, ignore_result=True)
def send_order_emails_task(self, order_id: int) -> int:
    """Retry a few times on transient SMTP trouble, then give up quietly."""
    try:
        return send_order_emails(order_id)
    except Exception as exc:  # noqa: BLE001
        raise self.retry(exc=exc)
