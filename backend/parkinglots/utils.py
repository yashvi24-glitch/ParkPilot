from math import asin, cos, radians, sin, sqrt


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))


def annotate_distance(locations, lat, lng):
    lat, lng = float(lat), float(lng)
    for loc in locations:
        loc.distance_km = haversine_km(lat, lng, loc.latitude, loc.longitude)
    return locations
