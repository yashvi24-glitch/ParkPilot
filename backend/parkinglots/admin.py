from django.contrib import admin

from .models import ParkingFloor, ParkingLocation, ParkingSlot


class ParkingFloorInline(admin.TabularInline):
    model = ParkingFloor
    extra = 0


@admin.register(ParkingLocation)
class ParkingLocationAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "parking_type", "rating", "price_per_hour", "total_slots", "available_slots"]
    list_filter = ["city", "parking_type"]
    search_fields = ["name", "address", "city"]
    inlines = [ParkingFloorInline]


@admin.register(ParkingFloor)
class ParkingFloorAdmin(admin.ModelAdmin):
    list_display = ["location", "name", "level", "total_slots", "available_slots"]
    list_filter = ["location"]


@admin.register(ParkingSlot)
class ParkingSlotAdmin(admin.ModelAdmin):
    list_display = ["floor", "code", "status"]
    list_filter = ["floor__location", "status"]
