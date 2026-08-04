from django.urls import path

from .owner_payment_views import OwnerPaymentHistoryView, OwnerPaymentSummaryView, OwnerRevenueAnalyticsView

urlpatterns = [
    path("summary", OwnerPaymentSummaryView.as_view(), name="owner-payment-summary"),
    path("revenue", OwnerRevenueAnalyticsView.as_view(), name="owner-payment-revenue"),
    path("history", OwnerPaymentHistoryView.as_view(), name="owner-payment-history"),
]
