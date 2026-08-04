from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.models import Notification
from notifications.utils import notify
from owners.models import OwnerNotification
from owners.utils import owner_notify
from parkinglots.models import ParkingSlot

from .models import Booking
from .serializers import BookingCreateSerializer, BookingSerializer

# A facility this close to full triggers a "limited availability" nudge to
# the owner (capacity==0 gets its own, more urgent "capacity reached" alert).
LOW_AVAILABILITY_THRESHOLD = 2


def notify_capacity(location):
    if location.owner_id is None:
        return
    available = location.available_slots
    if available == 0:
        owner_notify(
            location.owner, OwnerNotification.CAPACITY_REACHED,
            "Parking Capacity Reached", f"{location.name} is now fully booked.",
            link="/owner/parking",
        )
    elif available <= LOW_AVAILABILITY_THRESHOLD:
        owner_notify(
            location.owner, OwnerNotification.LIMITED_AVAILABILITY,
            "Limited Parking Availability", f"Only {available} slot(s) left at {location.name}.",
            link="/owner/parking",
        )


class BookingListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return BookingCreateSerializer if self.request.method == "POST" else BookingSerializer

    def get_queryset(self):
        qs = Booking.objects.filter(user=self.request.user).select_related(
            "slot__floor__location", "vehicle"
        )
        for booking in qs:
            booking.refresh_status()
            booking.check_alerts()

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        notify(
            request.user,
            Notification.BOOKING_CONFIRMED,
            "Booking Confirmed",
            f"Your slot {booking.slot.code} at {booking.slot.floor.location.name} is booked for {booking.date}.",
        )
        if booking.amount == 0:
            notify(
                request.user,
                Notification.PAYMENT_SUCCESS,
                "No Payment Required",
                f"Booking {booking.booking_code} is at a free parking zone — no payment needed.",
            )
        else:
            notify(
                request.user,
                Notification.PAYMENT_SUCCESS,
                "Payment Successful",
                f"₹{booking.amount} paid for booking {booking.booking_code} via {booking.get_payment_method_display()}.",
            )

        location = booking.slot.floor.location
        if location.owner_id is not None:
            owner_notify(
                location.owner, OwnerNotification.BOOKING_RECEIVED,
                "New Booking Received",
                f"{request.user.full_name} booked slot {booking.slot.code} at {location.name} for {booking.date}.",
                link="/owner/bookings",
            )
            if booking.amount > 0:
                owner_notify(
                    location.owner, OwnerNotification.PAYMENT_RECEIVED,
                    "Payment Received",
                    f"₹{booking.amount} received for booking {booking.booking_code}.",
                    link="/owner/payments",
                )
            notify_capacity(location)

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class BookingDetailView(generics.RetrieveAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user)

    def get_object(self):
        obj = super().get_object()
        obj.refresh_status()
        obj.check_alerts()
        return obj


class BookingCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            booking = Booking.objects.select_related("slot").get(pk=pk, user=request.user)
        except Booking.DoesNotExist:
            raise ValidationError("Booking not found.")

        if booking.status in (Booking.COMPLETED, Booking.CANCELLED):
            raise ValidationError(f"Booking is already {booking.status}.")

        was_paid = booking.payment_status == Booking.PAYMENT_PAID
        booking.status = Booking.CANCELLED
        update_fields = ["status", "updated_at"]
        if was_paid:
            booking.payment_status = Booking.PAYMENT_REFUNDED
            update_fields.append("payment_status")
        booking.save(update_fields=update_fields)
        booking.slot.status = ParkingSlot.AVAILABLE
        booking.slot.save(update_fields=["status"])

        notify(
            request.user,
            Notification.BOOKING_CANCELLED,
            "Booking Cancelled",
            f"Your booking {booking.booking_code} has been cancelled."
            + (" A refund has been issued." if was_paid else ""),
        )

        location = booking.slot.floor.location
        if location.owner_id is not None:
            owner_notify(
                location.owner, OwnerNotification.BOOKING_CANCELLED,
                "Booking Cancelled",
                f"Booking {booking.booking_code} at {location.name} was cancelled by the customer.",
                link="/owner/bookings",
            )
        return Response(BookingSerializer(booking).data)


class BookingCheckInView(APIView):
    """User has physically reached the lot and confirms the vehicle is parked
    (Case 3 of the Find My Car session lifecycle). Distinct from `status`, which
    flips to ACTIVE purely from the clock — `parked_at` gates whether Find My Car
    should offer to route the user back to their vehicle."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk, user=request.user)
        except Booking.DoesNotExist:
            raise ValidationError("Booking not found.")

        booking.refresh_status()
        if booking.status in (Booking.COMPLETED, Booking.CANCELLED):
            raise ValidationError(f"Booking is already {booking.status}.")

        # Idempotent: re-checking-in (double tap, revisiting the page) on an
        # already-parked booking is a no-op, not an error.
        if not booking.parked_at:
            booking.parked_at = timezone.now()
            booking.save(update_fields=["parked_at", "updated_at"])
        return Response(BookingSerializer(booking).data)


class BookingFoundCarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            booking = Booking.objects.select_related("slot").get(pk=pk, user=request.user)
        except Booking.DoesNotExist:
            raise ValidationError("Booking not found.")

        # Finding the car ends the parking session (Case 5) — the slot frees up
        # and Find My Car should stop offering to locate this booking's vehicle.
        booking.found_car = True
        booking.status = Booking.COMPLETED
        booking.save(update_fields=["found_car", "status", "updated_at"])
        booking.slot.status = ParkingSlot.AVAILABLE
        booking.slot.save(update_fields=["status"])

        location = booking.slot.floor.location
        if location.owner_id is not None:
            owner_notify(
                location.owner, OwnerNotification.BOOKING_COMPLETED,
                "Booking Completed",
                f"Booking {booking.booking_code} at {location.name} has been completed.",
                link="/owner/bookings",
            )
        return Response(BookingSerializer(booking).data)
