from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Owner


@admin.register(Owner)
class OwnerAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["email", "business_name", "owner_name", "phone", "is_staff", "is_active"]
    search_fields = ["email", "business_name", "owner_name", "phone"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Business info", {"fields": ("owner_name", "business_name", "phone")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "owner_name", "business_name", "phone", "password1", "password2"),
        }),
    )
    readonly_fields = ["date_joined", "last_login"]
