from django.db.models import Q
from rest_framework import filters, generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.models import Notification
from notifications.utils import notify
from owners.authentication import OwnerJWTAuthentication
from owners.models import OwnerNotification
from owners.utils import owner_notify
from parkinglots.models import ParkingSlot

from .models import Booking
from .owner_serializers import OwnerBookingDetailSerializer, OwnerBookingListSerializer
from .owner_stats import booking_summary_stats, owner_bookings_qs


class OwnerScopedMixin:
    authentication_classes = [OwnerJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class OwnerBookingListView(OwnerScopedMixin, generics.ListAPIView):
    serializer_class = OwnerBookingListSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = [
        "date", "start_time", "amount", "status", "payment_status", "created_at",
        "user__full_name", "vehicle__plate_number", "slot__floor__location__name", "slot__code",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = owner_bookings_qs(self.request.user).select_related(
            "user", "vehicle", "slot__floor__location"
        )
        for booking in qs:
            booking.refresh_status()
            booking.check_alerts()

        params = self.request.query_params
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(user__full_name__icontains=q)
                | Q(vehicle__plate_number__icontains=q)
                | Q(booking_code__icontains=q)
            )
        parking_id = params.get("parking_id")
        if parking_id:
            qs = qs.filter(slot__floor__location_id=parking_id)
        # Bookings never span multiple calendar days in this app (entry and
        # exit are always the same date), so "Booking Date", "Entry Date",
        # and "Exit Date" are the same single filter here.
        date = params.get("date") or params.get("entry_date") or params.get("exit_date")
        if date:
            qs = qs.filter(date=date)
        status_param = params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        payment_status = params.get("payment_status")
        if payment_status:
            qs = qs.filter(payment_status=payment_status)
        return qs


class OwnerBookingSummaryView(OwnerScopedMixin, APIView):
    def get(self, request):
        return Response(booking_summary_stats(request.user))


class OwnerBookingDetailView(OwnerScopedMixin, generics.RetrieveAPIView):
    serializer_class = OwnerBookingDetailSerializer

    def get_queryset(self):
        return owner_bookings_qs(self.request.user).select_related(
            "user", "vehicle", "slot__floor__location"
        )

    def get_object(self):
        obj = super().get_object()
        obj.refresh_status()
        obj.check_alerts()
        return obj


class OwnerBookingCompleteView(OwnerScopedMixin, APIView):
    def post(self, request, pk):
        try:
            booking = owner_bookings_qs(request.user).select_related("slot", "user").get(pk=pk)
        except Booking.DoesNotExist:
            raise ValidationError("Booking not found.")

        if booking.status in (Booking.COMPLETED, Booking.CANCELLED):
            raise ValidationError(f"Booking is already {booking.status}.")

        booking.status = Booking.COMPLETED
        booking.save(update_fields=["status", "updated_at"])
        booking.slot.status = ParkingSlot.AVAILABLE
        booking.slot.save(update_fields=["status"])

        notify(
            booking.user, Notification.SYSTEM, "Booking Completed",
            f"Your booking {booking.booking_code} has been marked completed.",
        )
        owner_notify(
            request.user, OwnerNotification.BOOKING_COMPLETED,
            "Booking Completed", f"Booking {booking.booking_code} marked completed.",
            link="/owner/bookings",
        )
        return Response(OwnerBookingDetailSerializer(booking).data)


class OwnerBookingCancelView(OwnerScopedMixin, APIView):
    def post(self, request, pk):
        try:
            booking = owner_bookings_qs(request.user).select_related("slot", "user").get(pk=pk)
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
            booking.user, Notification.BOOKING_CANCELLED, "Booking Cancelled",
            f"Your booking {booking.booking_code} was cancelled by the parking facility."
            + (" A refund has been issued." if was_paid else ""),
        )
        owner_notify(
            request.user, OwnerNotification.BOOKING_CANCELLED,
            "Booking Cancelled", f"Booking {booking.booking_code} was cancelled.",
            link="/owner/bookings",
        )
        return Response(OwnerBookingDetailSerializer(booking).data)
