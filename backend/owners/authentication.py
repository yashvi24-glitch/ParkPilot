from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework_simplejwt.settings import api_settings

from .models import Owner


class OwnerJWTAuthentication(JWTAuthentication):
    """
    Resolves request.user against the Owner table instead of AUTH_USER_MODEL,
    and only accepts tokens minted by the owner login flow (carrying the
    "portal": "owner" claim) — this is what keeps Owner and User sessions from
    ever cross-authenticating, even if their primary keys happened to collide.
    """

    def get_user(self, validated_token):
        if validated_token.get("portal") != "owner":
            raise InvalidToken("Not an owner token.")

        owner_id = validated_token[api_settings.USER_ID_CLAIM]
        try:
            owner = Owner.objects.get(**{api_settings.USER_ID_FIELD: owner_id})
        except Owner.DoesNotExist:
            raise AuthenticationFailed("Owner not found.", code="user_not_found")

        if not owner.is_active:
            raise AuthenticationFailed("Owner account is inactive.", code="user_inactive")

        return owner
