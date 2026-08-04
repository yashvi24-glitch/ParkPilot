from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["booking_code", "user", "slot", "date", "status", "amount"]
    list_filter = ["status", "date"]
    search_fields = ["booking_code", "user__email"]
