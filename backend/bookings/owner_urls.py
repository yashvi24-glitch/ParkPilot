from django.urls import path

from .owner_views import (
    OwnerBookingCancelView,
    OwnerBookingCompleteView,
    OwnerBookingDetailView,
    OwnerBookingListView,
    OwnerBookingSummaryView,
)

urlpatterns = [
    path("", OwnerBookingListView.as_view(), name="owner-booking-list"),
    path("summary", OwnerBookingSummaryView.as_view(), name="owner-booking-summary"),
    path("<int:pk>", OwnerBookingDetailView.as_view(), name="owner-booking-detail"),
    path("<int:pk>/complete", OwnerBookingCompleteView.as_view(), name="owner-booking-complete"),
    path("<int:pk>/cancel", OwnerBookingCancelView.as_view(), name="owner-booking-cancel"),
]
