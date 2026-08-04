from django.urls import path

from .views import (
    BookingCancelView,
    BookingCheckInView,
    BookingDetailView,
    BookingFoundCarView,
    BookingListCreateView,
)

urlpatterns = [
    path("", BookingListCreateView.as_view(), name="booking-list-create"),
    path("/<int:pk>", BookingDetailView.as_view(), name="booking-detail"),
    path("/<int:pk>/cancel", BookingCancelView.as_view(), name="booking-cancel"),
    path("/<int:pk>/check-in", BookingCheckInView.as_view(), name="booking-check-in"),
    path("/<int:pk>/found-car", BookingFoundCarView.as_view(), name="booking-found-car"),
]
