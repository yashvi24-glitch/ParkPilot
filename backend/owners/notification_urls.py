from django.urls import path

from .views import OwnerNotificationListView, OwnerNotificationMarkAllReadView, OwnerNotificationMarkReadView

urlpatterns = [
    path("", OwnerNotificationListView.as_view(), name="owner-notification-list"),
    path("<int:pk>/read", OwnerNotificationMarkReadView.as_view(), name="owner-notification-read"),
    path("read-all", OwnerNotificationMarkAllReadView.as_view(), name="owner-notification-read-all"),
]
