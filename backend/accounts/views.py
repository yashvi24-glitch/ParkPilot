from rest_framework import generics, permissions
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import LoginSerializer, SignupSerializer, UserSerializer


class SignupView(generics.CreateAPIView):
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user
