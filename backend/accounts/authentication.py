from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class UserJWTAuthentication(JWTAuthentication):
    """
    Rejects tokens minted by the owner login flow (carrying a "portal": "owner"
    claim) so an Owner session can never authenticate against a regular User
    endpoint, even if their primary keys happened to collide. Regular user
    tokens never carry this claim, so normal login is unaffected.
    """

    def get_user(self, validated_token):
        if validated_token.get("portal") == "owner":
            raise InvalidToken("Not a user token.")
        return super().get_user(validated_token)
