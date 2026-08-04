from datetime import date as date_cls, datetime

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from parkinglots.models import ParkingSlot

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    parking_name = serializers.CharField(source="slot.floor.location.name", read_only=True)
    parking_address = serializers.CharField(source="slot.floor.location.address", read_only=True)
    parking_id = serializers.IntegerField(source="slot.floor.location.id", read_only=True)
    latitude = serializers.DecimalField(source="slot.floor.location.latitude", max_digits=9, decimal_places=6, read_only=True)
    longitude = serializers.DecimalField(source="slot.floor.location.longitude", max_digits=9, decimal_places=6, read_only=True)
    floor_id = serializers.IntegerField(source="slot.floor.id", read_only=True)
    floor_name = serializers.CharField(source="slot.floor.name", read_only=True)
    slot_code = serializers.CharField(source="slot.code", read_only=True)
    vehicle_plate = serializers.CharField(source="vehicle.plate_number", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "booking_code", "parking_id", "parking_name", "parking_address",
            "latitude", "longitude", "floor_id", "floor_name", "slot", "slot_code",
            "vehicle", "vehicle_plate", "date", "start_time", "end_time", "amount",
            "status", "payment_status", "payment_method", "parked_at", "found_car", "created_at",
        ]
        read_only_fields = [
            "id", "booking_code", "amount", "status", "payment_status", "payment_method",
            "parked_at", "found_car", "created_at",
        ]


class BookingCreateSerializer(serializers.ModelSerializer):
    payment_method = serializers.ChoiceField(choices=Booking.PAYMENT_METHOD_CHOICES, write_only=True)

    class Meta:
        model = Booking
        fields = ["vehicle", "slot", "date", "start_time", "end_time", "payment_method"]

    def validate_date(self, value):
        if value < date_cls.today():
            raise serializers.ValidationError("Booking date cannot be in the past.")
        return value

    def validate(self, attrs):
        request = self.context["request"]

        vehicle = attrs["vehicle"]
        if vehicle.owner_id != request.user.id:
            raise serializers.ValidationError({"vehicle": "This vehicle does not belong to you."})

        if attrs["end_time"] <= attrs["start_time"]:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})

        now = timezone.localtime()
        if attrs["date"] == now.date() and attrs["start_time"] < now.time():
            raise serializers.ValidationError({"start_time": "Entry time cannot be in the past."})

        slot = attrs["slot"]
        if slot.status != ParkingSlot.AVAILABLE:
            raise serializers.ValidationError({"slot": "This slot is no longer available."})

        return attrs

    def create(self, validated_data):
        slot = validated_data["slot"]
        location = slot.floor.location
        payment_method = validated_data.pop("payment_method")

        start = datetime.combine(validated_data["date"], validated_data["start_time"])
        end = datetime.combine(validated_data["date"], validated_data["end_time"])
        hours = max((end - start).total_seconds() / 3600, 0.5)
        amount = min(round(float(location.price_per_hour) * hours, 2), float(location.price_day_max))

        with transaction.atomic():
            locked_slot = ParkingSlot.objects.select_for_update().get(pk=slot.pk)
            if locked_slot.status != ParkingSlot.AVAILABLE:
                raise serializers.ValidationError({"slot": "This slot is no longer available."})

            # Payment is validated client-side and simulated (no gateway connected
            # yet) — by the time this call is made the user has already completed
            # the payment step, so the booking is created already paid.
            booking = Booking.objects.create(
                user=self.context["request"].user,
                amount=amount,
                payment_status=Booking.PAYMENT_PAID,
                payment_method=payment_method,
                paid_at=timezone.now(),
                **validated_data,
            )
            locked_slot.status = ParkingSlot.BOOKED
            locked_slot.save(update_fields=["status"])

        return booking
