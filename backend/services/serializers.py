from rest_framework import serializers

from .models import MassageService


class PublicMassageServiceSerializer(serializers.ModelSerializer):
    professional_slug = serializers.CharField(source="professional.slug", read_only=True)
    professional_name = serializers.CharField(source="professional.business_name", read_only=True)

    class Meta:
        model = MassageService
        fields = (
            "id",
            "professional_slug",
            "professional_name",
            "title",
            "short_description",
            "full_description",
            "duration_minutes",
            "price_eur",
        )


class ProfessionalMassageServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MassageService
        fields = (
            "id",
            "title",
            "short_description",
            "full_description",
            "duration_minutes",
            "price_eur",
            "is_active",
            "sort_order",
        )

    def create(self, validated_data):
        validated_data["professional"] = self.context["professional"]
        return super().create(validated_data)