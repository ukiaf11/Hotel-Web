from ninja import Schema
from pydantic import EmailStr, field_validator

PASSWORD_RULE = "Password must be at least 8 characters and include an uppercase letter and a digit."


class UserOut(Schema):
    id: int
    email: str
    name: str
    role: str
    phone_number: str = ""


class TokenOut(Schema):
    access: str
    refresh: str
    user: UserOut


class LoginIn(Schema):
    email: EmailStr
    password: str


class RegisterIn(Schema):
    name: str
    email: EmailStr
    phone: str = ""
    password: str
    role: str = "customer"
    hotel_name: str | None = None
    hotel_address: str | None = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if (
            len(value) < 8
            or not any(c.isupper() for c in value)
            or not any(c.isdigit() for c in value)
        ):
            raise ValueError(PASSWORD_RULE)
        return value

    @field_validator("role")
    @classmethod
    def known_role(cls, value: str) -> str:
        if value not in {"customer", "distributor"}:
            raise ValueError("Role must be either 'customer' or 'distributor'.")
        return value

    @field_validator("phone")
    @classmethod
    def phone_digits(cls, value: str) -> str:
        digits = [c for c in value if c.isdigit()]
        if value and not 10 <= len(digits) <= 15:
            raise ValueError("Phone number must contain between 10 and 15 digits.")
        return value


class RefreshIn(Schema):
    refresh: str


class ProfileUpdateIn(Schema):
    name: str
    phone_number: str = ""


class PasswordChangeIn(Schema):
    old_password: str
    new_password: str


class AddressIn(Schema):
    label: str = "Home"
    address_line: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool = False


class AddressOut(Schema):
    id: int
    label: str
    address_line: str
    latitude: float | None
    longitude: float | None
    is_default: bool


class StaffIn(Schema):
    name: str
    email: EmailStr
    phone_number: str = ""
    password: str | None = None
    role: str = "cook"


class StaffOut(Schema):
    id: int
    name: str
    email: str
    phone_number: str
    role: str
    is_active: bool


class MessageOut(Schema):
    success: bool = True
    message: str = ""
