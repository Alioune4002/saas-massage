from rest_framework import serializers

from .engine import get_public_assistant_starter_questions
from .models import ProfessionalAssistantProfile


class ProfessionalAssistantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfessionalAssistantProfile
        fields = (
            "id",
            "assistant_enabled",
            "welcome_message",
            "activity_overview",
            "general_guidance",
            "support_style",
            "practice_information",
            "faq_items",
            "before_session",
            "after_session",
            "service_information",
            "booking_policy",
            "contact_information",
            "business_rules",
            "guardrails",
            "avoid_topics",
            "assistant_notes",
            "internal_context",
            "response_tone",
            "public_assistant_enabled",
        )

    def validate_faq_items(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Les questions fréquentes doivent être envoyées sous forme de liste."
            )

        cleaned_items = []
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError(
                    "Chaque question fréquente doit contenir une question et une réponse."
                )

            question = str(item.get("question", "")).strip()
            answer = str(item.get("answer", "")).strip()

            if not question and not answer:
                continue

            if not question or not answer:
                raise serializers.ValidationError(
                    "Chaque question fréquente doit contenir une question et une réponse."
                )

            cleaned_items.append(
                {
                    "question": question[:180],
                    "answer": answer[:1200],
                }
            )

        return cleaned_items[:8]


class AssistantQuestionSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=500)


class PublicAssistantSerializer(serializers.ModelSerializer):
    starter_questions = serializers.SerializerMethodField()

    class Meta:
        model = ProfessionalAssistantProfile
        fields = (
            "assistant_enabled",
            "public_assistant_enabled",
            "welcome_message",
            "response_tone",
            "starter_questions",
        )

    def get_starter_questions(self, obj):
        return get_public_assistant_starter_questions(obj)
