import json
import random
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from parkinglots.models import ParkingFloor, ParkingLocation, ParkingSlot

COMMAND_DIR = Path(__file__).resolve().parent
DATA_FILES = [
    COMMAND_DIR / "gujarat_geocoded.json",
    COMMAND_DIR / "gujarat_new_malls.json",
    COMMAND_DIR / "gujarat_free_zones.json",
]
POOL_DIR = Path(settings.BASE_DIR).parent / "frontend" / "public" / "images" / "parking" / "pool"

# Temporarily excluded from seeding — the app currently focuses on public/
# municipal-run parking only. The Private and Mall filter options stay in the
# UI on purpose; they just return no results until this list is revisited.
EXCLUDED_TYPES = {ParkingLocation.PRIVATE, ParkingLocation.MALL}

ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"]
COLS = 5

FLOOR_NAMES = {
    -2: "Basement 2",
    -1: "Basement 1",
    0: "Ground Floor",
    1: "Floor 1",
    2: "Floor 2",
    3: "Floor 3",
}

# Real, dedicated photos for iconic/well-known locations, matched by keyword in name.
# Each maps to exactly one location, so these never collide with the unique pool below.
LANDMARK_IMAGES = {
    "sabarmati riverfront": "sabarmati-riverfront.jpg",
    "kankaria": "kankaria-lake.jpg",
    "akshardham": "akshardham-gandhinagar.jpg",
    "statue of unity": "statue-of-unity.jpg",
    "somnath": "somnath-temple.jpg",
    "rani ki vav": "rani-ki-vav.jpg",
    "girnar": "girnar.jpg",
    "modhera": "modhera-sun-temple.jpg",
    "dwarkadhish": "dwarkadhish-temple.jpg",
    "svpi airport": "svpi-airport.jpg",
}

# AMC free-zone entries were originally added straight to the database, each
# already assigned one of the shared pool photos. Pinned here by exact name so
# reseeding keeps those same photos instead of drawing new ones from the pool
# iterator below (which has just enough files for the non-free locations).
FREE_ZONE_IMAGES = {
    "AMC Free Parking - Sardarnagar (St. Xaviers School)": "pool-002.jpg",
    "AMC Free Parking - Nava Naroda (Devikrupa-3)": "pool-039.jpg",
    "AMC Free Parking - Nikol (Amidhara Park)": "pool-076.jpg",
    "AMC Free Parking - Vastral (Mahadevnagar)": "pool-070.jpg",
    "AMC Free Parking - Vastral Gam Metro Station": "pool-036.jpg",
    "AMC Free Parking - Viratnagar Cross Road Bridge": "pool-073.jpg",
    "AMC Free Parking - Bapunagar (Rakhiyal)": "pool-045.jpg",
    "AMC Free Parking - Gota Railway Overbridge": "pool-014.jpg",
    "AMC Free Parking - Bodakdev (Vastrapur Lake)": "pool-046.jpg",
    "AMC Free Parking - Thaltej (Gurukul Road)": "pool-055.jpg",
    "AMC Free Parking - Navrangpura (Mithakhali)": "pool-069.jpg",
    "AMC Free Parking - Sabarmati (Vishwakarma Circle)": "pool-029.jpg",
    "AMC Free Parking - Navrangpura (Gulbai Tekra)": "pool-042.jpg",
    "AMC Free Parking - Ranip Overbridge": "pool-038.jpg",
    "AMC Free Parking - Vasna (Anjali Flyover)": "pool-012.jpg",
    "AMC Free Parking - Ambawadi (Shreyash Flyover)": "pool-077.jpg",
    "AMC Free Parking - Maninagar (Kankaria Lake)": "pool-004.jpg",
    "AMC Free Parking - Khokhra (Maninagar Station)": "pool-075.jpg",
}


def floor_levels(count):
    if count == 1:
        return [0]
    if count == 2:
        return [-1, -2]
    if count == 3:
        return [0, 1, 2]
    if count == 4:
        return [-1, 0, 1, 2]
    return list(range(count))


ALWAYS_24H = {
    ParkingLocation.RAILWAY, ParkingLocation.AIRPORT, ParkingLocation.HOSPITAL,
    ParkingLocation.MUNICIPAL, ParkingLocation.PUBLIC, ParkingLocation.SMART,
    ParkingLocation.BUS_STATION,
}
TYPE_HOURS = {
    ParkingLocation.MALL: ("10:00:00", "22:00:00"),
    ParkingLocation.TOURIST: ("07:00:00", "20:00:00"),
    ParkingLocation.PRIVATE: ("08:00:00", "20:00:00"),
    ParkingLocation.MULTI_LEVEL: ("06:00:00", "23:00:00"),
}


def landmark_image(name):
    if name in FREE_ZONE_IMAGES:
        return f"/images/parking/pool/{FREE_ZONE_IMAGES[name]}"
    name_lower = name.lower()
    for keyword, filename in LANDMARK_IMAGES.items():
        if keyword in name_lower:
            return f"/images/parking/gujarat/{filename}"
    return None


class Command(BaseCommand):
    help = "Seed the database with real Gujarat, India parking locations, floors, and slots."

    def handle(self, *args, **options):
        random.seed(42)

        landmarks = []
        for path in DATA_FILES:
            with open(path, encoding="utf-8") as f:
                landmarks.extend(json.load(f))

        landmarks = [item for item in landmarks if item["entry"][4] not in EXCLUDED_TYPES]

        # Build a shuffled, non-repeating pool of real/generic parking photos
        # for every location that doesn't have its own dedicated landmark photo.
        pool_files = sorted(p.name for p in POOL_DIR.glob("pool-*.jpg"))
        rng = random.Random(42)
        rng.shuffle(pool_files)
        pool_iter = iter(pool_files)

        ParkingLocation.objects.all().delete()

        for item in landmarks:
            entry = item["entry"]
            coords = item["coords"]
            (
                name, _query, city, district, parking_type, vehicle_types,
                description, amenities, price_per_hour, price_day_max, floor_count,
            ) = entry
            lat, lng = coords
            is_24h = parking_type in ALWAYS_24H
            opens_at, closes_at = TYPE_HOURS.get(parking_type, ("00:00:00", "23:59:59"))

            image_url = landmark_image(name)
            if not image_url:
                try:
                    image_url = f"/images/parking/pool/{next(pool_iter)}"
                except StopIteration:
                    raise RuntimeError(
                        "Ran out of unique pool images — add more files to "
                        "frontend/public/images/parking/pool/ before re-seeding."
                    )

            location = ParkingLocation.objects.create(
                name=name,
                address=f"{city}, {district}, Gujarat",
                city=city,
                district=district,
                state="Gujarat",
                country="India",
                latitude=lat,
                longitude=lng,
                parking_type=parking_type,
                vehicle_types=vehicle_types,
                description=description,
                amenities=amenities,
                price_per_hour=price_per_hour,
                price_day_max=price_day_max,
                image_url=image_url,
                is_24_hours=is_24h,
                opens_at=opens_at,
                closes_at=closes_at,
                rating=round(random.uniform(3.8, 4.8), 1),
                rating_count=random.randint(20, 300),
            )

            for level in floor_levels(floor_count):
                floor = ParkingFloor.objects.create(
                    location=location, name=FLOOR_NAMES[level], level=level
                )
                slots = []
                for r_idx, row in enumerate(ROWS):
                    for col in range(1, COLS + 1):
                        status = ParkingSlot.BOOKED if random.random() < 0.15 else ParkingSlot.AVAILABLE
                        slots.append(ParkingSlot(
                            floor=floor, code=f"{row}{col}", row=r_idx, col=col, status=status
                        ))
                ParkingSlot.objects.bulk_create(slots)

            self.stdout.write(self.style.SUCCESS(f"Seeded {location.name} ({location.city}) — {location.total_slots} slots"))

        self.stdout.write(self.style.SUCCESS(f"\nSeeded {len(landmarks)} Gujarat parking locations successfully."))
