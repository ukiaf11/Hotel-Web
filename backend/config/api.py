"""Root django-ninja API. Every route lives under /api/v1/ (doc 20)."""

from django.http import Http404
from ninja import NinjaAPI
from ninja.errors import HttpError, ValidationError

from apps.authentication.router import router as auth_router
from apps.authentication.router import staff_router
from apps.console.models import SiteConfig
from apps.console.router import router as admin_router
from apps.hotels.router import distributor_router
from apps.hotels.router import router as hotels_router
from apps.menu.router import router as menu_router
from apps.notifications.router import router as notifications_router
from apps.orders.distributor_router import router as distributor_orders_router
from apps.orders.router import router as orders_router
from apps.support.router import router as support_router

api = NinjaAPI(
    title="Hotel Ordering Platform API",
    version="1.0.0",
    description="Customer, distributor and admin surface for the Hotel Express platform.",
)

api.add_router("/auth/", auth_router)
api.add_router("/hotels/", hotels_router)
api.add_router("/orders/", orders_router)
api.add_router("/notifications/", notifications_router)
api.add_router("/support/", support_router)
api.add_router("/admin/", admin_router)

# Distributor workspace
api.add_router("/distributor/", distributor_router)
api.add_router("/distributor/menu/", menu_router)
api.add_router("/distributor/orders/", distributor_orders_router)
api.add_router("/distributor/staff/", staff_router)


@api.get("/public/config/", tags=["public"])
def public_config(request):
    config = SiteConfig.load()
    return {
        "maintenance_mode": config.maintenance_mode,
        "maintenance_message": config.maintenance_message,
        "allow_registrations": config.allow_registrations,
    }


@api.get("/health/", tags=["public"])
def health(request):
    return {"status": "ok"}


@api.exception_handler(ValidationError)
def on_validation_error(request, exc):
    """Collapse pydantic errors into a single human-readable `detail` string."""
    messages = []
    for error in exc.errors:
        field = error.get("loc", ["field"])[-1]
        message = error.get("msg", "is invalid").replace("Value error, ", "")
        messages.append(message if message.endswith(".") else f"{field}: {message}")
    return api.create_response(request, {"detail": " ".join(messages)}, status=422)


@api.exception_handler(Http404)
def on_not_found(request, exc):
    return api.create_response(request, {"detail": "Resource not found."}, status=404)


@api.exception_handler(HttpError)
def on_http_error(request, exc):
    return api.create_response(request, {"detail": str(exc)}, status=exc.status_code)
