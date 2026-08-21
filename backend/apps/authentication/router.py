from django.contrib.auth import authenticate
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.crypto import get_random_string
from ninja import Router
from ninja.errors import HttpError

from apps.hotels.models import Hotel

from .jwt_auth import (
    any_auth,
    current_hotel,
    decode_token,
    distributor_auth,
    issue_tokens,
    manager_auth,
)
from .models import Address, Role, User
from .schemas import (
    AddressIn,
    AddressOut,
    LoginIn,
    MessageOut,
    PasswordChangeIn,
    ProfileUpdateIn,
    RefreshIn,
    RegisterIn,
    StaffIn,
    StaffOut,
    TokenOut,
    UserOut,
)

router = Router(tags=["auth"])


@router.post("/register/", response=TokenOut)
def register(request, payload: RegisterIn):
    email = payload.email.lower()
    if User.objects.filter(email__iexact=email).exists():
        raise HttpError(409, "An account with this email already exists.")

    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            password=payload.password,
            name=payload.name.strip(),
            phone_number=payload.phone,
            role=payload.role,
        )
        if payload.role == Role.DISTRIBUTOR:
            Hotel.objects.create(
                owner=user,
                name=payload.hotel_name or f"{payload.name}'s Kitchen",
                place=payload.hotel_address or "",
                contact_number=payload.phone,
                is_verified=False,
                is_online=False,
            )
    return {**issue_tokens(user), "user": user}


@router.post("/login/", response=TokenOut)
def login(request, payload: LoginIn):
    user = authenticate(request, username=payload.email.lower(), password=payload.password)
    if user is None:
        raise HttpError(401, "Incorrect email or password.")
    if not user.is_active:
        raise HttpError(403, "This account has been suspended. Contact your administrator.")
    return {**issue_tokens(user), "user": user}


@router.post("/refresh/", response=TokenOut)
def refresh(request, payload: RefreshIn):
    claims = decode_token(payload.refresh, expected_type="refresh")
    user = get_object_or_404(User, pk=claims["user_id"], is_active=True)
    return {**issue_tokens(user), "user": user}


@router.get("/me/", response=UserOut, auth=any_auth)
def me(request):
    return request.user


# --- profile ----------------------------------------------------------------


@router.put("/profile/update/", response=UserOut, auth=any_auth)
def update_profile(request, payload: ProfileUpdateIn):
    user = request.user
    user.name = payload.name.strip()
    user.phone_number = payload.phone_number
    user.save(update_fields=["name", "phone_number"])
    return user


@router.post("/profile/password/", response=MessageOut, auth=any_auth)
def change_password(request, payload: PasswordChangeIn):
    user = request.user
    if not user.check_password(payload.old_password):
        raise HttpError(400, "Your current password is incorrect.")
    if payload.old_password == payload.new_password:
        raise HttpError(400, "The new password must be different from the current one.")
    if len(payload.new_password) < 8:
        raise HttpError(400, "The new password must be at least 8 characters long.")
    user.set_password(payload.new_password)
    user.save(update_fields=["password"])
    return MessageOut(message="Password updated successfully.")


# --- address book -----------------------------------------------------------


@router.get("/addresses/", response=list[AddressOut], auth=any_auth)
def list_addresses(request):
    return request.user.addresses.all()


@router.post("/addresses/", response=AddressOut, auth=any_auth)
def create_address(request, payload: AddressIn):
    first_address = not request.user.addresses.exists()
    return Address.objects.create(
        user=request.user, **{**payload.dict(), "is_default": payload.is_default or first_address}
    )


@router.put("/addresses/{address_id}/", response=AddressOut, auth=any_auth)
def update_address(request, address_id: int, payload: AddressIn):
    address = get_object_or_404(Address, pk=address_id, user=request.user)
    for field, value in payload.dict().items():
        setattr(address, field, value)
    address.save()
    return address


@router.delete("/addresses/{address_id}/", response=MessageOut, auth=any_auth)
def delete_address(request, address_id: int):
    address = get_object_or_404(Address, pk=address_id, user=request.user)
    address.delete()
    return MessageOut(message="Address removed.")


# --- distributor staff sub-accounts (doc 15) --------------------------------

staff_router = Router(tags=["staff"])


@staff_router.get("/", response=list[StaffOut], auth=distributor_auth)
def list_staff(request):
    return current_hotel(request).staff.all().order_by("name")


@staff_router.post("/create/", response=StaffOut, auth=manager_auth)
def create_staff(request, payload: StaffIn):
    hotel = current_hotel(request)
    if payload.role not in {Role.MANAGER, Role.COOK, Role.COURIER}:
        raise HttpError(400, "Staff role must be manager, cook or courier.")
    if User.objects.filter(email__iexact=payload.email).exists():
        raise HttpError(409, "That email is already registered.")
    return User.objects.create_user(
        email=payload.email.lower(),
        password=payload.password or get_random_string(12),
        name=payload.name,
        phone_number=payload.phone_number,
        role=payload.role,
        hotel=hotel,
    )


@staff_router.put("/{staff_id}/", response=StaffOut, auth=manager_auth)
def update_staff(request, staff_id: int, payload: StaffIn):
    member = get_object_or_404(User, pk=staff_id, hotel=current_hotel(request))
    member.name = payload.name
    member.email = payload.email.lower()
    member.phone_number = payload.phone_number
    member.role = payload.role
    if payload.password:
        member.set_password(payload.password)
    member.save()
    return member


@staff_router.post("/{staff_id}/toggle/", response=StaffOut, auth=manager_auth)
def toggle_staff(request, staff_id: int):
    member = get_object_or_404(User, pk=staff_id, hotel=current_hotel(request))
    member.is_active = not member.is_active
    member.save(update_fields=["is_active"])
    return member


@staff_router.delete("/{staff_id}/", response=MessageOut, auth=manager_auth)
def delete_staff(request, staff_id: int):
    member = get_object_or_404(User, pk=staff_id, hotel=current_hotel(request))
    member.delete()
    return MessageOut(message="Staff account removed.")
