import random
import string
from datetime import datetime

from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_booking_code():
    return "SPK" + "".join(random.choices(string.digits, k=5))


class Booking(models.Model):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (UPCOMING, "Upcoming"),
        (ACTIVE, "Active"),
        (COMPLETED, "Completed"),
        (CANCELLED, "Cancelled"),
    ]

    PAYMENT_PENDING = "pending"
    PAYMENT_PAID = "paid"
    PAYMENT_FAILED = "failed"
    PAYMENT_REFUNDED = "refunded"
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_PENDING, "Pending"),
        (PAYMENT_PAID, "Paid"),
        (PAYMENT_FAILED, "Failed"),
        (PAYMENT_REFUNDED, "Refunded"),
    ]
    PAYMENT_METHOD_CHOICES = [
        ("upi", "UPI"),
        ("qr", "QR Code"),
        ("card", "Credit/Debit Card"),
        ("netbanking", "Net Banking"),
        ("free", "Free Parking"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="bookings", on_delete=models.CASCADE)
    vehicle = models.ForeignKey("vehicles.Vehicle", related_name="bookings", on_delete=models.PROTECT)
    slot = models.ForeignKey("parkinglots.ParkingSlot", related_name="bookings", on_delete=models.PROTECT)
    booking_code = models.CharField(max_length=12, unique=True, default=generate_booking_code)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=UPCOMING)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_PENDING)
    payment_method = models.CharField(max_length=12, choices=PAYMENT_METHOD_CHOICES, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    parked_at = models.DateTimeField(null=True, blank=True)
    found_car = models.BooleanField(default=False)
    reminder_sent = models.BooleanField(default=False)
    expiry_alert_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.booking_code} - {self.user.email}"

    def refresh_status(self):
        if self.status in (self.CANCELLED, self.COMPLETED):
            return self.status

        now = timezone.localtime()
        start_dt = timezone.make_aware(datetime.combine(self.date, self.start_time))
        end_dt = timezone.make_aware(datetime.combine(self.date, self.end_time))

        new_status = self.status
        if now > end_dt:
            new_status = self.COMPLETED
        elif start_dt <= now <= end_dt:
            new_status = self.ACTIVE
        else:
            new_status = self.UPCOMING

        if new_status != self.status:
            self.status = new_status
            if new_status == self.COMPLETED:
                self.slot.status = self.slot.__class__.AVAILABLE
                self.slot.save(update_fields=["status"])
            self.save(update_fields=["status", "updated_at"])
        return self.status

    def check_alerts(self):
        """Lazily fire reminder/expiry notifications when polled, without needing a background worker."""
        from notifications.utils import notify
        from notifications.models import Notification

        if self.status not in (self.UPCOMING, self.ACTIVE):
            return

        now = timezone.localtime()
        start_dt = timezone.make_aware(datetime.combine(self.date, self.start_time))
        end_dt = timezone.make_aware(datetime.combine(self.date, self.end_time))

        if self.status == self.UPCOMING and not self.reminder_sent:
            minutes_to_start = (start_dt - now).total_seconds() / 60
            if 0 < minutes_to_start <= 30:
                notify(
                    self.user,
                    Notification.BOOKING_REMINDER,
                    "Upcoming Booking Reminder",
                    f"Your booking at {self.slot.floor.location.name} (Slot {self.slot.code}) starts at {self.start_time.strftime('%I:%M %p')}.",
                )
                self.reminder_sent = True
                self.save(update_fields=["reminder_sent"])

        if self.status == self.ACTIVE and not self.expiry_alert_sent:
            minutes_to_end = (end_dt - now).total_seconds() / 60
            if 0 < minutes_to_end <= 15:
                notify(
                    self.user,
                    Notification.PARKING_EXPIRY,
                    "Parking Expiring Soon",
                    f"Your parking at {self.slot.floor.location.name} (Slot {self.slot.code}) expires at {self.end_time.strftime('%I:%M %p')}.",
                )
                self.expiry_alert_sent = True
                self.save(update_fields=["expiry_alert_sent"])
