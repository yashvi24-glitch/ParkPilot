import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

PHONE_RE = re.compile(r"^[6-9]\d{9}$")
GMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@gmail\.com$")


class SignupSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["full_name", "email", "phone", "password", "confirm_password"]

    def validate_email(self, value):
        value = value.strip().lower()
        if not GMAIL_RE.match(value):
            raise serializers.ValidationError("Enter a valid Gmail address (e.g. name@gmail.com).")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if not PHONE_RE.match(value):
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["full_name"] = user.full_name
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email", "phone", "profile_picture", "date_joined"]
        read_only_fields = ["id", "email", "date_joined"]
