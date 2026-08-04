from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import OwnerChangePasswordView, OwnerLoginView, OwnerProfileView, OwnerSignupView

urlpatterns = [
    path("signup", OwnerSignupView.as_view(), name="owner-signup"),
    path("login", OwnerLoginView.as_view(), name="owner-login"),
    path("refresh", TokenRefreshView.as_view(), name="owner-token-refresh"),
    path("profile", OwnerProfileView.as_view(), name="owner-profile"),
    path("change-password", OwnerChangePasswordView.as_view(), name="owner-change-password"),
]
