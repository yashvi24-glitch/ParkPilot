import re

from rest_framework import serializers

from .models import Vehicle

PLATE_RE = re.compile(r"^[A-Z0-9\- ]{4,15}$")


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ["id", "plate_number", "vehicle_type", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_plate_number(self, value):
        value = value.strip().upper()
        if not PLATE_RE.match(value):
            raise serializers.ValidationError("Enter a valid vehicle number (e.g. GJ 01 AB 1234).")
        return value
