from rest_framework import serializers

from .models import ParkingFloor, ParkingImage, ParkingLocation, ParkingSlot


class OwnerParkingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingImage
        fields = ["id", "image", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]


class OwnerParkingFloorSerializer(serializers.ModelSerializer):
    total_slots = serializers.IntegerField(read_only=True)
    available_slots = serializers.IntegerField(read_only=True)

    class Meta:
        model = ParkingFloor
        fields = ["id", "name", "level", "total_slots", "available_slots"]


class OwnerParkingSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingSlot
        fields = ["id", "code", "row", "col", "status", "vehicle_type"]


class OwnerSlotGenerateSerializer(serializers.Serializer):
    prefix = serializers.CharField(max_length=6, allow_blank=True, required=False, default="")
    rows = serializers.IntegerField(min_value=1, max_value=50)
    cols = serializers.IntegerField(min_value=1, max_value=50)
    vehicle_type = serializers.ChoiceField(choices=ParkingSlot.VEHICLE_TYPE_CHOICES, default=ParkingSlot.CAR)

    def validate(self, attrs):
        if attrs["rows"] * attrs["cols"] > 500:
            raise serializers.ValidationError("Cannot generate more than 500 slots at once.")
        return attrs


class OwnerParkingLocationSerializer(serializers.ModelSerializer):
    total_slots = serializers.IntegerField(read_only=True)
    available_slots = serializers.IntegerField(read_only=True)
    gallery_images = OwnerParkingImageSerializer(many=True, read_only=True)
    floors = OwnerParkingFloorSerializer(many=True, read_only=True)
    # Only meaningful for Open Ground locations — drives auto-provisioning of
    # generic slots instead of the owner picking floors/slots manually.
    total_capacity = serializers.IntegerField(write_only=True, required=False, min_value=1)

    class Meta:
        model = ParkingLocation
        fields = [
            "id", "name", "description", "category", "parking_mode", "csv_ref",
            "address", "city", "district", "state", "country", "pincode",
            "latitude", "longitude", "google_maps_url",
            "opens_at", "closes_at", "is_24_hours", "available_days",
            "contact_number", "contact_email",
            "vehicle_types", "price_per_hour", "price_day_max", "monthly_price",
            "amenities", "image",
            "total_capacity", "total_slots", "available_slots",
            "gallery_images", "floors", "created_at",
        ]
        read_only_fields = ["id", "google_maps_url", "created_at"]

    def validate(self, attrs):
        parking_mode = attrs.get(
            "parking_mode", getattr(self.instance, "parking_mode", ParkingLocation.SLOT_BASED)
        )
        if parking_mode == ParkingLocation.OPEN_GROUND:
            if self.instance is None and attrs.get("total_capacity") is None:
                raise serializers.ValidationError(
                    {"total_capacity": "Total capacity is required for Open Ground parking."}
                )

        is_24_hours = attrs.get("is_24_hours", getattr(self.instance, "is_24_hours", False))
        if not is_24_hours:
            opens_at = attrs.get("opens_at", getattr(self.instance, "opens_at", None))
            closes_at = attrs.get("closes_at", getattr(self.instance, "closes_at", None))
            if opens_at and closes_at and opens_at >= closes_at:
                raise serializers.ValidationError({"closes_at": "Closing time must be after opening time."})

        return attrs

    def create(self, validated_data):
        total_capacity = validated_data.pop("total_capacity", None)
        validated_data["owner"] = self.context["request"].user
        validated_data["parking_type"] = ParkingLocation.PRIVATE
        location = ParkingLocation.objects.create(**validated_data)
        if location.parking_mode == ParkingLocation.OPEN_GROUND:
            self._provision_open_ground_slots(location, total_capacity)
        return location

    def update(self, instance, validated_data):
        total_capacity = validated_data.pop("total_capacity", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if instance.parking_mode == ParkingLocation.OPEN_GROUND and total_capacity is not None:
            self._resize_open_ground_slots(instance, total_capacity)
        return instance

    @staticmethod
    def _provision_open_ground_slots(location, capacity):
        floor = ParkingFloor.objects.create(location=location, name="Ground Level", level=0)
        slots = [
            ParkingSlot(floor=floor, code=f"S{i}", row=0, col=i, status=ParkingSlot.AVAILABLE)
            for i in range(1, capacity + 1)
        ]
        ParkingSlot.objects.bulk_create(slots)

    @staticmethod
    def _resize_open_ground_slots(location, new_capacity):
        floor = location.floors.first()
        if floor is None:
            OwnerParkingLocationSerializer._provision_open_ground_slots(location, new_capacity)
            return

        current = floor.slots.count()
        if new_capacity > current:
            slots = [
                ParkingSlot(floor=floor, code=f"S{i}", row=0, col=i, status=ParkingSlot.AVAILABLE)
                for i in range(current + 1, new_capacity + 1)
            ]
            ParkingSlot.objects.bulk_create(slots)
        elif new_capacity < current:
            available_count = floor.slots.filter(status=ParkingSlot.AVAILABLE).count()
            occupied_count = current - available_count
            if new_capacity < occupied_count:
                raise serializers.ValidationError(
                    {
                        "total_capacity": (
                            f"Cannot reduce capacity below {occupied_count} — that many spaces are "
                            "currently occupied or reserved."
                        )
                    }
                )
            to_remove = current - new_capacity
            removable_ids = list(
                floor.slots.filter(status=ParkingSlot.AVAILABLE)
                .order_by("-col")
                .values_list("pk", flat=True)[:to_remove]
            )
            ParkingSlot.objects.filter(pk__in=removable_ids).delete()
