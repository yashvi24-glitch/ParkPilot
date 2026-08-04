from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/owner/auth/", include("owners.urls")),
    path("api/owner/notifications/", include("owners.notification_urls")),
    path("api/owner/parking/", include("parkinglots.owner_urls")),
    path("api/owner/reports/", include("parkinglots.owner_reports_urls")),
    path("api/vehicles", include("vehicles.urls")),
    path("api/parking/", include("parkinglots.urls")),
    path("api/bookings", include("bookings.urls")),
    path("api/owner/bookings/", include("bookings.owner_urls")),
    path("api/owner/payments/", include("bookings.owner_payment_urls")),
    path("api/notifications", include("notifications.urls")),
    path("api/navigation/", include("navigation.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
