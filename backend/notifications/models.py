from django.conf import settings
from django.db import models


class Notification(models.Model):
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_REMINDER = "booking_reminder"
    PARKING_EXPIRY = "parking_expiry"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    SLOT_UPDATE = "slot_update"
    SYSTEM = "system"
    TYPE_CHOICES = [
        (BOOKING_CONFIRMED, "Booking Confirmed"),
        (BOOKING_CANCELLED, "Booking Cancelled"),
        (BOOKING_REMINDER, "Upcoming Booking Reminder"),
        (PARKING_EXPIRY, "Parking Expiry Reminder"),
        (PAYMENT_SUCCESS, "Payment Successful"),
        (PAYMENT_FAILED, "Payment Failed"),
        (SLOT_UPDATE, "Slot Availability Update"),
        (SYSTEM, "System Announcement"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="notifications", on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=SYSTEM)
    title = models.CharField(max_length=150)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} -> {self.user.email}"
