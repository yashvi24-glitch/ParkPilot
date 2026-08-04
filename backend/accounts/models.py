from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, phone, full_name, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        if not phone:
            raise ValueError("Users must have a phone number")
        email = self.normalize_email(email)
        user = self.model(email=email, phone=phone, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, phone, full_name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, phone, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, unique=True)
    full_name = models.CharField(max_length=150)
    profile_picture = models.ImageField(upload_to="profile_pictures/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["phone", "full_name"]

    def __str__(self):
        return self.email

    @property
    def first_initial(self):
        return self.full_name[:1].upper() if self.full_name else "?"
