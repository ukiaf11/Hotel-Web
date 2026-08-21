from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    CUSTOMER = "customer", "Customer"
    DISTRIBUTOR = "distributor", "Distributor"
    ADMIN = "admin", "Admin"
    MANAGER = "manager", "Manager"
    COOK = "cook", "Kitchen Staff"
    COURIER = "courier", "Delivery Agent"


#: Roles that operate inside a distributor workspace (doc 15 permission matrix).
STAFF_ROLES = {Role.MANAGER, Role.COOK, Role.COURIER}
DISTRIBUTOR_SIDE_ROLES = {Role.DISTRIBUTOR, *STAFF_ROLES}


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Users must have an email address")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=120)
    phone_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    #: set for sub-accounts (manager/cook/courier) that belong to a hotel workspace
    hotel = models.ForeignKey(
        "hotels.Hotel", null=True, blank=True, on_delete=models.CASCADE, related_name="staff"
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.name} <{self.email}>"

    @property
    def is_distributor_side(self) -> bool:
        return self.role in DISTRIBUTOR_SIDE_ROLES

    def owned_hotel(self):
        """The hotel this account manages, whether as owner or as a sub-account."""
        if self.hotel_id:
            return self.hotel
        return getattr(self, "hotel_profile", None)


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=40, default="Home")
    address_line = models.TextField()
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "id"]
        verbose_name_plural = "addresses"

    def __str__(self):
        return f"{self.label}: {self.address_line[:40]}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            Address.objects.filter(user=self.user).exclude(pk=self.pk).update(is_default=False)
