from rest_framework import serializers

from .models import Booking


class OwnerBookingListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="user.full_name", read_only=True)
    vehicle_plate = serializers.CharField(source="vehicle.plate_number", read_only=True)
    vehicle_type = serializers.CharField(source="vehicle.vehicle_type", read_only=True)
    parking_name = serializers.CharField(source="slot.floor.location.name", read_only=True)
    parking_id = serializers.IntegerField(source="slot.floor.location.id", read_only=True)
    floor_name = serializers.CharField(source="slot.floor.name", read_only=True)
    slot_code = serializers.CharField(source="slot.code", read_only=True)
    duration_hours = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "booking_code", "customer_name", "vehicle_plate", "vehicle_type",
            "parking_id", "parking_name", "floor_name", "slot_code",
            "date", "start_time", "end_time", "duration_hours", "amount",
            "payment_status", "status", "created_at",
        ]

    def get_duration_hours(self, obj):
        start = obj.start_time.hour * 60 + obj.start_time.minute
        end = obj.end_time.hour * 60 + obj.end_time.minute
        return round(max(end - start, 0) / 60, 1)


class OwnerBookingDetailSerializer(OwnerBookingListSerializer):
    customer_phone = serializers.CharField(source="user.phone", read_only=True)
    customer_email = serializers.CharField(source="user.email", read_only=True)
    parking_address = serializers.CharField(source="slot.floor.location.address", read_only=True)
    payment_method = serializers.CharField(read_only=True)

    class Meta(OwnerBookingListSerializer.Meta):
        fields = OwnerBookingListSerializer.Meta.fields + [
            "customer_phone", "customer_email", "parking_address", "payment_method",
        ]


class OwnerPaymentHistorySerializer(serializers.ModelSerializer):
    # No real payment gateway exists (payments are simulated app-wide) — the
    # already-unique booking_code doubles as both payment ID and transaction ID.
    payment_id = serializers.CharField(source="booking_code", read_only=True)
    transaction_id = serializers.CharField(source="booking_code", read_only=True)
    customer_name = serializers.CharField(source="user.full_name", read_only=True)
    vehicle_number = serializers.CharField(source="vehicle.plate_number", read_only=True)
    parking_facility = serializers.CharField(source="slot.floor.location.name", read_only=True)
    payment_date = serializers.DateTimeField(source="paid_at", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "payment_id", "booking_code", "transaction_id", "customer_name", "vehicle_number",
            "parking_facility", "amount", "payment_method", "payment_status", "payment_date",
        ]
