import hashlib

from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate
from common.communications import send_practitioner_welcome_email
from .serializers import (
    LoginSerializer,
    RegisterPractitionerSerializer,
    UserMeSerializer,
)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "token": token.key,
                "user": UserMeSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)
    
    
class CustomAuthToken(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(username=email, password=password)

        if not user:
            return Response(
                {"detail": "Identifiants invalides"},
                status=status.HTTP_400_BAD_REQUEST
            )

        token, _ = Token.objects.get_or_create(user=user)

        return Response({"token": token.key})


class RegisterPractitionerView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        client_ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "")
        )
        user_agent = request.META.get("HTTP_USER_AGENT", "")
        serializer = RegisterPractitionerSerializer(
            data=request.data,
            context={
                "ip_hash": hashlib.sha256(client_ip.encode()).hexdigest() if client_ip else "",
                "user_agent_hash": hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else "",
            },
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        send_practitioner_welcome_email(result["user"].professional_profile)

        return Response(
            {
                "token": result["token"].key,
                "user": UserMeSerializer(result["user"]).data,
            },
            status=status.HTTP_201_CREATED,
        )
