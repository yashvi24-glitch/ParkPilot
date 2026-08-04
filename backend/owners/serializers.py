import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Owner, OwnerNotification

PHONE_RE = re.compile(r"^[6-9]\d{9}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class OwnerSignupSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = Owner
        fields = ["owner_name", "business_name", "email", "phone", "password", "confirm_password"]

    def validate_owner_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Owner name is required.")
        return value

    def validate_business_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Business name is required.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if not EMAIL_RE.match(value):
            raise serializers.ValidationError("Enter a valid email address.")
        if Owner.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An owner account with this email already exists.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if not PHONE_RE.match(value):
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        if Owner.objects.filter(phone=value).exists():
            raise serializers.ValidationError("An owner account with this phone number already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        return Owner.objects.create_user(**validated_data)


class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = [
            "id", "owner_name", "business_name", "email", "phone", "date_joined",
            "business_address", "gst_number", "business_registration_number", "business_description",
            "upi_id", "qr_code", "bank_name", "account_holder_name", "account_number", "ifsc_code",
        ]
        read_only_fields = ["id", "email", "date_joined"]


class OwnerLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from rest_framework_simplejwt.tokens import RefreshToken

        email = attrs["email"].strip().lower()
        owner = Owner.objects.filter(email__iexact=email).first()
        if not owner or not owner.check_password(attrs["password"]) or not owner.is_active:
            raise serializers.ValidationError("No active owner account found with these credentials.")

        refresh = RefreshToken.for_user(owner)
        refresh["portal"] = "owner"
        refresh["business_name"] = owner.business_name

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "owner": OwnerSerializer(owner).data,
        }


class OwnerNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnerNotification
        fields = ["id", "type", "title", "message", "link", "is_read", "created_at"]
        read_only_fields = fields


class OwnerChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_current_password(self, value):
        if not self.context["owner"].check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
