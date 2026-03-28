"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import re
from urllib.parse import urlparse

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve as static_serve


def api_root(_request):
    return JsonResponse(
        {
            "service": "NUADYX API",
            "status": "ok",
            "health": "/health/",
            "admin": "/admin/",
            "api": "/api/",
        }
    )


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", api_root, name="api-root"),
    path("admin/", admin.site.urls),
    path("health/", healthcheck, name="healthcheck"),

    path("api/", include("common.urls")),
    path("api/", include("accounts.urls")),
    path("api/", include("assistant.urls")),
    path("api/", include("directory.urls")),
    path("api/", include("professionals.urls")),
    path("api/", include("services.urls")),
    path("api/", include("bookings.urls")),
    path("api/", include("reviews.urls")),
]

media_url_path = urlparse(settings.MEDIA_URL).path or settings.MEDIA_URL
if media_url_path.startswith("/") and settings.MEDIA_ROOT:
    media_pattern = rf"^{re.escape(media_url_path.lstrip('/'))}(?P<path>.*)$"
    urlpatterns += [
        re_path(
            media_pattern,
            static_serve,
            {"document_root": settings.MEDIA_ROOT},
        )
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
