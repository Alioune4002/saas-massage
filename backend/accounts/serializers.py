from django.db import transaction
from django.utils.text import slugify
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import User
from professionals.models import (
    ProfessionalPaymentAccount,
    ProfessionalProfile,
    RESERVED_PUBLIC_SLUGS,
)


class UserMeSerializer(serializers.ModelSerializer):
    onboarding_completed = serializers.SerializerMethodField()
    professional_slug = serializers.SerializerMethodField()
    professional_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "role",
            "onboarding_completed",
            "professional_slug",
            "professional_name",
        )

    def get_onboarding_completed(self, obj):
        profile = getattr(obj, "professional_profile", None)
        return bool(profile and profile.onboarding_completed)

    def get_professional_slug(self, obj):
        profile = getattr(obj, "professional_profile", None)
        return profile.slug if profile else ""

    def get_professional_name(self, obj):
        profile = getattr(obj, "professional_profile", None)
        return profile.business_name if profile else ""


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError("Identifiants invalides.")

        if not user.is_active:
            raise serializers.ValidationError("Compte désactivé.")

        attrs["user"] = user
        return attrs


class RegisterPractitionerSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirmation = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value: str):
        normalized = value.strip().lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse email.")
        return normalized

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirmation"]:
            raise serializers.ValidationError(
                {"password_confirmation": "Les mots de passe ne correspondent pas."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        first_name = validated_data["first_name"].strip()
        last_name = validated_data["last_name"].strip()
        email = validated_data["email"]
        password = validated_data["password"]

        username_base = slugify(f"{first_name}-{last_name}") or email.split("@")[0]
        username = self._build_unique_username(username_base)

        user = User.objects.create_user(
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.PROFESSIONAL,
        )

        business_name = " ".join(part for part in [first_name, last_name] if part).strip()
        business_name = business_name or "Mon espace praticien"
        slug = self._build_unique_slug(slugify(business_name) or username)

        profile = ProfessionalProfile.objects.create(
            user=user,
            business_name=business_name,
            slug=slug,
            activity_type=ProfessionalProfile.ActivityType.SOLO,
            practice_mode=ProfessionalProfile.PracticeMode.STUDIO,
            onboarding_step=ProfessionalProfile.OnboardingStep.WELCOME,
            onboarding_completed=False,
            is_public=False,
            accepts_online_booking=False,
        )
        ProfessionalPaymentAccount.objects.create(
            professional=profile,
            account_email=email,
        )

        token, _ = Token.objects.get_or_create(user=user)
        return {"user": user, "token": token}

    def _build_unique_username(self, base: str):
        candidate = base[:150] or "praticien"
        suffix = 1
        while User.objects.filter(username=candidate).exists():
            suffix += 1
            candidate = f"{base[:140]}-{suffix}"
        return candidate

    def _build_unique_slug(self, base: str):
        candidate = base or "praticien"
        suffix = 1
        while (
            candidate in RESERVED_PUBLIC_SLUGS
            or ProfessionalProfile.objects.filter(slug=candidate).exists()
        ):
            suffix += 1
            candidate = f"{base[:44]}-{suffix}"
        return candidate
