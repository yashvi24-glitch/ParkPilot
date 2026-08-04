from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from bookings.owner_stats import booking_time_series, owner_bookings_qs
from vehicles.models import Vehicle

from .models import ParkingFloor, ParkingLocation
from .owner_views import OwnerScopedMixin

WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
# How far back "occupancy by weekday" looks — there's no historical slot-status
# log in this app, so this is a proxy (bookings per weekday vs. capacity),
# not a true historical occupancy trace.
OCCUPANCY_WINDOW_DAYS = 90


class OwnerReportsSummaryView(OwnerScopedMixin, APIView):
    def get(self, request):
        owner = request.user
        bookings = owner_bookings_qs(owner)
        paid = bookings.filter(payment_status=Booking.PAYMENT_PAID)

        durations = []
        for b in bookings.only("start_time", "end_time"):
            start = b.start_time.hour * 60 + b.start_time.minute
            end = b.end_time.hour * 60 + b.end_time.minute
            durations.append(max(end - start, 0) / 60)
        avg_parking_duration = round(sum(durations) / len(durations), 1) if durations else 0

        locations = list(ParkingLocation.objects.filter(owner=owner, is_active=True))
        total_capacity = sum(loc.total_slots for loc in locations)
        available_capacity = sum(loc.available_slots for loc in locations)
        occupancy_pct = round((total_capacity - available_capacity) / total_capacity * 100, 1) if total_capacity else 0

        returning_customers = bookings.values("user").annotate(n=Count("id")).filter(n__gt=1).count()

        return Response({
            "total_revenue": float(paid.aggregate(total=Sum("amount"))["total"] or 0),
            "total_customers": bookings.values("user").distinct().count(),
            "total_bookings": bookings.count(),
            "active_bookings": bookings.filter(status=Booking.ACTIVE).count(),
            "avg_parking_duration": avg_parking_duration,
            "occupancy_pct": occupancy_pct,
            "returning_customers": returning_customers,
        })


class OwnerReportsBookingTrendsView(OwnerScopedMixin, APIView):
    def get(self, request):
        range_key, data = booking_time_series(request.user, request.query_params.get("range", "daily"))
        return Response({"range": range_key, "data": data})


class OwnerReportsOccupancyWeekdayView(OwnerScopedMixin, APIView):
    def get(self, request):
        owner = request.user
        total_capacity = sum(
            loc.total_slots for loc in ParkingLocation.objects.filter(owner=owner, is_active=True)
        )
        if not total_capacity:
            return Response([{"day": d, "occupancy_pct": 0} for d in WEEKDAY_LABELS])

        today = timezone.localdate()
        window_start = today - timedelta(days=OCCUPANCY_WINDOW_DAYS)

        counts = [0] * 7
        for b in owner_bookings_qs(owner).filter(date__gte=window_start).only("date"):
            counts[b.date.weekday()] += 1

        # How many times each weekday actually occurred in the window, so a
        # 90-day window that doesn't divide evenly by 7 doesn't skew results.
        occurrences = [0] * 7
        d = window_start
        while d <= today:
            occurrences[d.weekday()] += 1
            d += timedelta(days=1)

        return Response([
            {
                "day": label,
                "occupancy_pct": min(round(counts[i] / (total_capacity * (occurrences[i] or 1)) * 100, 1), 100),
            }
            for i, label in enumerate(WEEKDAY_LABELS)
        ])


class OwnerReportsPeakHoursView(OwnerScopedMixin, APIView):
    def get(self, request):
        hour_counts = [0] * 24
        for b in owner_bookings_qs(request.user).only("start_time"):
            hour_counts[b.start_time.hour] += 1
        return Response([
            {"hour": f"{h:02d}:00-{(h + 1) % 24:02d}:00", "bookings": hour_counts[h]}
            for h in range(24)
        ])


class OwnerReportsVehicleDistributionView(OwnerScopedMixin, APIView):
    def get(self, request):
        label_map = dict(Vehicle.VEHICLE_TYPE_CHOICES)
        counts = owner_bookings_qs(request.user).values("vehicle__vehicle_type").annotate(n=Count("id"))
        return Response([
            {"type": label_map.get(row["vehicle__vehicle_type"], row["vehicle__vehicle_type"]), "count": row["n"]}
            for row in counts
        ])


class OwnerReportsParkingPerformanceView(OwnerScopedMixin, APIView):
    def get(self, request):
        rows = []
        for loc in ParkingLocation.objects.filter(owner=request.user, is_active=True):
            bookings = Booking.objects.filter(slot__floor__location=loc)
            revenue = bookings.filter(payment_status=Booking.PAYMENT_PAID).aggregate(total=Sum("amount"))["total"] or 0
            total = loc.total_slots
            occupancy_pct = round((total - loc.available_slots) / total * 100, 1) if total else 0
            rows.append({
                "id": loc.id, "name": loc.name, "revenue": float(revenue),
                "bookings": bookings.count(), "occupancy_pct": occupancy_pct,
                "customers": bookings.values("user").distinct().count(),
            })
        rows.sort(key=lambda r: r["revenue"], reverse=True)
        return Response(rows)


class OwnerReportsFloorPerformanceView(OwnerScopedMixin, APIView):
    def get(self, request):
        floors = ParkingFloor.objects.filter(
            location__owner=request.user, location__is_active=True,
            location__parking_mode=ParkingLocation.SLOT_BASED,
        ).select_related("location")
        rows = []
        for floor in floors:
            total = floor.total_slots
            occupancy_pct = round((total - floor.available_slots) / total * 100, 1) if total else 0
            rows.append({
                "id": floor.id, "name": floor.name, "parking_name": floor.location.name,
                "occupancy_pct": occupancy_pct,
            })
        rows.sort(key=lambda r: r["occupancy_pct"], reverse=True)
        return Response(rows)
