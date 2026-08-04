from rest_framework import serializers

from .models import ParkingFloor, ParkingImage, ParkingLocation, ParkingSlot


class ParkingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingImage
        fields = ["id", "image"]


class ParkingSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingSlot
        fields = ["id", "code", "row", "col", "status"]


class ParkingFloorSerializer(serializers.ModelSerializer):
    total_slots = serializers.IntegerField(read_only=True)
    available_slots = serializers.IntegerField(read_only=True)

    class Meta:
        model = ParkingFloor
        fields = ["id", "name", "level", "total_slots", "available_slots"]


class ParkingFloorWithSlotsSerializer(ParkingFloorSerializer):
    slots = ParkingSlotSerializer(many=True, read_only=True)

    class Meta(ParkingFloorSerializer.Meta):
        fields = ParkingFloorSerializer.Meta.fields + ["slots"]


class ParkingLocationListSerializer(serializers.ModelSerializer):
    total_slots = serializers.IntegerField(read_only=True)
    available_slots = serializers.IntegerField(read_only=True)
    distance_km = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = ParkingLocation
        fields = [
            "id", "name", "address", "city", "district", "state", "country",
            "latitude", "longitude", "parking_type", "parking_mode", "category",
            "vehicle_types", "rating", "rating_count",
            "is_24_hours", "opens_at", "closes_at", "price_per_hour", "price_day_max", "monthly_price",
            "image", "total_slots", "available_slots", "distance_km",
        ]

    def get_distance_km(self, obj):
        distance = getattr(obj, "distance_km", None)
        return round(distance, 2) if distance is not None else None

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image:
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        # Owners upload photos through the gallery (ParkingImage), not the
        # single legacy `image` field — fall back to the first gallery photo
        # so uploads actually show up as the card/hero image.
        first_gallery = next(iter(obj.gallery_images.all()), None)
        if first_gallery:
            return request.build_absolute_uri(first_gallery.image.url) if request else first_gallery.image.url
        return obj.image_url or None


class ParkingLocationDetailSerializer(ParkingLocationListSerializer):
    floors = ParkingFloorSerializer(many=True, read_only=True)
    gallery_images = ParkingImageSerializer(many=True, read_only=True)
    # The owner's own UPI/QR payment details (Owner Portal → Payments →
    # Payment Configuration), shown to users during the booking payment step.
    owner_upi_id = serializers.SerializerMethodField()
    owner_qr_code = serializers.SerializerMethodField()

    class Meta(ParkingLocationListSerializer.Meta):
        fields = ParkingLocationListSerializer.Meta.fields + [
            "description", "amenities", "contact_number", "contact_email", "available_days",
            "google_maps_url", "floors", "gallery_images", "owner_upi_id", "owner_qr_code",
        ]

    def get_owner_upi_id(self, obj):
        return obj.owner.upi_id if obj.owner and obj.owner.upi_id else None

    def get_owner_qr_code(self, obj):
        if obj.owner and obj.owner.qr_code:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.owner.qr_code.url) if request else obj.owner.qr_code.url
        return None
