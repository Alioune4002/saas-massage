from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.conf import settings


class StripeConnectError(Exception):
    pass


@dataclass
class StripeConnectConfig:
    secret_key: str
    publishable_key: str
    webhook_secret: str
    client_label: str
    enabled: bool
    internal_test_mode: bool


def get_stripe_connect_config() -> StripeConnectConfig:
    secret_key = getattr(settings, "NUADYX_STRIPE_SECRET_KEY", "")
    publishable_key = getattr(settings, "NUADYX_STRIPE_PUBLISHABLE_KEY", "")
    webhook_secret = getattr(settings, "NUADYX_STRIPE_WEBHOOK_SECRET", "")
    enabled = bool(secret_key and publishable_key and webhook_secret)
    return StripeConnectConfig(
        secret_key=secret_key,
        publishable_key=publishable_key,
        webhook_secret=webhook_secret,
        client_label="NUADYX",
        enabled=enabled,
        internal_test_mode=bool(getattr(settings, "NUADYX_STRIPE_INTERNAL_TEST_MODE", settings.DEBUG)),
    )


def _flatten_form(prefix: str, value: Any, items: list[tuple[str, str]]):
    if isinstance(value, dict):
        for key, nested_value in value.items():
            next_prefix = f"{prefix}[{key}]" if prefix else str(key)
            _flatten_form(next_prefix, nested_value, items)
        return

    if isinstance(value, list):
        for index, nested_value in enumerate(value):
            next_prefix = f"{prefix}[{index}]"
            _flatten_form(next_prefix, nested_value, items)
        return

    if value is None:
        return

    items.append((prefix, str(value)))


def _stripe_request(method: str, path: str, data: dict[str, Any] | None = None, *, idempotency_key: str | None = None) -> dict[str, Any]:
    config = get_stripe_connect_config()
    if not config.enabled:
        raise StripeConnectError("Stripe Connect n'est pas configuré.")

    form_items: list[tuple[str, str]] = []
    for key, value in (data or {}).items():
        _flatten_form(key, value, form_items)

    encoded = urllib.parse.urlencode(form_items).encode()
    request = urllib.request.Request(
        f"https://api.stripe.com{path}",
        data=encoded,
        method=method,
    )
    request.add_header("Authorization", f"Bearer {config.secret_key}")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    if idempotency_key:
        request.add_header("Idempotency-Key", idempotency_key)

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = response.read().decode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        raise StripeConnectError(body or str(exc)) from exc
    except urllib.error.URLError as exc:
        raise StripeConnectError(str(exc)) from exc

    return json.loads(payload)


def create_connected_account(*, email: str, business_name: str, country: str, idempotency_key: str) -> dict[str, Any]:
    return _stripe_request(
        "POST",
        "/v1/accounts",
        {
            "type": "express",
            "country": country or "FR",
            "email": email,
            "business_profile": {"name": business_name},
            "capabilities": {
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            "metadata": {"platform": "nuadyx"},
        },
        idempotency_key=idempotency_key,
    )


def create_account_link(*, account_id: str, refresh_url: str, return_url: str, idempotency_key: str) -> dict[str, Any]:
    return _stripe_request(
        "POST",
        "/v1/account_links",
        {
            "account": account_id,
            "refresh_url": refresh_url,
            "return_url": return_url,
            "type": "account_onboarding",
        },
        idempotency_key=idempotency_key,
    )


def create_checkout_session(*, booking, success_url: str, cancel_url: str, idempotency_key: str) -> dict[str, Any]:
    return _stripe_request(
        "POST",
        "/v1/checkout/sessions",
        {
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "customer_email": booking.client_email,
            "payment_method_types": ["card"],
            "metadata": {
                "booking_id": str(booking.id),
                "professional_id": str(booking.professional_id),
            },
            "line_items": [
                {
                    "price_data": {
                        "currency": "eur",
                        "product_data": {
                            "name": booking.service.title,
                            "description": booking.payment_message or "Règlement NUADYX",
                        },
                        "unit_amount": int(Decimal(booking.amount_due_now_eur) * 100),
                    },
                    "quantity": 1,
                }
            ],
            "payment_intent_data": {
                "metadata": {"booking_id": str(booking.id)},
            },
        },
        idempotency_key=idempotency_key,
    )


def create_refund(*, charge_id: str, amount_eur: Decimal, idempotency_key: str) -> dict[str, Any]:
    return _stripe_request(
        "POST",
        "/v1/refunds",
        {
            "charge": charge_id,
            "amount": int(Decimal(amount_eur) * 100),
        },
        idempotency_key=idempotency_key,
    )


def create_transfer(*, stripe_account_id: str, amount_eur: Decimal, booking_id: str, idempotency_key: str) -> dict[str, Any]:
    return _stripe_request(
        "POST",
        "/v1/transfers",
        {
            "amount": int(Decimal(amount_eur) * 100),
            "currency": "eur",
            "destination": stripe_account_id,
            "metadata": {"booking_id": booking_id},
        },
        idempotency_key=idempotency_key,
    )


def verify_webhook_signature(payload: bytes, signature_header: str) -> bool:
    config = get_stripe_connect_config()
    if not config.webhook_secret or not signature_header:
        return False

    timestamp = ""
    signatures: list[str] = []
    for item in signature_header.split(","):
        if item.startswith("t="):
            timestamp = item[2:]
        elif item.startswith("v1="):
            signatures.append(item[3:])

    if not timestamp or not signatures:
        return False

    signed_payload = f"{timestamp}.{payload.decode()}".encode()
    expected = hmac.new(
        config.webhook_secret.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    return any(hmac.compare_digest(expected, signature) for signature in signatures)


def create_internal_test_checkout_stub(*, booking, success_url: str) -> dict[str, Any]:
    token_seed = f"{booking.id}:{booking.client_email}:{time.time()}".encode()
    token = base64.urlsafe_b64encode(hashlib.sha256(token_seed).digest())[:32].decode()
    return {
        "id": f"stub_cs_{booking.id.hex[:18]}",
        "payment_intent": f"stub_pi_{booking.id.hex[:18]}",
        "url": f"{success_url}?mode=test-stripe&booking={booking.id}&token={token}",
        "internal_test_token": token,
    }
