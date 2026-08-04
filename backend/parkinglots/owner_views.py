import re

from django.db import transaction
from django.db.models import Count
from django.db.models.deletion import ProtectedError
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.owner_stats import booking_summary_stats
from owners.authentication import OwnerJWTAuthentication
from owners.models import OwnerNotification
from owners.utils import owner_notify

from . import csv_import
from .models import ParkingFloor, ParkingImage, ParkingLocation, ParkingSlot
from .owner_serializers import (
    OwnerParkingFloorSerializer,
    OwnerParkingImageSerializer,
    OwnerParkingLocationSerializer,
    OwnerParkingSlotSerializer,
    OwnerSlotGenerateSerializer,
)


class OwnerScopedMixin:
    authentication_classes = [OwnerJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class OwnerParkingListCreateView(OwnerScopedMixin, generics.ListCreateAPIView):
    serializer_class = OwnerParkingLocationSerializer

    def get_queryset(self):
        return ParkingLocation.objects.filter(owner=self.request.user, is_active=True).order_by("-created_at")


class OwnerParkingDetailView(OwnerScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OwnerParkingLocationSerializer

    def get_queryset(self):
        return ParkingLocation.objects.filter(owner=self.request.user)

    def perform_destroy(self, instance):
        # A real delete would raise ProtectedError the moment any booking
        # (even a long-completed one) exists against any of its slots, since
        # Booking.slot is deliberately PROTECT. Soft-delete instead: it drops
        # out of the owner's list and out of user-facing search, but existing
        # bookings still resolve correctly.
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    def perform_update(self, serializer):
        instance = serializer.save()
        owner_notify(
            self.request.user, OwnerNotification.FACILITY_UPDATED,
            "Parking Facility Updated", f"{instance.name} was updated.",
            link="/owner/parking",
        )


class OwnerParkingImageListCreateView(OwnerScopedMixin, generics.ListCreateAPIView):
    serializer_class = OwnerParkingImageSerializer
    parser_classes = [MultiPartParser]

    def get_location(self):
        return generics.get_object_or_404(
            ParkingLocation, pk=self.kwargs["location_id"], owner=self.request.user
        )

    def get_queryset(self):
        return ParkingImage.objects.filter(location=self.get_location())

    def perform_create(self, serializer):
        location = self.get_location()
        serializer.save(location=location)
        owner_notify(
            self.request.user, OwnerNotification.IMAGES_UPDATED,
            "Parking Images Updated", f"New image uploaded for {location.name}.",
            link=f"/owner/parking/{location.id}/edit",
        )


class OwnerParkingImageDeleteView(OwnerScopedMixin, generics.DestroyAPIView):
    serializer_class = OwnerParkingImageSerializer

    def get_queryset(self):
        return ParkingImage.objects.filter(location__owner=self.request.user)


class OwnerParkingFloorListCreateView(OwnerScopedMixin, generics.ListCreateAPIView):
    serializer_class = OwnerParkingFloorSerializer

    def get_location(self):
        return generics.get_object_or_404(
            ParkingLocation, pk=self.kwargs["location_id"], owner=self.request.user
        )

    def get_queryset(self):
        return ParkingFloor.objects.filter(location=self.get_location())

    def perform_create(self, serializer):
        location = self.get_location()
        if location.parking_mode != ParkingLocation.SLOT_BASED:
            raise ValidationError("Floors can only be added to Slot-Based parking facilities.")
        serializer.save(location=location)


class OwnerParkingFloorDeleteView(OwnerScopedMixin, generics.DestroyAPIView):
    serializer_class = OwnerParkingFloorSerializer

    def get_queryset(self):
        return ParkingFloor.objects.filter(location__owner=self.request.user)


class OwnerParkingSlotListCreateView(OwnerScopedMixin, generics.ListCreateAPIView):
    serializer_class = OwnerParkingSlotSerializer

    def get_floor(self):
        return generics.get_object_or_404(
            ParkingFloor,
            pk=self.kwargs["floor_id"],
            location_id=self.kwargs["location_id"],
            location__owner=self.request.user,
        )

    def get_queryset(self):
        return ParkingSlot.objects.filter(floor=self.get_floor())

    def perform_create(self, serializer):
        floor = self.get_floor()
        if ParkingSlot.objects.filter(floor=floor, code=serializer.validated_data["code"]).exists():
            raise ValidationError({"code": "A slot with this number already exists on this floor."})
        serializer.save(floor=floor)


class OwnerParkingSlotDetailView(OwnerScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OwnerParkingSlotSerializer

    def get_queryset(self):
        return ParkingSlot.objects.filter(floor__location__owner=self.request.user)

    def perform_update(self, serializer):
        code = serializer.validated_data.get("code", serializer.instance.code)
        floor = serializer.instance.floor
        if ParkingSlot.objects.filter(floor=floor, code=code).exclude(pk=serializer.instance.pk).exists():
            raise ValidationError({"code": "A slot with this number already exists on this floor."})
        serializer.save()

    def perform_destroy(self, instance):
        # Booking.slot is PROTECT (booking history must survive slot deletion),
        # so a slot with any booking — even a long-completed one — raises
        # ProtectedError on a real delete. Surface a clear error instead of a 500.
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                "This slot has booking history and can't be deleted. Set it to Maintenance instead."
            )


class OwnerParkingSlotDuplicateView(OwnerScopedMixin, APIView):
    def get_slot(self):
        return generics.get_object_or_404(ParkingSlot, pk=self.kwargs["pk"], floor__location__owner=self.request.user)

    def post(self, request, pk):
        original = self.get_slot()
        floor = original.floor

        match = re.match(r"^(.*?)(\d+)$", original.code)
        if match:
            base, digits = match.group(1), match.group(2)
            width = len(digits)
            n = int(digits) + 1
            while ParkingSlot.objects.filter(floor=floor, code=f"{base}{str(n).zfill(width)}").exists():
                n += 1
            new_code = f"{base}{str(n).zfill(width)}"
        else:
            n = 2
            while ParkingSlot.objects.filter(floor=floor, code=f"{original.code}-{n}").exists():
                n += 1
            new_code = f"{original.code}-{n}"

        max_col = floor.slots.filter(row=original.row).count()
        copy = ParkingSlot.objects.create(
            floor=floor, code=new_code, row=original.row, col=max_col + 1,
            vehicle_type=original.vehicle_type, status=ParkingSlot.AVAILABLE,
        )
        return Response(OwnerParkingSlotSerializer(copy).data, status=status.HTTP_201_CREATED)


class OwnerParkingSlotGenerateView(OwnerScopedMixin, APIView):
    def get_floor(self):
        return generics.get_object_or_404(
            ParkingFloor,
            pk=self.kwargs["floor_id"],
            location_id=self.kwargs["location_id"],
            location__owner=self.request.user,
        )

    def post(self, request, location_id, floor_id):
        floor = self.get_floor()
        serializer = OwnerSlotGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prefix = serializer.validated_data["prefix"].strip()
        rows = serializer.validated_data["rows"]
        cols = serializer.validated_data["cols"]
        vehicle_type = serializer.validated_data["vehicle_type"]

        total = rows * cols
        width = max(2, len(str(total)))
        codes = [f"{prefix}{str(i).zfill(width)}" for i in range(1, total + 1)]

        existing = set(ParkingSlot.objects.filter(floor=floor, code__in=codes).values_list("code", flat=True))
        if existing:
            sample = ", ".join(sorted(existing)[:5])
            raise ValidationError(
                {"prefix": f"{len(existing)} slot code(s) already exist on this floor (e.g. {sample}). "
                            "Choose a different prefix or remove the conflicting slots first."}
            )

        with transaction.atomic():
            slots = [
                ParkingSlot(
                    floor=floor, code=code, vehicle_type=vehicle_type,
                    row=((i - 1) // cols) + 1, col=((i - 1) % cols) + 1,
                )
                for i, code in enumerate(codes, start=1)
            ]
            ParkingSlot.objects.bulk_create(slots)

        return Response(
            OwnerParkingSlotSerializer(floor.slots.order_by("row", "col"), many=True).data,
            status=status.HTTP_201_CREATED,
        )


class OwnerDashboardView(OwnerScopedMixin, APIView):
    def get(self, request):
        owner = request.user
        locations = list(ParkingLocation.objects.filter(owner=owner, is_active=True))

        total_facilities = len(locations)
        total_capacity = sum(loc.total_slots for loc in locations)
        available_capacity = sum(loc.available_slots for loc in locations)
        occupied_capacity = total_capacity - available_capacity
        occupancy_pct = round(occupied_capacity / total_capacity * 100, 1) if total_capacity else 0

        live_monitoring = []
        for loc in locations:
            if loc.parking_mode == ParkingLocation.SLOT_BASED:
                counts = {
                    row["status"]: row["n"]
                    for row in ParkingSlot.objects.filter(floor__location=loc)
                    .values("status").annotate(n=Count("id"))
                }
                live_monitoring.append({
                    "id": loc.id, "name": loc.name, "parking_mode": loc.parking_mode,
                    "available": counts.get(ParkingSlot.AVAILABLE, 0),
                    "occupied": counts.get(ParkingSlot.BOOKED, 0),
                    "reserved": counts.get(ParkingSlot.RESERVED, 0),
                    "maintenance": counts.get(ParkingSlot.MAINTENANCE, 0),
                })
            else:
                live_monitoring.append({
                    "id": loc.id, "name": loc.name, "parking_mode": loc.parking_mode,
                    "total_capacity": loc.total_slots,
                    "available_capacity": loc.available_slots,
                    "occupied_capacity": loc.total_slots - loc.available_slots,
                })

        return Response({
            "total_facilities": total_facilities,
            "total_capacity": total_capacity,
            "available_capacity": available_capacity,
            "occupied_capacity": occupied_capacity,
            "occupancy_pct": occupancy_pct,
            "live_monitoring": live_monitoring,
            **booking_summary_stats(owner),
        })


class BaseCsvImportView(OwnerScopedMixin, APIView):
    parser_classes = [MultiPartParser]
    import_fn = None  # set by subclasses
    label = "CSV"  # set by subclasses, used in the notification message

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"errors": [{"row": None, "column": None, "message": "No file uploaded."}]}, status=400)

        result = self.import_fn(request.user, file.file)
        if result["errors"]:
            owner_notify(
                request.user, OwnerNotification.CSV_UPLOAD_FAILED,
                "CSV Upload Failed", f"{self.label} import failed — {len(result['errors'])} row(s) had errors.",
                link="/owner/parking/import",
            )
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        owner_notify(
            request.user, OwnerNotification.CSV_UPLOAD_SUCCESS,
            "CSV Upload Successful",
            f"{self.label} import complete — {result['created']} created, {result['updated']} updated.",
            link="/owner/parking",
        )
        return Response(result, status=status.HTTP_201_CREATED)


class OwnerImportLocationsView(BaseCsvImportView):
    import_fn = staticmethod(csv_import.import_locations)
    label = "Parking Information"


class OwnerImportFloorsView(BaseCsvImportView):
    import_fn = staticmethod(csv_import.import_floors)
    label = "Floor Information"


class OwnerImportSlotsView(BaseCsvImportView):
    import_fn = staticmethod(csv_import.import_slots)
    label = "Parking Slot"


class OwnerImportPricingView(BaseCsvImportView):
    import_fn = staticmethod(csv_import.import_pricing)
    label = "Pricing"


class OwnerImportFacilitiesView(BaseCsvImportView):
    import_fn = staticmethod(csv_import.import_facilities)
    label = "Facilities"
