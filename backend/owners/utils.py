from .models import OwnerNotification


def owner_notify(owner, notif_type, title, message, link=""):
    if owner is None:
        return None
    return OwnerNotification.objects.create(
        owner=owner, type=notif_type, title=title, message=message, link=link
    )
