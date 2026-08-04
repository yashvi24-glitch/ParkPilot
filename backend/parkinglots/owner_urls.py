from django.urls import path

from .owner_views import (
    OwnerDashboardView,
    OwnerImportFacilitiesView,
    OwnerImportFloorsView,
    OwnerImportLocationsView,
    OwnerImportPricingView,
    OwnerImportSlotsView,
    OwnerParkingDetailView,
    OwnerParkingFloorDeleteView,
    OwnerParkingFloorListCreateView,
    OwnerParkingImageDeleteView,
    OwnerParkingImageListCreateView,
    OwnerParkingListCreateView,
    OwnerParkingSlotDetailView,
    OwnerParkingSlotDuplicateView,
    OwnerParkingSlotGenerateView,
    OwnerParkingSlotListCreateView,
)

urlpatterns = [
    path("dashboard", OwnerDashboardView.as_view(), name="owner-dashboard"),
    path("locations", OwnerParkingListCreateView.as_view(), name="owner-parking-list-create"),
    path("locations/<int:pk>", OwnerParkingDetailView.as_view(), name="owner-parking-detail"),
    path(
        "locations/<int:location_id>/images",
        OwnerParkingImageListCreateView.as_view(),
        name="owner-parking-image-list-create",
    ),
    path("images/<int:pk>", OwnerParkingImageDeleteView.as_view(), name="owner-parking-image-delete"),
    path(
        "locations/<int:location_id>/floors",
        OwnerParkingFloorListCreateView.as_view(),
        name="owner-parking-floor-list-create",
    ),
    path("floors/<int:pk>", OwnerParkingFloorDeleteView.as_view(), name="owner-parking-floor-delete"),
    path(
        "locations/<int:location_id>/floors/<int:floor_id>/slots",
        OwnerParkingSlotListCreateView.as_view(),
        name="owner-parking-slot-list-create",
    ),
    path("slots/<int:pk>", OwnerParkingSlotDetailView.as_view(), name="owner-parking-slot-detail"),
    path("slots/<int:pk>/duplicate", OwnerParkingSlotDuplicateView.as_view(), name="owner-parking-slot-duplicate"),
    path(
        "locations/<int:location_id>/floors/<int:floor_id>/slots/generate",
        OwnerParkingSlotGenerateView.as_view(),
        name="owner-parking-slot-generate",
    ),
    path("import/locations", OwnerImportLocationsView.as_view(), name="owner-import-locations"),
    path("import/floors", OwnerImportFloorsView.as_view(), name="owner-import-floors"),
    path("import/slots", OwnerImportSlotsView.as_view(), name="owner-import-slots"),
    path("import/pricing", OwnerImportPricingView.as_view(), name="owner-import-pricing"),
    path("import/facilities", OwnerImportFacilitiesView.as_view(), name="owner-import-facilities"),
]
