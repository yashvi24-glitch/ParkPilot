"""
Shared owner-scoped booking/revenue aggregation — reused by the Owner
Dashboard, Bookings summary cards, Payments, and Reports pages so this join
and these date-bucket calculations exist in exactly one place.
"""
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from .models import Booking

RANGE_WINDOW = {"daily": ("days", 14), "weekly": ("weeks", 12), "monthly": ("months", 12), "yearly": ("years", 5)}


def owner_bookings_qs(owner):
    return Booking.objects.filter(slot__floor__location__owner=owner)


def booking_summary_stats(owner):
    bookings = owner_bookings_qs(owner)

    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    paid = bookings.filter(payment_status=Booking.PAYMENT_PAID)

    return {
        "total_bookings": bookings.count(),
        "today_bookings": bookings.filter(date=today).count(),
        "active_bookings": bookings.filter(status=Booking.ACTIVE).count(),
        "completed_bookings": bookings.filter(status=Booking.COMPLETED).count(),
        "cancelled_bookings": bookings.filter(status=Booking.CANCELLED).count(),
        "today_revenue": paid.filter(date=today).aggregate(total=Sum("amount"))["total"] or 0,
        "weekly_revenue": paid.filter(date__gte=week_start).aggregate(total=Sum("amount"))["total"] or 0,
        "monthly_revenue": paid.filter(date__gte=month_start).aggregate(total=Sum("amount"))["total"] or 0,
        "pending_payments": bookings.filter(payment_status=Booking.PAYMENT_PENDING).count(),
        "successful_payments": paid.count(),
        "refunded_payments": bookings.filter(payment_status=Booking.PAYMENT_REFUNDED).count(),
    }


def _range_start(today, range_key):
    unit, periods = RANGE_WINDOW[range_key]
    if unit == "days":
        return today - timedelta(days=periods - 1)
    if unit == "weeks":
        return today - timedelta(weeks=periods - 1)
    if unit == "months":
        month = today.month - (periods - 1)
        year = today.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        return today.replace(year=year, month=month, day=1)
    return today.replace(year=today.year - (periods - 1), month=1, day=1)


def _bucket_key(d, range_key):
    if range_key == "daily":
        return d
    if range_key == "weekly":
        return d - timedelta(days=d.weekday())
    if range_key == "monthly":
        return d.replace(day=1)
    return d.replace(month=1, day=1)


def _bucket_sequence(start, today, range_key):
    """Ordered, de-duplicated bucket keys spanning [start, today] — so empty
    periods still show up as zero instead of leaving gaps in a chart."""
    keys = []
    d = start
    while d <= today:
        key = _bucket_key(d, range_key)
        if not keys or keys[-1] != key:
            keys.append(key)
        d += timedelta(days=1)
    return keys


def _time_series(owner, range_key, extra_filter, value_fn):
    """
    Buckets are computed in Python rather than via Django's Trunc* functions —
    TruncDate/TruncWeek/etc. wrap DateField values in a MySQL CONVERT_TZ() call
    meant for datetimes, which returns NULL for a plain date under this
    DB backend. Owner-scoped datasets are small enough that this is cheap.
    """
    range_key = range_key if range_key in RANGE_WINDOW else "daily"
    today = timezone.localdate()
    start = _range_start(today, range_key)

    qs = owner_bookings_qs(owner).filter(date__gte=start)
    if extra_filter:
        qs = qs.filter(**extra_filter)

    buckets = {}
    for row in qs.only("date", "amount"):
        buckets.setdefault(_bucket_key(row.date, range_key), []).append(row)

    sequence = _bucket_sequence(start, today, range_key)
    data = [{"period": key.isoformat(), "value": value_fn(buckets.get(key, []))} for key in sequence]
    return range_key, data


def revenue_time_series(owner, range_key):
    """Daily/weekly/monthly/yearly revenue buckets — shared by Payments and Reports."""
    return _time_series(
        owner, range_key, {"payment_status": Booking.PAYMENT_PAID},
        lambda rows: float(sum(r.amount for r in rows)),
    )


def booking_time_series(owner, range_key):
    """Daily/weekly/monthly/yearly booking-count buckets, for Reports' booking trends."""
    return _time_series(owner, range_key, None, len)
