from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class OwnerManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, phone, owner_name, business_name, password=None, **extra_fields):
        if not email:
            raise ValueError("Owners must have an email address")
        if not phone:
            raise ValueError("Owners must have a phone number")
        email = self.normalize_email(email)
        owner = self.model(
            email=email, phone=phone, owner_name=owner_name, business_name=business_name, **extra_fields
        )
        owner.set_password(password)
        owner.save(using=self._db)
        return owner

    def create_superuser(self, email, phone, owner_name, business_name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, phone, owner_name, business_name, password, **extra_fields)


class Owner(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, unique=True)
    owner_name = models.CharField(max_length=150)
    business_name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    # Business information
    business_address = models.CharField(max_length=255, blank=True)
    gst_number = models.CharField(max_length=20, blank=True)
    business_registration_number = models.CharField(max_length=30, blank=True)
    business_description = models.TextField(blank=True)

    # Payment configuration — shown to owners for reference; no real fund
    # settlement is implemented anywhere in this app (payments are simulated,
    # same as the rest of ParkPilot's booking flow).
    upi_id = models.CharField(max_length=100, blank=True)
    qr_code = models.ImageField(upload_to="owner_qr_codes/", blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True)
    account_holder_name = models.CharField(max_length=150, blank=True)
    account_number = models.CharField(max_length=30, blank=True)
    ifsc_code = models.CharField(max_length=15, blank=True)

    # Explicit related_name overrides: PermissionsMixin's default reverse
    # accessors clash with accounts.User's once a second AbstractBaseUser
    # model exists in the project.
    groups = models.ManyToManyField(
        "auth.Group", related_name="owner_set", related_query_name="owner", blank=True
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission", related_name="owner_set", related_query_name="owner", blank=True
    )

    objects = OwnerManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["phone", "owner_name", "business_name"]

    def __str__(self):
        return f"{self.business_name} ({self.email})"

    @property
    def first_initial(self):
        return self.owner_name[:1].upper() if self.owner_name else "?"


class OwnerNotification(models.Model):
    BOOKING_RECEIVED = "booking_received"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_COMPLETED = "booking_completed"
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_FAILED = "payment_failed"
    FACILITY_UPDATED = "facility_updated"
    CAPACITY_REACHED = "capacity_reached"
    LIMITED_AVAILABILITY = "limited_availability"
    CSV_UPLOAD_SUCCESS = "csv_upload_success"
    CSV_UPLOAD_FAILED = "csv_upload_failed"
    IMAGES_UPDATED = "images_updated"
    DETAILS_MODIFIED = "details_modified"
    PASSWORD_CHANGED = "password_changed"
    NEW_DEVICE_LOGIN = "new_device_login"
    SYSTEM = "system"
    MAINTENANCE = "maintenance"
    TYPE_CHOICES = [
        (BOOKING_RECEIVED, "New Booking Received"),
        (BOOKING_CANCELLED, "Booking Cancelled"),
        (BOOKING_COMPLETED, "Booking Completed"),
        (PAYMENT_RECEIVED, "Payment Received"),
        (PAYMENT_FAILED, "Payment Failed"),
        (FACILITY_UPDATED, "Parking Facility Updated"),
        (CAPACITY_REACHED, "Parking Capacity Reached"),
        (LIMITED_AVAILABILITY, "Limited Parking Availability"),
        (CSV_UPLOAD_SUCCESS, "CSV Upload Successful"),
        (CSV_UPLOAD_FAILED, "CSV Upload Failed"),
        (IMAGES_UPDATED, "Parking Images Updated"),
        (DETAILS_MODIFIED, "Parking Details Modified"),
        (PASSWORD_CHANGED, "Password Changed"),
        (NEW_DEVICE_LOGIN, "Login from a New Device"),
        (SYSTEM, "System Announcement"),
        (MAINTENANCE, "Maintenance Notification"),
    ]

    owner = models.ForeignKey(Owner, related_name="notifications", on_delete=models.CASCADE)
    type = models.CharField(max_length=25, choices=TYPE_CHOICES)
    title = models.CharField(max_length=150)
    message = models.CharField(max_length=255)
    # Frontend path hint for click-to-navigate, e.g. "/owner/bookings".
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} -> {self.owner.email}"
