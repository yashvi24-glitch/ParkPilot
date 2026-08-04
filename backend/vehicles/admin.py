from django.contrib import admin

from .models import Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["plate_number", "owner", "vehicle_type", "created_at"]
    search_fields = ["plate_number", "owner__email"]
