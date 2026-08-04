from .models import Notification


def notify(user, notif_type, title, message):
    return Notification.objects.create(user=user, type=notif_type, title=title, message=message)
