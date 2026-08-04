"""
CSV bulk-import for the Owner Portal. Every importer validates the whole file
first (collecting every row error, not just the first) and only writes to the
database if there are zero errors — matching the spec's "if any validation
fails, the import should be rejected" with row/column/reason reporting.
"""
import csv
import io
from datetime import datetime

from django.db import transaction

from .models import ParkingFloor, ParkingLocation, ParkingSlot
from .owner_serializers import OwnerParkingLocationSerializer

VALID_VEHICLE_TYPES = {"car", "bike"}
VALID_SLOT_STATUSES = {s for s, _ in ParkingSlot.STATUS_CHOICES}
VALID_CATEGORIES = {c for c, _ in ParkingLocation.CATEGORY_CHOICES}
VALID_PARKING_MODES = {
    "slot_based": ParkingLocation.SLOT_BASED,
    "slot-based": ParkingLocation.SLOT_BASED,
    "slot-based parking": ParkingLocation.SLOT_BASED,
    "open_ground": ParkingLocation.OPEN_GROUND,
    "open ground": ParkingLocation.OPEN_GROUND,
    "open ground parking": ParkingLocation.OPEN_GROUND,
}

TRUTHY = {"yes", "y", "true", "1"}


class RowError(Exception):
    """Raised for a single-row validation failure; message doubles as the reason."""

    def __init__(self, column, message):
        self.column = column
        self.message = message
        super().__init__(message)


def read_csv(file, required_columns):
    """Returns (rows, top_level_errors). rows is a list of (row_number, dict)."""
    text = io.TextIOWrapper(file, encoding="utf-8-sig")
    reader = csv.DictReader(text)
    fieldnames = set(reader.fieldnames or [])
    missing = [c for c in required_columns if c not in fieldnames]
    if missing:
        return [], [f"Missing required column(s): {', '.join(missing)}"]

    rows = [(i, row) for i, row in enumerate(reader, start=2)]
    return rows, []


def require(row, column):
    value = (row.get(column) or "").strip()
    if not value:
        raise RowError(column, "This field is required and cannot be empty.")
    return value


def validate_latlng(row):
    try:
        lat = float(require(row, "Latitude"))
        lng = float(require(row, "Longitude"))
    except ValueError:
        raise RowError("Latitude/Longitude", "Latitude and Longitude must be valid numbers.")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise RowError("Latitude/Longitude", "Latitude must be -90..90 and Longitude -180..180.")
    return lat, lng


def validate_time(value, column):
    value = value.strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    raise RowError(column, "Time must be in HH:MM or HH:MM:SS format.")


def validate_time_range(row):
    opens = validate_time(require(row, "Opening_Time"), "Opening_Time")
    closes = validate_time(require(row, "Closing_Time"), "Closing_Time")
    if opens >= closes:
        raise RowError("Closing_Time", "Closing time must be after opening time.")
    return opens, closes


def validate_vehicle_types(value, column="Vehicle_Types"):
    tokens = [t.strip() for t in value.split(",") if t.strip()]
    if not tokens:
        raise RowError(column, "At least one vehicle type is required.")
    invalid = [t for t in tokens if t.lower() not in VALID_VEHICLE_TYPES]
    if invalid:
        raise RowError(column, f"Invalid vehicle type(s): {', '.join(invalid)}. Only Car and Bike are supported.")
    return ", ".join(t.capitalize() for t in tokens)


def validate_price(value, column):
    try:
        price = float(value)
    except (TypeError, ValueError):
        raise RowError(column, "Price must be a valid number.")
    if price < 0:
        raise RowError(column, "Price cannot be negative.")
    return price


def validate_category(value):
    normalized = value.strip().lower()
    if normalized not in VALID_CATEGORIES:
        raise RowError("Parking_Category", f"Invalid category '{value}'. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}.")
    return normalized


def validate_parking_mode(value):
    normalized = value.strip().lower()
    if normalized not in VALID_PARKING_MODES:
        raise RowError("Parking_Type", f"Invalid parking type '{value}'. Must be Slot-Based Parking or Open Ground Parking.")
    return VALID_PARKING_MODES[normalized]


def import_locations(owner, file):
    rows, top_errors = read_csv(file, [
        "Parking_ID", "Parking_Name", "Parking_Category", "Parking_Type", "Address", "City",
        "District", "State", "Pincode", "Latitude", "Longitude", "Opening_Time", "Closing_Time",
        "Total_Capacity", "Vehicle_Types", "Price_Per_Hour", "Contact_Number", "Description",
    ])
    if top_errors:
        return {"created": 0, "updated": 0, "errors": [{"row": None, "column": None, "message": e} for e in top_errors]}

    errors = []
    seen_ids = set()
    validated = []

    for row_num, row in rows:
        try:
            parking_id = require(row, "Parking_ID")
            if parking_id in seen_ids:
                raise RowError("Parking_ID", f"Duplicate Parking_ID '{parking_id}' in this file.")
            seen_ids.add(parking_id)

            name = require(row, "Parking_Name")
            category = validate_category(require(row, "Parking_Category"))
            parking_mode = validate_parking_mode(require(row, "Parking_Type"))
            address = require(row, "Address")
            city = require(row, "City")
            district = require(row, "District")
            state = require(row, "State")
            pincode = require(row, "Pincode")
            lat, lng = validate_latlng(row)
            opens_at, closes_at = validate_time_range(row)
            vehicle_types = validate_vehicle_types(require(row, "Vehicle_Types"))
            price_per_hour = validate_price(require(row, "Price_Per_Hour"), "Price_Per_Hour")
            contact_number = (row.get("Contact_Number") or "").strip()
            description = (row.get("Description") or "").strip()
            image_url = (row.get("Parking_Image_URL") or "").strip()

            total_capacity = None
            if parking_mode == ParkingLocation.OPEN_GROUND:
                total_capacity_raw = require(row, "Total_Capacity")
                try:
                    total_capacity = int(total_capacity_raw)
                except ValueError:
                    raise RowError("Total_Capacity", "Total_Capacity must be a whole number.")
                if total_capacity < 1:
                    raise RowError("Total_Capacity", "Total_Capacity must be at least 1.")

            validated.append({
                "parking_id": parking_id, "name": name, "category": category, "parking_mode": parking_mode,
                "address": address, "city": city, "district": district, "state": state, "pincode": pincode,
                "latitude": lat, "longitude": lng, "opens_at": opens_at, "closes_at": closes_at,
                "vehicle_types": vehicle_types, "price_per_hour": price_per_hour,
                "contact_number": contact_number, "description": description, "image_url": image_url,
                "total_capacity": total_capacity,
            })
        except RowError as e:
            errors.append({"row": row_num, "column": e.column, "message": e.message})

    if errors:
        return {"created": 0, "updated": 0, "errors": errors}

    created = 0
    updated = 0
    with transaction.atomic():
        for data in validated:
            existing = ParkingLocation.objects.filter(owner=owner, csv_ref=data["parking_id"]).first()
            fields = dict(
                name=data["name"], category=data["category"], parking_mode=data["parking_mode"],
                address=data["address"], city=data["city"], district=data["district"], state=data["state"],
                pincode=data["pincode"], latitude=data["latitude"], longitude=data["longitude"],
                opens_at=data["opens_at"], closes_at=data["closes_at"], is_24_hours=False,
                vehicle_types=data["vehicle_types"], price_per_hour=data["price_per_hour"],
                contact_number=data["contact_number"], description=data["description"],
                image_url=data["image_url"], owner=owner, csv_ref=data["parking_id"],
                parking_type=ParkingLocation.PRIVATE, is_active=True,
            )
            if existing:
                for key, value in fields.items():
                    setattr(existing, key, value)
                existing.save()
                if data["total_capacity"] is not None:
                    OwnerParkingLocationSerializer._resize_open_ground_slots(existing, data["total_capacity"])
                updated += 1
            else:
                location = ParkingLocation.objects.create(**fields)
                if data["total_capacity"] is not None:
                    OwnerParkingLocationSerializer._provision_open_ground_slots(location, data["total_capacity"])
                created += 1

    return {"created": created, "updated": updated, "errors": []}


def import_floors(owner, file):
    rows, top_errors = read_csv(file, ["Floor_ID", "Parking_ID", "Floor_Name", "Total_Slots"])
    if top_errors:
        return {"created": 0, "updated": 0, "errors": [{"row": None, "column": None, "message": e} for e in top_errors]}

    errors = []
    seen = set()
    validated = []

    for row_num, row in rows:
        try:
            floor_id = require(row, "Floor_ID")
            parking_id = require(row, "Parking_ID")
            key = (parking_id, floor_id)
            if key in seen:
                raise RowError("Floor_ID", f"Duplicate Floor_ID '{floor_id}' for Parking_ID '{parking_id}' in this file.")
            seen.add(key)

            location = ParkingLocation.objects.filter(owner=owner, csv_ref=parking_id).first()
            if not location:
                raise RowError("Parking_ID", f"Parking_ID '{parking_id}' not found — upload the Parking Information CSV first.")
            if location.parking_mode != ParkingLocation.SLOT_BASED:
                raise RowError("Parking_ID", f"Parking_ID '{parking_id}' is Open Ground parking — floors don't apply.")

            floor_name = require(row, "Floor_Name")
            validated.append({"location": location, "floor_id": floor_id, "name": floor_name})
        except RowError as e:
            errors.append({"row": row_num, "column": e.column, "message": e.message})

    if errors:
        return {"created": 0, "updated": 0, "errors": errors}

    created = 0
    updated = 0
    with transaction.atomic():
        for i, data in enumerate(validated):
            existing = ParkingFloor.objects.filter(location=data["location"], csv_ref=data["floor_id"]).first()
            if existing:
                existing.name = data["name"]
                existing.save()
                updated += 1
            else:
                next_level = data["location"].floors.count()
                ParkingFloor.objects.create(
                    location=data["location"], name=data["name"], level=next_level, csv_ref=data["floor_id"]
                )
                created += 1

    return {"created": created, "updated": updated, "errors": []}


def import_slots(owner, file):
    rows, top_errors = read_csv(file, ["Slot_ID", "Parking_ID", "Floor_ID", "Slot_Number", "Vehicle_Type", "Slot_Status"])
    if top_errors:
        return {"created": 0, "updated": 0, "errors": [{"row": None, "column": None, "message": e} for e in top_errors]}

    errors = []
    seen = set()
    validated = []

    for row_num, row in rows:
        try:
            parking_id = require(row, "Parking_ID")
            floor_id = require(row, "Floor_ID")
            slot_number = require(row, "Slot_Number")
            key = (parking_id, floor_id, slot_number)
            if key in seen:
                raise RowError("Slot_Number", f"Duplicate Slot_Number '{slot_number}' on Floor_ID '{floor_id}'.")
            seen.add(key)

            location = ParkingLocation.objects.filter(owner=owner, csv_ref=parking_id).first()
            if not location:
                raise RowError("Parking_ID", f"Parking_ID '{parking_id}' not found — upload the Parking Information CSV first.")

            floor = ParkingFloor.objects.filter(location=location, csv_ref=floor_id).first()
            if not floor:
                raise RowError("Floor_ID", f"Floor_ID '{floor_id}' not found for Parking_ID '{parking_id}' — upload the Floor Information CSV first.")

            if ParkingSlot.objects.filter(floor=floor, code=slot_number).exists():
                raise RowError("Slot_Number", f"Slot number '{slot_number}' already exists on this floor.")

            # Validated but not persisted — ParkingSlot has no per-slot vehicle-type
            # field today; only the value's validity is checked.
            vehicle_type = require(row, "Vehicle_Type")
            if vehicle_type.strip().lower() not in VALID_VEHICLE_TYPES:
                raise RowError("Vehicle_Type", f"Invalid vehicle type '{vehicle_type}'. Only Car and Bike are supported.")

            status_raw = require(row, "Slot_Status")
            status = status_raw.strip().lower()
            if status not in VALID_SLOT_STATUSES:
                raise RowError("Slot_Status", f"Invalid status '{status_raw}'. Must be one of: Available, Booked, Reserved, Maintenance.")

            validated.append({"floor": floor, "code": slot_number, "status": status})
        except RowError as e:
            errors.append({"row": row_num, "column": e.column, "message": e.message})

    if errors:
        return {"created": 0, "updated": 0, "errors": errors}

    created = 0
    with transaction.atomic():
        floor_next_col = {}
        for data in validated:
            floor = data["floor"]
            next_col = floor_next_col.get(floor.id)
            if next_col is None:
                next_col = floor.slots.count() + 1
            ParkingSlot.objects.create(floor=floor, code=data["code"], row=0, col=next_col, status=data["status"])
            floor_next_col[floor.id] = next_col + 1
            created += 1

    return {"created": created, "updated": 0, "errors": []}


def import_pricing(owner, file):
    rows, top_errors = read_csv(file, ["Parking_ID", "Vehicle_Type", "Price_Per_Hour", "Daily_Rate"])
    if top_errors:
        return {"created": 0, "updated": 0, "errors": [{"row": None, "column": None, "message": e} for e in top_errors]}

    errors = []
    validated = []

    for row_num, row in rows:
        try:
            parking_id = require(row, "Parking_ID")
            location = ParkingLocation.objects.filter(owner=owner, csv_ref=parking_id).first()
            if not location:
                raise RowError("Parking_ID", f"Parking_ID '{parking_id}' not found — upload the Parking Information CSV first.")

            vehicle_type = require(row, "Vehicle_Type")
            if vehicle_type.strip().lower() not in VALID_VEHICLE_TYPES:
                raise RowError("Vehicle_Type", f"Invalid vehicle type '{vehicle_type}'. Only Car and Bike are supported.")

            price_per_hour = validate_price(require(row, "Price_Per_Hour"), "Price_Per_Hour")
            daily_rate = validate_price(require(row, "Daily_Rate"), "Daily_Rate")

            validated.append({"location": location, "price_per_hour": price_per_hour, "daily_rate": daily_rate})
        except RowError as e:
            errors.append({"row": row_num, "column": e.column, "message": e.message})

    if errors:
        return {"created": 0, "updated": 0, "errors": errors}

    updated = 0
    with transaction.atomic():
        # Last matching row per location wins (see plan: no per-vehicle-type
        # pricing exists anywhere in the app yet — this CSV writes the
        # location's single price fields).
        for data in validated:
            location = data["location"]
            location.price_per_hour = data["price_per_hour"]
            location.price_day_max = data["daily_rate"]
            location.save(update_fields=["price_per_hour", "price_day_max"])
            updated += 1

    return {"created": 0, "updated": updated, "errors": []}


FACILITY_COLUMNS = {
    "CCTV": "CCTV",
    "Security": "Security",
    "EV_Charging": "EV Charging",
    "Disabled_Parking": "Disabled Parking",
    "Covered_Parking": "Covered Parking",
}


def import_facilities(owner, file):
    rows, top_errors = read_csv(file, ["Parking_ID", *FACILITY_COLUMNS.keys()])
    if top_errors:
        return {"created": 0, "updated": 0, "errors": [{"row": None, "column": None, "message": e} for e in top_errors]}

    errors = []
    validated = []

    for row_num, row in rows:
        try:
            parking_id = require(row, "Parking_ID")
            location = ParkingLocation.objects.filter(owner=owner, csv_ref=parking_id).first()
            if not location:
                raise RowError("Parking_ID", f"Parking_ID '{parking_id}' not found — upload the Parking Information CSV first.")

            selected = [
                label for column, label in FACILITY_COLUMNS.items()
                if (row.get(column) or "").strip().lower() in TRUTHY
            ]
            validated.append({"location": location, "amenities": selected})
        except RowError as e:
            errors.append({"row": row_num, "column": e.column, "message": e.message})

    if errors:
        return {"created": 0, "updated": 0, "errors": errors}

    updated = 0
    with transaction.atomic():
        for data in validated:
            location = data["location"]
            existing = [a.strip() for a in (location.amenities or "").split(",") if a.strip()]
            merged = existing + [a for a in data["amenities"] if a not in existing]
            location.amenities = ", ".join(merged)
            location.save(update_fields=["amenities"])
            updated += 1

    return {"created": 0, "updated": updated, "errors": []}
