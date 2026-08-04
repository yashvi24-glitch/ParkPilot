from django.core.validators import FileExtensionValidator
from django.db import models


def validate_image_size(file):
    max_bytes = 5 * 1024 * 1024
    if file.size > max_bytes:
        from django.core.exceptions import ValidationError
        raise ValidationError("Image must be smaller than 5MB.")


class ParkingLocation(models.Model):
    MUNICIPAL = "municipal"
    PUBLIC = "public"
    PRIVATE = "private"
    MALL = "mall"
    RAILWAY = "railway_station"
    AIRPORT = "airport"
    HOSPITAL = "hospital"
    TOURIST = "tourist_attraction"
    SMART = "smart"
    MULTI_LEVEL = "multi_level"
    BUS_STATION = "bus_station"
    PARKING_TYPE_CHOICES = [
        (MUNICIPAL, "Municipal Parking"),
        (PUBLIC, "Public Parking"),
        (PRIVATE, "Private Parking"),
        (MALL, "Mall Parking"),
        (RAILWAY, "Railway Station Parking"),
        (AIRPORT, "Airport Parking"),
        (HOSPITAL, "Hospital Parking"),
        (TOURIST, "Tourist Attraction Parking"),
        (SMART, "Smart Parking"),
        (MULTI_LEVEL, "Multi-Level Parking"),
        (BUS_STATION, "Bus Station Parking"),
    ]

    SLOT_BASED = "slot_based"
    OPEN_GROUND = "open_ground"
    PARKING_MODE_CHOICES = [
        (SLOT_BASED, "Slot-Based Parking"),
        (OPEN_GROUND, "Open Ground Parking"),
    ]

    CATEGORY_MALL = "mall"
    CATEGORY_HOSPITAL = "hospital"
    CATEGORY_HOTEL = "hotel"
    CATEGORY_OFFICE = "office"
    CATEGORY_RESIDENTIAL = "residential"
    CATEGORY_OTHER = "other"
    CATEGORY_CHOICES = [
        (CATEGORY_MALL, "Mall"),
        (CATEGORY_HOSPITAL, "Hospital"),
        (CATEGORY_HOTEL, "Hotel"),
        (CATEGORY_OFFICE, "Office"),
        (CATEGORY_RESIDENTIAL, "Residential"),
        (CATEGORY_OTHER, "Other"),
    ]

    owner = models.ForeignKey(
        "owners.Owner", related_name="parking_locations", on_delete=models.CASCADE, null=True, blank=True
    )
    parking_mode = models.CharField(max_length=15, choices=PARKING_MODE_CHOICES, default=SLOT_BASED)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, blank=True)
    monthly_price = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True)
    # Owner-chosen identifier from their own CSV/spreadsheet (the CSV import's
    # "Parking_ID"), unique per-owner — lets Floor/Slot/Pricing/Facilities CSVs
    # uploaded in later requests find this same location again. Uniqueness is
    # enforced in csv_import.py rather than a DB constraint, since it only
    # matters for owner-created rows.
    csv_ref = models.CharField(max_length=50, blank=True)
    # "Deleting" a facility can't be a real row delete — Booking.slot is
    # PROTECT (so history survives even after a facility is removed), and a
    # hard delete would raise ProtectedError the moment any booking, even a
    # long-completed one, exists against any of its slots. Owner deletion and
    # user-facing search/browse instead just filter on this flag.
    is_active = models.BooleanField(default=True)

    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100, default="Ahmedabad")
    district = models.CharField(max_length=100, default="Ahmedabad")
    state = models.CharField(max_length=100, default="Gujarat")
    country = models.CharField(max_length=100, default="India")
    pincode = models.CharField(max_length=6, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    parking_type = models.CharField(max_length=20, choices=PARKING_TYPE_CHOICES, default=PUBLIC)
    vehicle_types = models.CharField(max_length=150, default="Car, Bike")
    description = models.TextField(blank=True)
    amenities = models.CharField(max_length=255, blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    available_days = models.CharField(max_length=100, default="All Days")
    google_maps_url = models.URLField(blank=True)
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=4.5)
    rating_count = models.PositiveIntegerField(default=0)
    opens_at = models.TimeField(default="00:00:00")
    closes_at = models.TimeField(default="23:59:59")
    is_24_hours = models.BooleanField(default=True)
    price_per_hour = models.DecimalField(max_digits=8, decimal_places=2, default=30)
    price_day_max = models.DecimalField(max_digits=8, decimal_places=2, default=200)
    image = models.ImageField(upload_to="parking_locations/", blank=True, null=True)
    image_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.google_maps_url and self.latitude and self.longitude:
            self.google_maps_url = f"https://www.google.com/maps?q={self.latitude},{self.longitude}"
        super().save(*args, **kwargs)

    @property
    def total_slots(self):
        return ParkingSlot.objects.filter(floor__location=self).count()

    @property
    def available_slots(self):
        return ParkingSlot.objects.filter(floor__location=self, status=ParkingSlot.AVAILABLE).count()


class ParkingFloor(models.Model):
    location = models.ForeignKey(ParkingLocation, related_name="floors", on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    level = models.IntegerField(help_text="Ordering: negative = basement, 0 = ground, positive = upper floors")
    # CSV import's "Floor_ID" — unique per location, enforced in csv_import.py.
    csv_ref = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["level"]
        unique_together = ["location", "name"]

    def __str__(self):
        return f"{self.location.name} - {self.name}"

    @property
    def total_slots(self):
        return self.slots.count()

    @property
    def available_slots(self):
        return self.slots.filter(status=ParkingSlot.AVAILABLE).count()


class ParkingSlot(models.Model):
    AVAILABLE = "available"
    BOOKED = "booked"
    RESERVED = "reserved"
    MAINTENANCE = "maintenance"
    STATUS_CHOICES = [
        (AVAILABLE, "Available"),
        (BOOKED, "Booked"),
        (RESERVED, "Reserved"),
        (MAINTENANCE, "Maintenance"),
    ]

    CAR = "car"
    BIKE = "bike"
    EV = "ev"
    SUV = "suv"
    OTHER = "other"
    VEHICLE_TYPE_CHOICES = [
        (CAR, "Car"),
        (BIKE, "Bike"),
        (EV, "EV"),
        (SUV, "SUV"),
        (OTHER, "Other"),
    ]

    floor = models.ForeignKey(ParkingFloor, related_name="slots", on_delete=models.CASCADE)
    code = models.CharField(max_length=10)
    row = models.PositiveIntegerField()
    col = models.PositiveIntegerField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=AVAILABLE)
    vehicle_type = models.CharField(max_length=10, choices=VEHICLE_TYPE_CHOICES, default=CAR)

    class Meta:
        ordering = ["row", "col"]
        unique_together = ["floor", "code"]

    def __str__(self):
        return f"{self.floor} - {self.code}"


class ParkingImage(models.Model):
    location = models.ForeignKey(ParkingLocation, related_name="gallery_images", on_delete=models.CASCADE)
    image = models.ImageField(
        upload_to="parking_gallery/",
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"]), validate_image_size],
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at"]

    def __str__(self):
        return f"{self.location.name} image #{self.pk}"
