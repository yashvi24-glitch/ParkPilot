from django.conf import settings
from django.db import models


class Vehicle(models.Model):
    CAR = "car"
    BIKE = "bike"
    VEHICLE_TYPE_CHOICES = [(CAR, "Car"), (BIKE, "Bike")]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="vehicles", on_delete=models.CASCADE)
    plate_number = models.CharField(max_length=20)
    vehicle_type = models.CharField(max_length=10, choices=VEHICLE_TYPE_CHOICES, default=CAR)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["owner", "plate_number"]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.plate_number} ({self.owner.email})"
