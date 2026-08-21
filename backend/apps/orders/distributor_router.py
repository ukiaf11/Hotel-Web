"""Distributor-side order operations: queue, KPIs and sales analytics (docs 09, 13, 14)."""

import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from apps.authentication.jwt_auth import current_hotel, distributor_auth, manager_auth
from apps.authentication.models import Role
from apps.authentication.schemas import MessageOut
from apps.notifications.services import notify

from .models import Order, Review
from .schemas import KPIOut, QueueOut, SalesReportOut, StatusUpdateIn
from .services import queue_payload

router = Router(tags=["distributor-orders"])

#: Legal transitions of the order state machine (doc 05).
TRANSITIONS = {
    Order.Status.PLACED: {Order.Status.ACCEPTED, Order.Status.CANCELLED},
    Order.Status.ACCEPTED: {Order.Status.PREPARING, Order.Status.CANCELLED},
    Order.Status.PREPARING: {Order.Status.OUT_FOR_DELIVERY, Order.Status.READY_FOR_PICKUP},
    Order.Status.OUT_FOR_DELIVERY: {Order.Status.COMPLETED},
    Order.Status.READY_FOR_PICKUP: {Order.Status.COMPLETED},
}

CUSTOMER_COPY = {
    Order.Status.ACCEPTED: "has been accepted and scheduled by the kitchen.",
    Order.Status.PREPARING: "is now being prepared.",
    Order.Status.OUT_FOR_DELIVERY: "is out for delivery.",
    Order.Status.READY_FOR_PICKUP: "is ready for pickup at the counter.",
    Order.Status.COMPLETED: "has been completed. Thank you!",
    Order.Status.CANCELLED: "was cancelled by the hotel.",
}


@router.get("/", response=QueueOut, auth=distributor_auth)
def queue(request):
    hotel = current_hotel(request)
    horizon = timezone.now() - timedelta(days=3)
    orders = (
        Order.objects.filter(hotel=hotel)
        .filter(status__in=Order.ACTIVE_STATUSES)
        .select_related("buyer")
        .order_by("scheduled_date", "scheduled_slot")
    )
    closed = (
        Order.objects.filter(
            hotel=hotel,
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED],
            updated_at__gte=horizon,
        )
        .select_related("buyer")
        .order_by("-updated_at")[:20]
    )

    lanes = {"incoming": [], "preparing": [], "ready": [], "completed": []}
    for order in orders:
        card = queue_payload(order)
        if order.status == Order.Status.PLACED:
            lanes["incoming"].append(card)
        elif order.status in {Order.Status.ACCEPTED, Order.Status.PREPARING}:
            lanes["preparing"].append(card)
        else:
            lanes["ready"].append(card)
    lanes["completed"] = [queue_payload(order) for order in closed]
    return lanes


@router.post("/{order_id}/update-status/", response=MessageOut, auth=distributor_auth)
def update_status(request, order_id: int, payload: StatusUpdateIn):
    hotel = current_hotel(request)
    order = get_object_or_404(Order, pk=order_id, hotel=hotel)
    target = payload.status

    if request.user.role == Role.COURIER and target not in {
        Order.Status.OUT_FOR_DELIVERY,
        Order.Status.COMPLETED,
    }:
        raise HttpError(403, "Delivery agents may only dispatch and complete orders.")
    if target not in TRANSITIONS.get(order.status, set()):
        raise HttpError(
            409, f"An order that is '{order.get_status_display()}' cannot move to '{target}'."
        )
    if target == Order.Status.OUT_FOR_DELIVERY and order.delivery_type != Order.DeliveryType.DELIVERY:
        target = Order.Status.READY_FOR_PICKUP
    if target == Order.Status.READY_FOR_PICKUP and order.delivery_type == Order.DeliveryType.DELIVERY:
        target = Order.Status.OUT_FOR_DELIVERY

    order.status = target
    if target == Order.Status.ACCEPTED:
        order.accepted_at = timezone.now()
    if target == Order.Status.COMPLETED:
        order.completed_at = timezone.now()
    if target == Order.Status.CANCELLED:
        order.rejection_reason = payload.rejection_reason
    order.save()

    body = f"Order #{order.id} {CUSTOMER_COPY.get(target, 'was updated.')}"
    if target == Order.Status.CANCELLED and payload.rejection_reason:
        body += f" Reason: {payload.rejection_reason}"
    notify(order.buyer, "Order update", body, kind="order", link=f"/orders/track/{order.id}")
    return MessageOut(message="Order updated.")


@router.get("/dashboard-stats/", response=KPIOut, auth=distributor_auth)
def dashboard_stats(request):
    hotel = current_hotel(request)
    today = timezone.localdate()
    orders = Order.objects.filter(hotel=hotel)

    revenue = orders.filter(
        status=Order.Status.COMPLETED, completed_at__date=today
    ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0")

    trend = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        day_total = orders.filter(
            status=Order.Status.COMPLETED, completed_at__date=day
        ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
        trend.append({"day": day.strftime("%a"), "date": day.isoformat(), "sales": float(day_total)})

    return {
        "today_revenue": float(revenue),
        "active_orders_count": orders.filter(
            status__in=[Order.Status.PLACED, Order.Status.ACCEPTED, Order.Status.PREPARING]
        ).count(),
        "scheduled_orders_count": orders.filter(
            scheduled_date__gt=today, status__in=Order.ACTIVE_STATUSES
        ).count(),
        "active_deliveries_count": orders.filter(status=Order.Status.OUT_FOR_DELIVERY).count(),
        "weekly_sales_trend": trend,
    }


def _report_window(start_date: str, end_date: str):
    today = timezone.localdate()
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else today - timedelta(days=6)
        end = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else today
    except ValueError:
        raise HttpError(400, "Dates must be formatted as YYYY-MM-DD.")
    if start > end:
        start, end = end, start
    return start, end


def _report_data(hotel, start, end) -> dict:
    orders = Order.objects.filter(
        hotel=hotel, status=Order.Status.COMPLETED, completed_at__date__range=(start, end)
    ).prefetch_related("items")

    totals = orders.aggregate(total=Sum("total_amount"), count=Count("id"))
    total_sales = float(totals["total"] or 0)
    total_orders = totals["count"] or 0

    ratings = defaultdict(list)
    for review in Review.objects.filter(hotel=hotel).select_related("order"):
        for line in review.order.items.all():
            ratings[line.name].append(review.rating)

    buckets: dict[str, dict] = {}
    daily: dict[str, float] = {
        (start + timedelta(days=i)).isoformat(): 0.0 for i in range((end - start).days + 1)
    }
    for order in orders:
        key = timezone.localtime(order.completed_at).date().isoformat()
        if key in daily:
            daily[key] += float(order.total_amount)
        for line in order.items.all():
            bucket = buckets.setdefault(line.name, {"name": line.name, "qty_sold": 0, "revenue": 0.0})
            bucket["qty_sold"] += line.quantity
            bucket["revenue"] += float(line.line_total)

    top_items = sorted(buckets.values(), key=lambda row: row["revenue"], reverse=True)[:10]
    for row in top_items:
        stars = ratings.get(row["name"], [])
        row["rating"] = round(sum(stars) / len(stars), 1) if stars else 0.0

    return {
        "total_sales": round(total_sales, 2),
        "avg_order_value": round(total_sales / total_orders, 2) if total_orders else 0.0,
        "total_orders": total_orders,
        "top_items": top_items,
        "daily_series": [{"date": day, "sales": round(value, 2)} for day, value in daily.items()],
    }


@router.get("/reports/sales/", response=SalesReportOut, auth=manager_auth)
def sales_report(request, start_date: str = "", end_date: str = ""):
    start, end = _report_window(start_date, end_date)
    return _report_data(current_hotel(request), start, end)


@router.get("/reports/export/", auth=manager_auth)
def export_report(request, start_date: str = "", end_date: str = "", format: str = "csv"):
    hotel = current_hotel(request)
    start, end = _report_window(start_date, end_date)
    data = _report_data(hotel, start, end)

    if format == "pdf":
        from .reports import render_report_pdf

        payload = render_report_pdf(hotel, start, end, data)
        response = HttpResponse(payload, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="sales-{start}-to-{end}.pdf"'
        return response

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([f"Sales report — {hotel.name}", f"{start} to {end}"])
    writer.writerow([])
    writer.writerow(["Total sales", data["total_sales"]])
    writer.writerow(["Total orders", data["total_orders"]])
    writer.writerow(["Average ticket", data["avg_order_value"]])
    writer.writerow([])
    writer.writerow(["Item", "Units sold", "Revenue", "Rating"])
    for row in data["top_items"]:
        writer.writerow([row["name"], row["qty_sold"], row["revenue"], row["rating"]])
    writer.writerow([])
    writer.writerow(["Date", "Sales"])
    for row in data["daily_series"]:
        writer.writerow([row["date"], row["sales"]])

    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="sales-{start}-to-{end}.csv"'
    return response
