from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ParkingFloor, ParkingLocation
from .serializers import (
    ParkingFloorSerializer,
    ParkingFloorWithSlotsSerializer,
    ParkingLocationDetailSerializer,
    ParkingLocationListSerializer,
)
from .utils import annotate_distance


class ParkingSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        city = request.query_params.get("city", "").strip()
        parking_type = request.query_params.get("type", "").strip()
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        free_only = request.query_params.get("free", "").strip().lower() in ("1", "true", "yes")

        # "free" typed alongside other words (e.g. "free ranip") is a filter
        # keyword, not part of the name search — pull it out and match the
        # rest of the query as a substring instead of a prefix, since free-zone
        # names ("AMC Free Parking - Ranip Overbridge") bury the area name
        # in the middle rather than starting with it.
        q_tokens = q.split()
        if any(t.lower() == "free" for t in q_tokens):
            free_only = True
            q_tokens = [t for t in q_tokens if t.lower() != "free"]
        q = " ".join(q_tokens)

        qs = ParkingLocation.objects.filter(is_active=True).prefetch_related("gallery_images")
        if city:
            qs = qs.filter(city__iexact=city)
        if parking_type:
            qs = qs.filter(parking_type=parking_type)
        if free_only:
            qs = qs.filter(price_per_hour=0)

        locations = list(qs)
        if q:
            q_lower = q.lower()
            if free_only:
                locations = [loc for loc in locations if q_lower in loc.name.lower()]
            else:
                locations = [loc for loc in locations if loc.name.lower().startswith(q_lower)]

        if lat and lng:
            locations = annotate_distance(locations, lat, lng)
            locations.sort(key=lambda loc: loc.distance_km)

        serializer = ParkingLocationListSerializer(locations, many=True, context={"request": request})
        return Response(serializer.data)


class ParkingNearbyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        if not lat or not lng:
            raise ValidationError("lat and lng query params are required.")

        city = request.query_params.get("city", "").strip()
        parking_type = request.query_params.get("type", "").strip()
        free_only = request.query_params.get("free", "").strip().lower() in ("1", "true", "yes")

        qs = ParkingLocation.objects.filter(is_active=True).prefetch_related("gallery_images")
        if city:
            qs = qs.filter(city__iexact=city)
        if parking_type:
            qs = qs.filter(parking_type=parking_type)
        if free_only:
            qs = qs.filter(price_per_hour=0)

        radius_km = float(request.query_params.get("radius", 15))
        locations = annotate_distance(list(qs), lat, lng)
        locations = [loc for loc in locations if loc.distance_km <= radius_km]
        locations.sort(key=lambda loc: loc.distance_km)

        serializer = ParkingLocationListSerializer(locations, many=True, context={"request": request})
        return Response(serializer.data)


class ParkingCitiesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cities = (
            ParkingLocation.objects.filter(is_active=True).order_by("city")
            .values_list("city", flat=True)
            .distinct()
        )
        return Response(list(cities))


class ParkingLocationDetailView(generics.RetrieveAPIView):
    queryset = ParkingLocation.objects.all().select_related("owner").prefetch_related("gallery_images")
    serializer_class = ParkingLocationDetailSerializer
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        if lat and lng:
            annotate_distance([instance], lat, lng)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ParkingFloorListView(generics.ListAPIView):
    serializer_class = ParkingFloorSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ParkingFloor.objects.filter(location_id=self.kwargs["location_id"])


class ParkingFloorSlotsView(generics.RetrieveAPIView):
    serializer_class = ParkingFloorWithSlotsSerializer
    permission_classes = [permissions.AllowAny]

    def get_object(self):
        return get_object_or_404(
            ParkingFloor, location_id=self.kwargs["location_id"], id=self.kwargs["floor_id"]
        )
