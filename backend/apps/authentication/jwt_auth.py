"""JWT issuing/verification plus the django-ninja auth guards used across routers."""

from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from ninja.errors import HttpError
from ninja.security import HttpBearer

from .models import DISTRIBUTOR_SIDE_ROLES, Role, User


def _encode(payload: dict, ttl: timedelta, token_type: str) -> str:
    now = datetime.now(tz=timezone.utc)
    body = {**payload, "type": token_type, "iat": now, "exp": now + ttl}
    return jwt.encode(body, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def issue_tokens(user: User) -> dict:
    claims = {"user_id": user.id, "role": user.role, "email": user.email}
    return {
        "access": _encode(claims, timedelta(minutes=settings.JWT_ACCESS_TTL_MINUTES), "access"),
        "refresh": _encode(
            {"user_id": user.id}, timedelta(days=settings.JWT_REFRESH_TTL_DAYS), "refresh"
        ),
    }


def decode_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HttpError(401, "Session expired. Please sign in again.")
    except jwt.PyJWTError:
        raise HttpError(401, "Invalid authentication token.")
    if payload.get("type") != expected_type:
        raise HttpError(401, "Invalid token type.")
    return payload


class JWTAuth(HttpBearer):
    """Base guard: any authenticated, active account."""

    allowed_roles: set[str] | None = None

    def authenticate(self, request, token):
        payload = decode_token(token)
        user = User.objects.filter(pk=payload.get("user_id"), is_active=True).first()
        if not user:
            raise HttpError(401, "Account not found or deactivated.")
        if self.allowed_roles is not None and user.role not in self.allowed_roles:
            raise HttpError(403, "Your role does not have access to this resource.")
        request.user = user
        return user


class DistributorAuth(JWTAuth):
    """Hotel owner or any of its sub-accounts (manager / cook / courier)."""

    allowed_roles = DISTRIBUTOR_SIDE_ROLES


class ManagerAuth(JWTAuth):
    """Owner or manager only — menu, logistics, staff and report mutations."""

    allowed_roles = {Role.DISTRIBUTOR, Role.MANAGER}


class AdminAuth(JWTAuth):
    allowed_roles = {Role.ADMIN}


any_auth = JWTAuth()
distributor_auth = DistributorAuth()
manager_auth = ManagerAuth()
admin_auth = AdminAuth()


def current_hotel(request):
    """Resolve the hotel workspace for the authenticated distributor-side user."""
    hotel = request.user.owned_hotel()
    if hotel is None:
        raise HttpError(404, "No hotel profile is linked to this account yet.")
    return hotel
