from django.urls import path

from .views import CustomAuthToken, LoginView, MeView, RegisterPractitionerView

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="api-login"),
    path("auth/me/", MeView.as_view(), name="api-me"),
    path("auth/token/", CustomAuthToken.as_view(), name="api-token"),
    path("auth/register/", RegisterPractitionerView.as_view(), name="api-register"),
]
