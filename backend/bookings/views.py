import datetime as dt
import hashlib
import json
import re
import secrets
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.communications import (
    send_booking_canceled_email,
    send_booking_confirmed_email,
    send_booking_email_verification_code,
    send_booking_payment_action_required_email,
    send_booking_payment_captured_email,
    send_booking_requested_email_to_client,
    send_client_service_validation_email,
    send_new_booking_request_email,
)
from common.permissions import (
    CanManageRestrictions,
    CanModeratePlatform,
    HasProfessionalProfile,
    IsAdminUser,
    IsProfessionalUser,
)
from professionals.models import ProfessionalPaymentAccount

from .models import (
    AccountRestriction,
    AvailabilitySlot,
    Booking,
    BookingEmailVerification,
    BookingMessage,
    BookingThread,
    GuestBookingIdentity,
    IncidentDecision,
    IncidentReport,
    BookingPayment,
    PaymentWebhookEventLog,
    RiskRegisterEntry,
    TrustedClient,
)
from .payments import (
    apply_cancellation_payment_outcome,
    expire_stale_payment_holds,
    create_checkout_for_booking,
    evaluate_post_service_release,
    generate_client_action_token,
    mark_booking_as_arrived,
    mark_booking_in_progress,
    mark_booking_payment_authorized,
    mark_booking_payment_captured,
    mark_booking_no_show,
    mark_booking_service_completed,
    record_manual_payment,
    report_booking_issue,
    validate_client_service_completion,
    verify_client_action_token,
)
from .payments.stripe_connect import (
    StripeConnectError,
    create_account_link,
    create_connected_account,
    get_stripe_connect_config,
    verify_webhook_signature,
)
from .serializers import (
    BookingLifecycleSerializer,
    PaymentOverviewSerializer,
    ProfessionalAgendaSerializer,
    ProfessionalAvailabilitySerializer,
    AdminIncidentReportSerializer,
    AccountRestrictionSerializer,
    RiskRegisterEntrySerializer,
    ProfessionalBookingSerializer,
    PublicBookingEmailVerificationSerializer,
    PublicAvailabilitySerializer,
    PublicBookingIntentSerializer,
    PublicBookingCreatedSerializer,
    PublicBookingVerificationStatusSerializer,
    BookingMessageSerializer,
    IncidentDecisionAdminSerializer,
    IncidentReportSerializer,
    TrustedClientSerializer,
    ManualPaymentSerializer,
)


def _expire_stale_payment_holds():
    expire_stale_payment_holds()


def _build_guest_access_token(booking: Booking) -> str:
    return generate_client_action_token(booking=booking, purpose="guest-booking")


def _verify_guest_access_token(booking: Booking, token: str) -> bool:
    return verify_client_action_token(
        booking=booking,
        purpose="guest-booking",
        token=token,
        max_age_hours=24 * 30,
    )


def _booking_email_verification_minutes() -> int:
    return int(getattr(settings, "NUADYX_BOOKING_EMAIL_VERIFICATION_MINUTES", 15))


def _booking_email_max_resends() -> int:
    return int(getattr(settings, "NUADYX_BOOKING_EMAIL_MAX_RESENDS", 3))


def _booking_email_max_attempts() -> int:
    return int(getattr(settings, "NUADYX_BOOKING_EMAIL_MAX_ATTEMPTS", 5))


def _guest_booking_hold_minutes() -> int:
    return int(getattr(settings, "NUADYX_GUEST_BOOKING_HOLD_MINUTES", 30))


def _incident_report_window_hours() -> int:
    return int(getattr(settings, "NUADYX_INCIDENT_REPORT_WINDOW_HOURS", 48))


def _issue_booking_email_verification(
    guest_identity: GuestBookingIdentity,
    *,
    increment_resend_count: bool = True,
):
    guest_identity.email_verifications.filter(
        status=BookingEmailVerification.Status.PENDING
    ).update(status=BookingEmailVerification.Status.EXPIRED)
    code = f"{secrets.randbelow(1000000):06d}"
    verification = BookingEmailVerification.objects.create(
        guest_identity=guest_identity,
        code_hash=hashlib.sha256(code.encode()).hexdigest(),
        expires_at=timezone.now() + dt.timedelta(minutes=_booking_email_verification_minutes()),
        max_attempts=_booking_email_max_attempts(),
        sent_to_email=guest_identity.client_email,
        sent_at=timezone.now(),
    )
    guest_identity.verification_status = GuestBookingIdentity.VerificationStatus.PENDING
    guest_identity.last_verification_sent_at = timezone.now()
    if increment_resend_count:
        guest_identity.verification_resend_count += 1
    guest_identity.save(
        update_fields=[
            "verification_status",
            "last_verification_sent_at",
            "verification_resend_count",
            "updated_at",
        ]
    )
    send_booking_email_verification_code(guest_identity, verification, code=code)
    return verification


def _contains_suspicious_link(message: str) -> bool:
    return bool(re.search(r"https?://|www\.", message, flags=re.IGNORECASE))


class PublicAvailabilityListView(generics.ListAPIView):
    serializer_class = PublicAvailabilitySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        _expire_stale_payment_holds()
        queryset = (
            AvailabilitySlot.objects.select_related("professional", "service")
            .filter(
                is_active=True,
                slot_type=AvailabilitySlot.SlotType.OPEN,
                professional__is_public=True,
                professional__accepts_online_booking=True,
                start_at__gte=timezone.now(),
            )
            .exclude(bookings__status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED))
            .distinct()
            .order_by("start_at")
        )

        professional_slug = self.request.query_params.get("professional")
        service_id = self.request.query_params.get("service")
        date_value = self.request.query_params.get("date")

        if professional_slug:
            queryset = queryset.filter(professional__slug=professional_slug)

        if service_id:
            queryset = queryset.filter(service_id=service_id)

        if date_value:
            queryset = queryset.filter(start_at__date=date_value)

        return queryset


class PublicBookingCreateView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicBookingIntentSerializer

    def create(self, request, *args, **kwargs):
        _expire_stale_payment_holds()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        guest_identity = serializer.save()
        verification = _issue_booking_email_verification(
            guest_identity,
            increment_resend_count=False,
        )
        response_payload = PublicBookingVerificationStatusSerializer(guest_identity).data
        response_payload["message"] = (
            "Un code de vérification vient d’être envoyé. Votre réservation ne sera créée qu’après validation de votre email."
        )
        response_payload["expires_at"] = verification.expires_at
        return Response(response_payload, status=status.HTTP_202_ACCEPTED)


class PublicBookingVerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        _expire_stale_payment_holds()
        serializer = PublicBookingEmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        checkout_payload = None
        if booking.amount_due_now_eur > Decimal("0.00"):
            try:
                config = get_stripe_connect_config()
                if config.internal_test_mode and not config.enabled:
                    success_url = f"{settings.FRONTEND_APP_URL}/reglement/test/{booking.id}"
                else:
                    success_url = (
                        f"{settings.FRONTEND_APP_URL}/{booking.professional.slug}"
                        f"?reservation={booking.id}&payment=processing"
                    )
                cancel_url = (
                    f"{settings.FRONTEND_APP_URL}/{booking.professional.slug}"
                    "?payment=cancelled"
                )
                checkout_payload = create_checkout_for_booking(
                    booking=booking,
                    success_url=success_url,
                    cancel_url=cancel_url,
                )
            except StripeConnectError as exc:
                booking.delete()
                raise ValidationError({"payment": str(exc)}) from exc

        send_new_booking_request_email(booking)
        send_booking_requested_email_to_client(booking)
        if checkout_payload and checkout_payload.get("url"):
            send_booking_payment_action_required_email(
                booking,
                checkout_url=checkout_payload["url"],
            )

        response_payload = PublicBookingCreatedSerializer(booking).data
        response_payload["checkout_url"] = checkout_payload.get("url", "") if checkout_payload else ""
        response_payload["checkout_session_id"] = checkout_payload.get("id", "") if checkout_payload else ""
        response_payload["payment_test_mode"] = bool(
            checkout_payload and checkout_payload.get("internal_test_token")
        )
        response_payload["guest_access_token"] = _build_guest_access_token(booking)
        return Response(response_payload, status=status.HTTP_201_CREATED)


class PublicBookingResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        guest_identity_id = request.data.get("guest_identity_id")
        client_email = (request.data.get("client_email") or "").strip().lower()
        guest_identity = generics.get_object_or_404(
            GuestBookingIdentity,
            id=guest_identity_id,
        )
        if guest_identity.client_email.lower() != client_email:
            raise ValidationError("Adresse email de vérification invalide.")
        if guest_identity.verification_status == GuestBookingIdentity.VerificationStatus.COMPLETED:
            raise ValidationError("Cette réservation a déjà été vérifiée.")
        if (
            guest_identity.last_verification_sent_at
            and guest_identity.last_verification_sent_at
            > timezone.now() - dt.timedelta(seconds=45)
        ):
            raise ValidationError("Attendez quelques instants avant de demander un nouveau code.")
        if guest_identity.created_at <= timezone.now() - dt.timedelta(minutes=_guest_booking_hold_minutes()):
            guest_identity.verification_status = GuestBookingIdentity.VerificationStatus.EXPIRED
            guest_identity.save(update_fields=["verification_status", "updated_at"])
            raise ValidationError("Cette demande a expiré. Recommencez votre réservation.")
        if guest_identity.verification_resend_count >= _booking_email_max_resends():
            guest_identity.verification_status = GuestBookingIdentity.VerificationStatus.BLOCKED
            guest_identity.save(update_fields=["verification_status", "updated_at"])
            raise ValidationError("Trop de demandes de renvoi ont été détectées.")

        verification = _issue_booking_email_verification(guest_identity)
        payload = PublicBookingVerificationStatusSerializer(guest_identity).data
        payload["message"] = "Un nouveau code de vérification a été envoyé."
        payload["expires_at"] = verification.expires_at
        return Response(payload)


class PublicBookingTestPaymentConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, booking_id):
        config = get_stripe_connect_config()
        if not config.internal_test_mode:
            raise ValidationError("Ce mode interne de règlement n’est pas disponible sur cet environnement.")

        booking = generics.get_object_or_404(Booking, id=booking_id)
        payment = booking.payments.order_by("-created_at").first()
        if not payment:
            raise ValidationError("Aucun règlement à confirmer.")

        raw_payload = payment.raw_provider_payload or {}
        if not raw_payload.get("internal_test_token"):
            raise ValidationError("Ce règlement de test n'est pas disponible.")

        if request.data.get("token") != raw_payload.get("internal_test_token"):
            raise ValidationError("Lien de règlement invalide.")

        if booking.status == Booking.Status.CANCELED:
            raise ValidationError("Cette réservation a été annulée.")
        if booking.payment_status == Booking.PaymentStatus.PAYMENT_CAPTURED:
            return Response(PublicBookingCreatedSerializer(booking).data)

        booking = mark_booking_payment_authorized(
            booking,
            payment_intent_id=payment.provider_payment_intent_id or f"stub_pi_{booking.id.hex[:18]}",
        )
        booking = mark_booking_payment_captured(
            booking,
            payment_intent_id=booking.provider_payment_intent_id,
            charge_id=booking.provider_charge_id or f"stub_ch_{booking.id.hex[:18]}",
        )
        send_booking_payment_captured_email(booking)
        return Response(PublicBookingCreatedSerializer(booking).data)


class PublicBookingValidateServiceView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, booking_id):
        booking = generics.get_object_or_404(Booking, id=booking_id)
        dispute_deadline = booking.slot.end_at + dt.timedelta(hours=_incident_report_window_hours())
        if timezone.now() > dispute_deadline:
            raise ValidationError("Le délai pour confirmer ou signaler un problème sur cette prestation est dépassé.")
        if not verify_client_action_token(
            booking=booking,
            purpose="service-validation",
            token=request.data.get("token", ""),
            max_age_hours=_incident_report_window_hours(),
        ):
            raise ValidationError("Lien de validation invalide.")

        if request.data.get("action") == "report_issue":
            booking = report_booking_issue(
                booking=booking,
                reason=request.data.get("reason", "") or "Le client a signalé un problème après la séance.",
                actor_role=Booking.ActorRole.CLIENT,
            )
        else:
            booking = validate_client_service_completion(booking=booking)
        return Response(BookingLifecycleSerializer(booking).data)


class PublicBookingThreadView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, booking_id):
        booking = generics.get_object_or_404(Booking, id=booking_id)
        token = request.query_params.get("token", "")
        if not _verify_guest_access_token(booking, token):
            raise ValidationError("Lien d’accès à la réservation invalide.")
        thread, _created = BookingThread.objects.get_or_create(booking=booking)
        thread.client_last_read_at = timezone.now()
        thread.save(update_fields=["client_last_read_at", "updated_at"])
        return Response(
            {
                "booking_id": str(booking.id),
                "messages": BookingMessageSerializer(
                    thread.messages.order_by("created_at"),
                    many=True,
                ).data,
            }
        )

    def post(self, request, booking_id):
        booking = generics.get_object_or_404(Booking, id=booking_id)
        token = request.data.get("token", "")
        if not _verify_guest_access_token(booking, token):
            raise ValidationError("Lien d’accès à la réservation invalide.")
        body = (request.data.get("message") or "").strip()
        if len(body) < 2:
            raise ValidationError({"message": "Rédigez un message plus complet."})
        thread, _created = BookingThread.objects.get_or_create(booking=booking)
        message = BookingMessage.objects.create(
            thread=thread,
            sender_role=BookingMessage.SenderRole.CLIENT,
            guest_email=booking.client_email,
            body=body,
            contains_external_link=_contains_suspicious_link(body),
            is_flagged=_contains_suspicious_link(body),
        )
        thread.last_message_at = message.created_at
        thread.client_last_read_at = message.created_at
        thread.save(update_fields=["last_message_at", "client_last_read_at", "updated_at"])
        return Response(BookingMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class PublicBookingIncidentView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, booking_id):
        booking = generics.get_object_or_404(Booking, id=booking_id)
        token = request.data.get("token", "")
        if not _verify_guest_access_token(booking, token):
            raise ValidationError("Lien d’accès à la réservation invalide.")
        if timezone.now() > booking.slot.end_at + dt.timedelta(hours=_incident_report_window_hours()):
            raise ValidationError("Le délai pour signaler un problème sur cette réservation est dépassé.")

        description = (request.data.get("description") or "").strip()
        category = (request.data.get("category") or "client_issue").strip()[:60]
        if len(description) < 8:
            raise ValidationError({"description": "Décrivez un peu plus précisément la situation."})

        booking = report_booking_issue(
            booking=booking,
            reason=description,
            actor_role=Booking.ActorRole.CLIENT,
        )
        latest_incident = booking.incidents.order_by("-created_at").first()
        if latest_incident:
            latest_incident.category = category
            latest_incident.save(update_fields=["category", "updated_at"])
        return Response(
            {
                "booking": BookingLifecycleSerializer(booking).data,
                "incident": IncidentReportSerializer(latest_incident).data if latest_incident else None,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminModerationOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanModeratePlatform]

    def get(self, request):
        return Response(
            {
                "open_incidents": IncidentReport.objects.filter(
                    status=IncidentReport.Status.OPEN
                ).count(),
                "in_review_incidents": IncidentReport.objects.filter(
                    status=IncidentReport.Status.IN_REVIEW
                ).count(),
                "critical_incidents": IncidentReport.objects.filter(
                    severity=IncidentReport.Severity.CRITICAL
                ).count(),
                "active_restrictions": AccountRestriction.objects.filter(
                    status=AccountRestriction.Status.ACTIVE
                ).count(),
                "active_risk_entries": RiskRegisterEntry.objects.filter(is_active=True).count(),
            }
        )


class AdminModerationIncidentListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanModeratePlatform]
    serializer_class = AdminIncidentReportSerializer

    def get_queryset(self):
        queryset = (
            IncidentReport.objects.select_related(
                "booking",
                "booking__professional",
                "resolved_by",
            )
            .prefetch_related("decisions", "restrictions", "evidences")
            .order_by("-created_at")
        )
        for param in ("status", "severity", "category", "reported_party_type", "reporter_type"):
            value = self.request.query_params.get(param)
            if value:
                queryset = queryset.filter(**{param: value})
        q = self.request.query_params.get("q", "").strip()
        if q:
            queryset = queryset.filter(
                Q(description__icontains=q)
                | Q(category__icontains=q)
                | Q(booking__client_email__icontains=q)
                | Q(booking__professional__business_name__icontains=q)
            )
        return queryset


class AdminModerationIncidentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanModeratePlatform]

    def get_object(self, pk):
        return generics.get_object_or_404(
            IncidentReport.objects.select_related(
                "booking",
                "booking__professional",
                "resolved_by",
            ).prefetch_related("decisions", "restrictions", "evidences"),
            pk=pk,
        )

    def get(self, request, pk):
        incident = self.get_object(pk)
        return Response(AdminIncidentReportSerializer(incident).data)

    def patch(self, request, pk):
        incident = self.get_object(pk)
        allowed_fields = {"status", "severity", "admin_notes"}
        for field in allowed_fields:
            if field in request.data:
                setattr(incident, field, request.data.get(field))
        incident.save(update_fields=list(allowed_fields & set(request.data.keys())) + ["updated_at"])
        return Response(AdminIncidentReportSerializer(incident).data)


def _create_restriction_from_incident(*, incident: IncidentReport, decision_type: str, notes: str, duration_days: int | None, actor):
    booking = incident.booking
    subject_type = None
    restriction_type = None
    restriction_kwargs = {
        "incident": incident,
        "reason": incident.category[:220],
        "notes": notes,
        "created_by": actor,
    }

    if incident.reported_party_type == IncidentReport.ReportedPartyType.PRACTITIONER:
        subject_type = AccountRestriction.SubjectType.PRACTITIONER
        restriction_kwargs["professional"] = booking.professional
        restriction_kwargs["user"] = booking.professional.user
        if decision_type == "warn":
            restriction_type = AccountRestriction.RestrictionType.WARNING
            risk_level = RiskRegisterEntry.RiskLevel.LOW
            trust_status = RiskRegisterEntry.PractitionerTrustStatus.WATCH
        elif decision_type == "restrict":
            restriction_type = AccountRestriction.RestrictionType.PAYOUT_SUSPENDED
            risk_level = RiskRegisterEntry.RiskLevel.HIGH
            trust_status = RiskRegisterEntry.PractitionerTrustStatus.RESTRICTED
        elif decision_type == "suspend":
            restriction_type = AccountRestriction.RestrictionType.ACCOUNT_SUSPENDED
            risk_level = RiskRegisterEntry.RiskLevel.HIGH
            trust_status = RiskRegisterEntry.PractitionerTrustStatus.SUSPENDED
            booking.professional.accepts_online_booking = False
            booking.professional.verification_badge_status = booking.professional.VerificationBadgeStatus.SUSPENDED
            booking.professional.save(update_fields=["accepts_online_booking", "verification_badge_status", "updated_at"])
        else:
            restriction_type = AccountRestriction.RestrictionType.BANNED
            risk_level = RiskRegisterEntry.RiskLevel.BLOCKED
            trust_status = RiskRegisterEntry.PractitionerTrustStatus.SUSPENDED
            booking.professional.accepts_online_booking = False
            booking.professional.is_public = False
            booking.professional.verification_badge_status = booking.professional.VerificationBadgeStatus.SUSPENDED
            booking.professional.save(
                update_fields=[
                    "accepts_online_booking",
                    "is_public",
                    "verification_badge_status",
                    "updated_at",
                ]
            )
            if booking.professional.user_id:
                booking.professional.user.is_active = False
                booking.professional.user.save(update_fields=["is_active"])

        RiskRegisterEntry.objects.create(
            subject_type=RiskRegisterEntry.SubjectType.PRACTITIONER,
            professional=booking.professional,
            booking=booking,
            risk_level=risk_level,
            practitioner_trust_status=trust_status,
            reason=incident.category[:220],
            details=notes,
            reviewed_by=actor,
            reviewed_at=timezone.now(),
            expires_at=timezone.now() + dt.timedelta(days=duration_days) if duration_days else None,
        )
    else:
        subject_type = AccountRestriction.SubjectType.CLIENT_EMAIL
        restriction_kwargs["client_email"] = booking.client_email
        restriction_kwargs["client_phone"] = booking.client_phone
        if decision_type == "warn":
            restriction_type = AccountRestriction.RestrictionType.WARNING
            risk_level = RiskRegisterEntry.RiskLevel.LOW
            booking_status = RiskRegisterEntry.BookingRestrictionStatus.NONE
        elif decision_type == "restrict":
            restriction_type = AccountRestriction.RestrictionType.BOOKING_REVIEW
            risk_level = RiskRegisterEntry.RiskLevel.MEDIUM
            booking_status = RiskRegisterEntry.BookingRestrictionStatus.REVIEW_REQUIRED
        elif decision_type == "suspend":
            restriction_type = AccountRestriction.RestrictionType.BOOKING_BLOCKED
            risk_level = RiskRegisterEntry.RiskLevel.HIGH
            booking_status = RiskRegisterEntry.BookingRestrictionStatus.BLOCKED
        else:
            restriction_type = AccountRestriction.RestrictionType.BANNED
            risk_level = RiskRegisterEntry.RiskLevel.BLOCKED
            booking_status = RiskRegisterEntry.BookingRestrictionStatus.BLOCKED

        RiskRegisterEntry.objects.create(
            subject_type=RiskRegisterEntry.SubjectType.CLIENT_EMAIL,
            booking=booking,
            client_email=booking.client_email,
            client_phone=booking.client_phone,
            risk_level=risk_level,
            booking_restriction_status=booking_status,
            reason=incident.category[:220],
            details=notes,
            reviewed_by=actor,
            reviewed_at=timezone.now(),
            expires_at=timezone.now() + dt.timedelta(days=duration_days) if duration_days else None,
        )

    restriction = AccountRestriction.objects.create(
        subject_type=subject_type,
        restriction_type=restriction_type,
        ends_at=timezone.now() + dt.timedelta(days=duration_days) if duration_days else None,
        **restriction_kwargs,
    )
    return restriction


class AdminModerationIncidentDecisionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageRestrictions]

    def post(self, request, pk):
        incident = generics.get_object_or_404(IncidentReport, pk=pk)
        serializer = IncidentDecisionAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision_type = serializer.validated_data["decision_type"]
        notes = serializer.validated_data.get("notes", "")
        duration_days = serializer.validated_data.get("duration_days")

        decision = IncidentDecision.objects.create(
            incident=incident,
            decision_type=decision_type,
            notes=notes,
            created_by=request.user,
        )

        restriction = None
        if decision_type == "dismiss":
            incident.status = IncidentReport.Status.REJECTED
            incident.payout_frozen = False
            incident.resolution = "Classé sans suite"
        else:
            incident.status = IncidentReport.Status.RESOLVED
            incident.resolution = decision.get_decision_type_display() if hasattr(decision, "get_decision_type_display") else decision_type
            restriction = _create_restriction_from_incident(
                incident=incident,
                decision_type=decision_type,
                notes=notes,
                duration_days=duration_days,
                actor=request.user,
            )
        incident.admin_notes = notes
        incident.resolved_by = request.user
        incident.resolved_at = timezone.now()
        incident.save(
            update_fields=[
                "status",
                "payout_frozen",
                "resolution",
                "admin_notes",
                "resolved_by",
                "resolved_at",
                "updated_at",
            ]
        )

        return Response(
            {
                "incident": AdminIncidentReportSerializer(incident).data,
                "decision_id": str(decision.id),
                "restriction": AccountRestrictionSerializer(restriction).data if restriction else None,
            }
        )


class AdminModerationRestrictionsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanModeratePlatform]
    serializer_class = AccountRestrictionSerializer

    def get_queryset(self):
        queryset = AccountRestriction.objects.select_related(
            "professional",
            "user",
            "created_by",
            "revoked_by",
            "incident",
        ).order_by("-created_at")
        for param in ("status", "restriction_type", "subject_type"):
            value = self.request.query_params.get(param)
            if value:
                queryset = queryset.filter(**{param: value})
        return queryset


class AdminModerationRiskEntriesView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanModeratePlatform]
    serializer_class = RiskRegisterEntrySerializer

    def get_queryset(self):
        queryset = RiskRegisterEntry.objects.select_related(
            "professional",
            "booking",
            "reviewed_by",
        ).order_by("-created_at")
        is_active = self.request.query_params.get("is_active")
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        risk_level = self.request.query_params.get("risk_level")
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)
        return queryset


class ProfessionalAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = ProfessionalAvailabilitySerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsProfessionalUser,
        HasProfessionalProfile,
    ]

    def get_queryset(self):
        queryset = (
            AvailabilitySlot.objects.filter(
                professional=self.request.user.professional_profile
            )
            .select_related("service")
            .order_by("start_at")
        )

        service_id = self.request.query_params.get("service")
        date_value = self.request.query_params.get("date")
        slot_type = self.request.query_params.get("slot_type")
        is_active = self.request.query_params.get("is_active")

        if service_id:
            queryset = queryset.filter(service_id=service_id)

        if date_value:
            queryset = queryset.filter(start_at__date=date_value)

        if slot_type:
            queryset = queryset.filter(slot_type=slot_type)

        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=(is_active == "true"))

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["professional"] = self.request.user.professional_profile
        return context

    def perform_destroy(self, instance):
        if instance.bookings.filter(
            status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED)
        ).exists():
            raise ValidationError(
                "Ce créneau comporte déjà un rendez-vous et ne peut pas être supprimé."
            )
        instance.delete()


class ProfessionalTrustedClientViewSet(viewsets.ModelViewSet):
    serializer_class = TrustedClientSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsProfessionalUser,
        HasProfessionalProfile,
    ]

    def get_queryset(self):
        return TrustedClient.objects.filter(
            professional=self.request.user.professional_profile
        ).order_by("first_name", "last_name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["professional"] = self.request.user.professional_profile
        return context


class ProfessionalBookingViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProfessionalBookingSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsProfessionalUser,
        HasProfessionalProfile,
    ]

    def get_queryset(self):
        _expire_stale_payment_holds()
        queryset = (
            Booking.objects.filter(
                professional=self.request.user.professional_profile
            )
            .select_related("service", "slot")
            .prefetch_related("event_logs")
            .order_by("slot__start_at", "-created_at")
        )

        status_value = self.request.query_params.get("status")
        date_value = self.request.query_params.get("date")
        upcoming = self.request.query_params.get("upcoming")

        if status_value:
            queryset = queryset.filter(status=status_value)

        if date_value:
            queryset = queryset.filter(slot__start_at__date=date_value)

        if upcoming == "true":
            queryset = queryset.filter(slot__start_at__gte=timezone.now())

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = list(self.filter_queryset(self.get_queryset()))
        evaluated = [evaluate_post_service_release(booking) for booking in queryset]
        serializer = self.get_serializer(evaluated, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        booking = evaluate_post_service_release(self.get_object())
        serializer = self.get_serializer(booking)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        booking = self.get_object()
        if booking.status == Booking.Status.CANCELED:
            raise ValidationError("Une réservation annulée ne peut pas être confirmée.")
        if booking.status == Booking.Status.CONFIRMED:
            return Response(self.get_serializer(booking).data)
        if (
            booking.amount_due_now_eur > Decimal("0.00")
            and booking.payment_collection_method == Booking.PaymentCollectionMethod.PLATFORM
            and booking.payment_status != Booking.PaymentStatus.PAYMENT_CAPTURED
        ):
            raise ValidationError(
                "Le règlement demandé doit être sécurisé avant de confirmer ce rendez-vous."
            )
        booking.status = Booking.Status.CONFIRMED
        booking.save(update_fields=["status", "updated_at"])
        send_booking_confirmed_email(booking)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        if booking.status == Booking.Status.CANCELED:
            return Response(self.get_serializer(booking).data)
        booking.status = Booking.Status.CANCELED
        booking = apply_cancellation_payment_outcome(
            booking=booking,
            initiated_by=Booking.ActorRole.PRACTITIONER,
            reason=request.data.get("reason", ""),
            actor_user=request.user,
        )
        booking.save(
            update_fields=[
                "status",
                "payment_status",
                "amount_received_eur",
                "amount_remaining_eur",
                "amount_refunded_eur",
                "payout_status",
                "payout_blocked_reason",
                "canceled_by_role",
                "cancellation_reason",
                "refund_decision_source",
                "provider_refund_id",
                "issue_opened_at",
                "issue_opened_by_role",
                "issue_reason",
                "updated_at",
            ]
        )
        send_booking_canceled_email(booking)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="client-arrived")
    def client_arrived(self, request, pk=None):
        booking = mark_booking_as_arrived(booking=self.get_object(), actor_user=request.user)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="start-service")
    def start_service(self, request, pk=None):
        booking = mark_booking_in_progress(booking=self.get_object(), actor_user=request.user)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="complete-service")
    def complete_service(self, request, pk=None):
        booking = mark_booking_service_completed(
            booking=self.get_object(),
            actor_user=request.user,
        )
        validation_url = (
            f"{settings.FRONTEND_APP_URL}/validation-prestation/{booking.id}"
            f"?token={generate_client_action_token(booking=booking, purpose='service-validation')}"
        )
        send_client_service_validation_email(booking, validation_url)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="record-manual-payment")
    def record_manual_payment(self, request, pk=None):
        serializer = ManualPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = record_manual_payment(
            booking=self.get_object(),
            channel=serializer.validated_data["payment_channel"],
            actor_user=request.user,
        )
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="report-issue")
    def report_issue(self, request, pk=None):
        booking = report_booking_issue(
            booking=self.get_object(),
            reason=request.data.get("reason", "") or "Le praticien a demandé une vérification sur cette réservation.",
            actor_role=Booking.ActorRole.PRACTITIONER,
            actor_user=request.user,
        )
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="client-no-show")
    def client_no_show(self, request, pk=None):
        booking = mark_booking_no_show(
            booking=self.get_object(),
            absent_role=Booking.ActorRole.CLIENT,
            actor_user=request.user,
            reason=request.data.get("reason", ""),
        )
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="practitioner-no-show")
    def practitioner_no_show(self, request, pk=None):
        booking = mark_booking_no_show(
            booking=self.get_object(),
            absent_role=Booking.ActorRole.PRACTITIONER,
            actor_user=request.user,
            reason=request.data.get("reason", ""),
        )
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        booking = self.get_object()
        thread, _created = BookingThread.objects.get_or_create(booking=booking)

        if request.method.lower() == "get":
            thread.practitioner_last_read_at = timezone.now()
            thread.save(update_fields=["practitioner_last_read_at", "updated_at"])
            serializer = BookingMessageSerializer(
                thread.messages.order_by("created_at"),
                many=True,
            )
            return Response(serializer.data)

        body = (request.data.get("message") or "").strip()
        if len(body) < 2:
            raise ValidationError({"message": "Le message est trop court."})

        message = BookingMessage.objects.create(
            thread=thread,
            sender_role=BookingMessage.SenderRole.PRACTITIONER,
            sender_user=request.user,
            body=body,
            contains_external_link=_contains_suspicious_link(body),
            is_flagged=_contains_suspicious_link(body),
        )
        thread.last_message_at = message.created_at
        thread.practitioner_last_read_at = message.created_at
        thread.save(update_fields=["last_message_at", "practitioner_last_read_at", "updated_at"])
        return Response(BookingMessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="incidents")
    def incidents(self, request, pk=None):
        booking = self.get_object()
        serializer = IncidentReportSerializer(
            booking.incidents.order_by("-created_at"),
            many=True,
        )
        return Response(serializer.data)


class ProfessionalAgendaView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
        IsProfessionalUser,
        HasProfessionalProfile,
    ]

    def get(self, request):
        professional = request.user.professional_profile
        target_date = self._get_target_date()
        timezone_info = timezone.get_current_timezone()
        day_start = timezone.make_aware(
            dt.datetime.combine(target_date, dt.time.min),
            timezone_info,
        )
        day_end = timezone.make_aware(
            dt.datetime.combine(target_date, dt.time.max),
            timezone_info,
        )

        slots = list(
            AvailabilitySlot.objects.filter(
                professional=professional,
                is_active=True,
                start_at__gte=day_start,
                start_at__lte=day_end,
            )
            .select_related("service")
            .order_by("start_at")
        )

        active_bookings = list(
            Booking.objects.filter(
                professional=professional,
                slot__start_at__gte=day_start,
                slot__start_at__lte=day_end,
                status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED),
            )
            .select_related("service", "slot")
            .order_by("slot__start_at")
        )

        active_booking_by_slot = {
            booking.slot_id: booking for booking in active_bookings
        }
        for slot in slots:
            slot._prefetched_active_booking = active_booking_by_slot.get(slot.id)

        free_slots = 0
        blocked_slots = 0
        pending_bookings = 0
        confirmed_bookings = 0

        for slot in slots:
            if slot.slot_type == AvailabilitySlot.SlotType.BLOCKED:
                blocked_slots += 1
                continue

            booking = active_booking_by_slot.get(slot.id)
            if not booking:
                free_slots += 1
            elif booking.status == Booking.Status.PENDING:
                pending_bookings += 1
            elif booking.status == Booking.Status.CONFIRMED:
                confirmed_bookings += 1

        upcoming_bookings = Booking.objects.filter(
            professional=professional,
            slot__start_at__gte=timezone.now(),
            status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED),
        ).select_related("service", "slot").order_by("slot__start_at")[:6]

        recent_cancellations = Booking.objects.filter(
            professional=professional,
            status=Booking.Status.CANCELED,
        ).select_related("service", "slot").order_by("-updated_at")[:4]

        payload = {
            "date": target_date,
            "overview": {
                "free_slots": free_slots,
                "blocked_slots": blocked_slots,
                "pending_bookings": pending_bookings,
                "confirmed_bookings": confirmed_bookings,
                "total_slots": len(slots),
            },
            "timeline": slots,
            "upcoming_bookings": list(upcoming_bookings),
            "recent_cancellations": list(recent_cancellations),
        }

        serializer = ProfessionalAgendaSerializer(payload)
        return Response(serializer.data)

    def _get_target_date(self):
        raw_value = self.request.query_params.get("date")
        if not raw_value:
            return timezone.localdate()

        try:
            return dt.date.fromisoformat(raw_value)
        except ValueError as exc:
            raise ValidationError({"date": "Format de date invalide."}) from exc


class ProfessionalPaymentOverviewView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
        IsProfessionalUser,
        HasProfessionalProfile,
    ]

    def get(self, request):
        professional = request.user.professional_profile
        bookings = Booking.objects.filter(professional=professional)
        recent_movements = BookingPayment.objects.filter(
            booking__professional=professional
        ).order_by("-created_at")[:10]

        collected_platform = bookings.filter(
            payment_channel=Booking.PaymentChannel.PLATFORM,
            payment_status=Booking.PaymentStatus.PAYMENT_CAPTURED,
        ).aggregate(total=Sum("amount_received_eur"))["total"] or Decimal("0.00")
        collected_off_platform = bookings.filter(
            payment_channel__in=(
                Booking.PaymentChannel.CASH,
                Booking.PaymentChannel.BANK_TRANSFER,
                Booking.PaymentChannel.CARD_READER,
                Booking.PaymentChannel.OTHER,
            )
        ).aggregate(total=Sum("amount_received_eur"))["total"] or Decimal("0.00")
        deposits = bookings.filter(
            payment_mode="deposit",
            payment_status=Booking.PaymentStatus.PAYMENT_CAPTURED,
        ).aggregate(total=Sum("amount_received_eur"))["total"] or Decimal("0.00")
        remaining = bookings.aggregate(total=Sum("amount_remaining_eur"))["total"] or Decimal("0.00")
        refunds = bookings.aggregate(total=Sum("amount_refunded_eur"))["total"] or Decimal("0.00")
        payouts_pending = bookings.filter(
            payout_status__in=(
                Booking.PayoutStatus.PAYOUT_PENDING,
                Booking.PayoutStatus.PAYOUT_READY,
            )
        ).aggregate(total=Sum("payout_amount_eur"))["total"] or Decimal("0.00")
        payouts_released = bookings.filter(
            payout_status=Booking.PayoutStatus.PAYOUT_RELEASED,
        ).aggregate(total=Sum("payout_amount_eur"))["total"] or Decimal("0.00")

        by_channel = [
            {
                "channel": channel,
                "label": label,
                "amount_eur": bookings.filter(payment_channel=channel).aggregate(
                    total=Sum("amount_received_eur")
                )["total"] or Decimal("0.00"),
            }
            for channel, label in Booking.PaymentChannel.choices
            if channel != Booking.PaymentChannel.NONE
        ]

        serializer = PaymentOverviewSerializer(
            {
                "collected_platform_eur": collected_platform,
                "collected_off_platform_eur": collected_off_platform,
                "deposits_captured_eur": deposits,
                "remaining_to_collect_eur": remaining,
                "refunded_eur": refunds,
                "payouts_pending_eur": payouts_pending,
                "payouts_released_eur": payouts_released,
                "by_channel": by_channel,
                "recent_movements": recent_movements,
            }
        )
        return Response(serializer.data)


class ProfessionalPaymentConnectView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
        IsProfessionalUser,
        HasProfessionalProfile,
    ]

    def post(self, request):
        professional = request.user.professional_profile
        payment_account, _created = ProfessionalPaymentAccount.objects.get_or_create(
            professional=professional
        )
        config = get_stripe_connect_config()

        if config.enabled:
            try:
                if not payment_account.stripe_account_id:
                    stripe_account = create_connected_account(
                        email=professional.user.email,
                        business_name=professional.business_name,
                        country=payment_account.country,
                        idempotency_key=f"stripe-account-{professional.id}",
                    )
                    payment_account.stripe_account_id = stripe_account.get("id", "")
                    payment_account.account_email = professional.user.email
                    payment_account.onboarding_status = ProfessionalPaymentAccount.OnboardingStatus.PENDING
                    payment_account.save()

                account_link = create_account_link(
                    account_id=payment_account.stripe_account_id,
                    refresh_url=f"{settings.FRONTEND_APP_URL}/payments?refresh=1",
                    return_url=f"{settings.FRONTEND_APP_URL}/payments?connected=1",
                    idempotency_key=f"stripe-account-link-{professional.id}",
                )
            except StripeConnectError as exc:
                raise ValidationError(
                    {
                        "payment_account": (
                            "La connexion Stripe n’a pas pu être préparée pour le moment. "
                            "Vérifiez la configuration du compte ou réessayez dans quelques instants."
                        )
                    }
                ) from exc

            return Response({"url": account_link.get("url", ""), "mode": "stripe_connect"})

        if config.internal_test_mode:
            payment_account.stripe_account_id = payment_account.stripe_account_id or f"acct_test_{professional.id.hex[:16]}"
            payment_account.account_email = professional.user.email
            payment_account.onboarding_status = ProfessionalPaymentAccount.OnboardingStatus.ACTIVE
            payment_account.details_submitted = True
            payment_account.charges_enabled = True
            payment_account.payouts_enabled = True
            payment_account.save()
            return Response(
                {
                    "url": f"{settings.FRONTEND_APP_URL}/payments?mode=test-stripe",
                    "mode": "internal_test",
                }
            )

        raise ValidationError("Le compte de paiement n'est pas encore configuré.")


class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        config = get_stripe_connect_config()
        if not config.enabled or not config.webhook_secret:
            return Response(
                {"detail": "Webhook Stripe non configuré sur cet environnement."},
                status=503,
            )

        payload = request.body
        signature = request.headers.get("Stripe-Signature", "")
        signature_valid = verify_webhook_signature(payload, signature)
        try:
            event = json.loads(payload.decode() or "{}")
        except json.JSONDecodeError:
            return Response({"detail": "Payload Stripe invalide."}, status=400)

        event_id = event.get("id", f"evt_missing_{timezone.now().timestamp()}")
        event_type = event.get("type", "")

        with transaction.atomic():
            webhook_log, _created = PaymentWebhookEventLog.objects.select_for_update().get_or_create(
                provider=BookingPayment.Provider.STRIPE_CONNECT,
                provider_event_id=event_id,
                defaults={
                    "event_type": event_type,
                    "payload": event,
                    "signature_valid": signature_valid,
                },
            )

            if webhook_log.processing_status == PaymentWebhookEventLog.ProcessingStatus.PROCESSED:
                return Response({"status": "already_processed"})

            if not signature_valid:
                webhook_log.processing_status = PaymentWebhookEventLog.ProcessingStatus.FAILED
                webhook_log.error_message = "Signature Stripe invalide."
                webhook_log.save(update_fields=["processing_status", "error_message", "updated_at"])
                return Response({"detail": "Signature invalide."}, status=400)

            data_object = event.get("data", {}).get("object", {}) or {}
            metadata = data_object.get("metadata", {}) or {}
            booking = None
            booking_id = metadata.get("booking_id")
            if booking_id:
                booking = Booking.objects.select_for_update().filter(id=booking_id).first()

            if not booking and data_object.get("id"):
                booking = Booking.objects.select_for_update().filter(
                    provider_checkout_session_id=data_object.get("id")
                ).first() or Booking.objects.select_for_update().filter(
                    provider_payment_intent_id=data_object.get("payment_intent") or data_object.get("id")
                ).first()

            try:
                if booking:
                    if event_type == "checkout.session.completed":
                        mark_booking_payment_authorized(
                            booking,
                            payment_intent_id=data_object.get("payment_intent", ""),
                            payload=data_object,
                        )
                        if data_object.get("payment_status") == "paid":
                            mark_booking_payment_captured(
                                booking,
                                payment_intent_id=data_object.get("payment_intent", ""),
                                charge_id=data_object.get("payment_intent", ""),
                                payload=data_object,
                            )
                    elif event_type in {"payment_intent.succeeded", "charge.succeeded"}:
                        mark_booking_payment_captured(
                            booking,
                            payment_intent_id=data_object.get("payment_intent", "") or data_object.get("id", ""),
                            charge_id=data_object.get("latest_charge", "") or data_object.get("id", ""),
                            payload=data_object,
                        )
                    elif event_type == "payment_intent.payment_failed":
                        booking.payment_status = Booking.PaymentStatus.PAYMENT_REQUIRED
                        booking.provider_payment_intent_id = data_object.get("id", "") or booking.provider_payment_intent_id
                        booking.save(
                            update_fields=[
                                "payment_status",
                                "provider_payment_intent_id",
                                "updated_at",
                            ]
                        )
                        latest_payment = booking.payments.order_by("-created_at").first()
                        if latest_payment:
                            latest_payment.status = BookingPayment.Status.FAILED
                            latest_payment.raw_provider_payload = data_object
                            latest_payment.save(
                                update_fields=["status", "raw_provider_payload", "updated_at"]
                            )
                    elif event_type in {"charge.refunded", "refund.updated"} and booking.amount_received_eur > Decimal("0.00"):
                        refund_amount_cents = data_object.get("amount_refunded")
                        refund_amount = (
                            Decimal(str(refund_amount_cents)) / Decimal("100")
                            if refund_amount_cents is not None
                            else booking.amount_received_eur
                        )
                        booking.amount_refunded_eur = refund_amount
                        booking.amount_received_eur = max(Decimal("0.00"), booking.amount_due_now_eur - refund_amount)
                        booking.payment_status = (
                            Booking.PaymentStatus.REFUNDED
                            if booking.amount_received_eur <= Decimal("0.00")
                            else Booking.PaymentStatus.PARTIALLY_REFUNDED
                        )
                        booking.provider_refund_id = data_object.get("id", "") or booking.provider_refund_id
                        booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
                        booking.payout_blocked_reason = "Remboursement confirmé ou en cours de finalisation."
                        booking.save(
                            update_fields=[
                                "amount_refunded_eur",
                                "amount_received_eur",
                                "payment_status",
                                "provider_refund_id",
                                "payout_status",
                                "payout_blocked_reason",
                                "updated_at",
                            ]
                        )
                        if not booking.payments.filter(
                            kind=BookingPayment.Kind.REFUND,
                            provider_refund_id=booking.provider_refund_id,
                        ).exists():
                            BookingPayment.objects.create(
                                booking=booking,
                                kind=BookingPayment.Kind.REFUND,
                                status=BookingPayment.Status.REFUNDED,
                                provider=BookingPayment.Provider.STRIPE_CONNECT,
                                amount_eur=refund_amount,
                                currency="eur",
                                provider_refund_id=booking.provider_refund_id,
                                recorded_by_role=Booking.ActorRole.SYSTEM,
                                raw_provider_payload=data_object,
                            )
                    elif event_type == "transfer.failed":
                        booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
                        booking.payout_blocked_reason = "Le versement Stripe a échoué et nécessite une reprise manuelle."
                        booking.save(
                            update_fields=[
                                "payout_status",
                                "payout_blocked_reason",
                                "updated_at",
                            ]
                        )
                    elif event_type == "transfer.created" and not booking.provider_transfer_id:
                        booking.provider_transfer_id = data_object.get("id", "")
                        booking.provider_payout_id = data_object.get("destination_payment", "") or booking.provider_payout_id
                        booking.payout_status = Booking.PayoutStatus.PAYOUT_RELEASED
                        booking.payout_released_at = timezone.now()
                        booking.save(
                            update_fields=[
                                "provider_transfer_id",
                                "provider_payout_id",
                                "payout_status",
                                "payout_released_at",
                                "updated_at",
                            ]
                        )
                        if not booking.payments.filter(
                            kind=BookingPayment.Kind.PAYOUT,
                            provider_transfer_id=booking.provider_transfer_id,
                        ).exists():
                            BookingPayment.objects.create(
                                booking=booking,
                                kind=BookingPayment.Kind.PAYOUT,
                                status=BookingPayment.Status.RELEASED,
                                provider=BookingPayment.Provider.STRIPE_CONNECT,
                                amount_eur=booking.payout_amount_eur,
                                currency="eur",
                                provider_transfer_id=booking.provider_transfer_id,
                                provider_payout_id=booking.provider_payout_id,
                                recorded_by_role=Booking.ActorRole.SYSTEM,
                                raw_provider_payload=data_object,
                            )

                    webhook_log.booking = booking

                if event_type == "account.updated":
                    account_id = data_object.get("id", "")
                    payment_account = ProfessionalPaymentAccount.objects.filter(
                        stripe_account_id=account_id
                    ).first()
                    if payment_account:
                        payment_account.details_submitted = bool(data_object.get("details_submitted"))
                        payment_account.charges_enabled = bool(data_object.get("charges_enabled"))
                        payment_account.payouts_enabled = bool(data_object.get("payouts_enabled"))
                        payment_account.onboarding_status = (
                            ProfessionalPaymentAccount.OnboardingStatus.ACTIVE
                            if payment_account.charges_enabled and payment_account.payouts_enabled
                            else ProfessionalPaymentAccount.OnboardingStatus.PENDING
                        )
                        payment_account.save()

                webhook_log.processing_status = PaymentWebhookEventLog.ProcessingStatus.PROCESSED
                webhook_log.processed_at = timezone.now()
                webhook_log.payload = event
                webhook_log.signature_valid = True
                webhook_log.event_type = event_type
                webhook_log.save(
                    update_fields=[
                        "booking",
                        "processing_status",
                        "processed_at",
                        "payload",
                        "signature_valid",
                        "event_type",
                        "updated_at",
                    ]
                )
            except Exception as exc:
                webhook_log.processing_status = PaymentWebhookEventLog.ProcessingStatus.FAILED
                webhook_log.error_message = str(exc)
                webhook_log.payload = event
                webhook_log.signature_valid = True
                webhook_log.event_type = event_type
                webhook_log.save(
                    update_fields=[
                        "processing_status",
                        "error_message",
                        "payload",
                        "signature_valid",
                        "event_type",
                        "updated_at",
                    ]
                )
                raise

        return Response({"status": "processed"})
