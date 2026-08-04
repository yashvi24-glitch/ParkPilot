import requests
from django.core.cache import cache
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1"
HEADERS = {"User-Agent": "ParkPilot/1.0 (smart-parking-demo-app)"}

VALID_MODES = {"driving", "walking", "cycling"}
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

# OSRM's public router estimates free-flow travel time (empty roads, no signals),
# which runs well under real Indian city driving times. Scale driving durations up
# to better match typical urban traffic — an approximation, not live traffic data.
INDIA_URBAN_TRAFFIC_FACTOR = 1.4

# Soft bias towards Gujarat (min_lon,min_lat,max_lon,max_lat) — ParkPilot currently
# only operates in Gujarat, India, so search results are nudged towards this region
# without hard-excluding the rest of India.
GUJARAT_VIEWBOX = "68.0,20.0,74.5,24.8"


class GeocodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            raise ValidationError("q query param is required.")

        cache_key = f"geocode:{query.lower()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            resp = requests.get(
                NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "json",
                    "limit": 5,
                    "addressdetails": 1,
                    "countrycodes": "in",
                    "viewbox": GUJARAT_VIEWBOX,
                    "bounded": 0,
                },
                headers=HEADERS,
                timeout=8,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise ValidationError(f"Geocoding service unavailable: {exc}")

        results = [
            {
                "display_name": item["display_name"],
                "lat": float(item["lat"]),
                "lng": float(item["lon"]),
            }
            for item in resp.json()
        ]
        cache.set(cache_key, results, timeout=300)
        return Response(results)


class RouteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        params = request.query_params
        mode = params.get("mode", "driving")
        if mode not in VALID_MODES:
            raise ValidationError(f"mode must be one of {VALID_MODES}")

        try:
            from_lat = float(params["from_lat"])
            from_lng = float(params["from_lng"])
            to_lat = float(params["to_lat"])
            to_lng = float(params["to_lng"])
        except (KeyError, ValueError):
            raise ValidationError("from_lat, from_lng, to_lat, to_lng are required numeric params.")

        cache_key = f"route:{mode}:{from_lat},{from_lng}:{to_lat},{to_lng}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        url = f"{OSRM_URL}/{mode}/{from_lng},{from_lat};{to_lng},{to_lat}"
        try:
            resp = requests.get(
                url, params={"overview": "full", "geometries": "geojson"}, timeout=8
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            raise ValidationError(f"Routing service unavailable: {exc}")

        if data.get("code") != "Ok" or not data.get("routes"):
            raise ValidationError("No route found.")

        route = data["routes"][0]
        duration_min = route["duration"] / 60
        if mode == "driving":
            duration_min *= INDIA_URBAN_TRAFFIC_FACTOR

        result = {
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_min": round(duration_min, 1),
            "geometry": route["geometry"]["coordinates"],
        }
        cache.set(cache_key, result, timeout=300)
        return Response(result)


class ReverseGeocodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            lat = float(request.query_params["lat"])
            lng = float(request.query_params["lng"])
        except (KeyError, ValueError):
            raise ValidationError("lat and lng are required numeric params.")

        cache_key = f"reverse_geocode:{lat:.5f},{lng:.5f}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            resp = requests.get(
                NOMINATIM_REVERSE_URL,
                params={"lat": lat, "lon": lng, "format": "json", "zoom": 18},
                headers=HEADERS,
                timeout=8,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            raise ValidationError(f"Reverse geocoding service unavailable: {exc}")

        if "display_name" not in data:
            raise ValidationError("No address found for this location.")

        result = {"display_name": data["display_name"]}
        cache.set(cache_key, result, timeout=300)
        return Response(result)
