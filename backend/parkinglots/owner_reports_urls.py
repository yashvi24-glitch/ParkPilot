from django.urls import path

from .owner_reports_views import (
    OwnerReportsBookingTrendsView,
    OwnerReportsFloorPerformanceView,
    OwnerReportsOccupancyWeekdayView,
    OwnerReportsParkingPerformanceView,
    OwnerReportsPeakHoursView,
    OwnerReportsSummaryView,
    OwnerReportsVehicleDistributionView,
)

urlpatterns = [
    path("summary", OwnerReportsSummaryView.as_view(), name="owner-reports-summary"),
    path("booking-trends", OwnerReportsBookingTrendsView.as_view(), name="owner-reports-booking-trends"),
    path("occupancy-weekday", OwnerReportsOccupancyWeekdayView.as_view(), name="owner-reports-occupancy-weekday"),
    path("peak-hours", OwnerReportsPeakHoursView.as_view(), name="owner-reports-peak-hours"),
    path("vehicle-distribution", OwnerReportsVehicleDistributionView.as_view(), name="owner-reports-vehicle-distribution"),
    path("parking-performance", OwnerReportsParkingPerformanceView.as_view(), name="owner-reports-parking-performance"),
    path("floor-performance", OwnerReportsFloorPerformanceView.as_view(), name="owner-reports-floor-performance"),
]
