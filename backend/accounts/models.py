from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        PROFESSIONAL = "professional", "Professionnel"

    class AdminRole(models.TextChoices):
        NONE = "", "Aucun"
        ADMIN = "admin", "Admin"
        MODERATOR = "moderator", "Modérateur"
        SUPPORT = "support", "Support"
        OPS = "ops", "Ops"

    email = models.EmailField("email", unique=True)
    role = models.CharField(
        "rôle",
        max_length=20,
        choices=Role.choices,
        default=Role.PROFESSIONAL,
    )
    admin_role = models.CharField(
        "rôle admin interne",
        max_length=20,
        choices=AdminRole.choices,
        default=AdminRole.NONE,
        blank=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self) -> str:
        return self.email
