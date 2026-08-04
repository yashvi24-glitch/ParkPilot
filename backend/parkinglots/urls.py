from django.urls import path

from .views import (
    ParkingCitiesView,
    ParkingFloorListView,
    ParkingFloorSlotsView,
    ParkingLocationDetailView,
    ParkingNearbyView,
    ParkingSearchView,
)

urlpatterns = [
    path("search", ParkingSearchView.as_view(), name="parking-search"),
    path("nearby", ParkingNearbyView.as_view(), name="parking-nearby"),
    path("cities", ParkingCitiesView.as_view(), name="parking-cities"),
    path("<int:pk>", ParkingLocationDetailView.as_view(), name="parking-detail"),
    path("<int:location_id>/floors", ParkingFloorListView.as_view(), name="parking-floors"),
    path("<int:location_id>/floors/<int:floor_id>/slots", ParkingFloorSlotsView.as_view(), name="parking-floor-slots"),
]
