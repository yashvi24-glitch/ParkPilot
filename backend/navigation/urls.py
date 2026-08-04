from django.urls import path

from .views import GeocodeView, ReverseGeocodeView, RouteView

urlpatterns = [
    path("geocode", GeocodeView.as_view(), name="geocode"),
    path("reverse", ReverseGeocodeView.as_view(), name="reverse-geocode"),
    path("route", RouteView.as_view(), name="route"),
]
