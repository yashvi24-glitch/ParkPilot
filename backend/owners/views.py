from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import OwnerJWTAuthentication
from .models import OwnerNotification
from .serializers import (
    OwnerChangePasswordSerializer,
    OwnerLoginSerializer,
    OwnerNotificationSerializer,
    OwnerSerializer,
    OwnerSignupSerializer,
)
from .utils import owner_notify


class OwnerSignupView(generics.CreateAPIView):
    serializer_class = OwnerSignupSerializer
    permission_classes = [permissions.AllowAny]


class OwnerLoginView(generics.GenericAPIView):
    serializer_class = OwnerLoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class OwnerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = OwnerSerializer
    authentication_classes = [OwnerJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user


class OwnerScopedMixin:
    authentication_classes = [OwnerJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class OwnerNotificationListView(OwnerScopedMixin, generics.ListAPIView):
    serializer_class = OwnerNotificationSerializer

    def get_queryset(self):
        return OwnerNotification.objects.filter(owner=self.request.user)


class OwnerNotificationMarkReadView(OwnerScopedMixin, APIView):
    def post(self, request, pk):
        updated = OwnerNotification.objects.filter(pk=pk, owner=request.user).update(is_read=True)
        if not updated:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"status": "ok"})


class OwnerNotificationMarkAllReadView(OwnerScopedMixin, APIView):
    def post(self, request):
        OwnerNotification.objects.filter(owner=request.user, is_read=False).update(is_read=True)
        return Response({"status": "ok"})


class OwnerChangePasswordView(OwnerScopedMixin, APIView):
    def post(self, request):
        serializer = OwnerChangePasswordSerializer(data=request.data, context={"owner": request.user})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        owner_notify(
            request.user, OwnerNotification.PASSWORD_CHANGED,
            "Password Changed", "Your account password was changed successfully.",
            link="/owner/profile",
        )
        return Response({"status": "ok"})
