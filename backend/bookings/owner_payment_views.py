from django.db.models import Q
from rest_framework import filters, generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .owner_serializers import OwnerPaymentHistorySerializer
from .owner_stats import booking_summary_stats, owner_bookings_qs, revenue_time_series
from .owner_views import OwnerScopedMixin


class OwnerPaymentSummaryView(OwnerScopedMixin, APIView):
    def get(self, request):
        return Response(booking_summary_stats(request.user))


class OwnerRevenueAnalyticsView(OwnerScopedMixin, APIView):
    def get(self, request):
        range_key, data = revenue_time_series(request.user, request.query_params.get("range", "daily"))
        return Response({"range": range_key, "data": data})


class OwnerPaymentHistoryView(OwnerScopedMixin, generics.ListAPIView):
    serializer_class = OwnerPaymentHistorySerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = [
        "amount", "payment_method", "payment_status", "paid_at", "created_at",
        "user__full_name", "vehicle__plate_number", "slot__floor__location__name",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = owner_bookings_qs(self.request.user).select_related("user", "vehicle", "slot__floor__location")

        params = self.request.query_params
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(user__full_name__icontains=q)
                | Q(vehicle__plate_number__icontains=q)
                | Q(booking_code__icontains=q)
            )
        payment_status = params.get("payment_status")
        if payment_status:
            qs = qs.filter(payment_status=payment_status)
        payment_method = params.get("payment_method")
        if payment_method:
            qs = qs.filter(payment_method=payment_method)
        parking_id = params.get("parking_id")
        if parking_id:
            qs = qs.filter(slot__floor__location_id=parking_id)
        return qs
