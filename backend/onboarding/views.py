# apps/onboarding/views.py

import base64
import random

import requests as http_client
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    parser_classes,
)
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response

from .constants import STEP_ORDER
from .permissions import IsOnboardingOwner
from .selectors import serialize_session
from .services import apply_step, get_or_create_session, reset_session


# ============================================================
# HELPERS
# ============================================================

_STEP_ALIASES = {
    "1": "step1", "2": "step2", "3": "step3", "4": "step4",
    "5": "step5", "6": "step6", "7": "step7", "8": "step8",
    "9": "step9", "10": "step10", "11": "step11", "12": "step12",
}


def _resolve_step(raw: str) -> str:
    """Accept both '5' and 'step5' and return the canonical step key."""
    return _STEP_ALIASES.get(raw, raw)


def _field_errors(exc: ValidationError) -> dict:
    """Normalise a ValidationError into {field: [msg, ...]}."""
    if hasattr(exc, "message_dict"):
        return exc.message_dict
    return {"_error": exc.messages}


# ============================================================
# SESSION
# ============================================================

@api_view(["GET"])
@permission_classes([IsOnboardingOwner])
def current_session(request):
    session = get_or_create_session(request.user)
    return Response(serialize_session(session))


@api_view(["POST"])
@permission_classes([IsOnboardingOwner])
def reset(request):
    session = get_or_create_session(request.user)
    reset_session(session)
    session.refresh_from_db()
    return Response(serialize_session(session))


# ============================================================
# STEPS — list
# ============================================================

@api_view(["GET"])
@permission_classes([IsOnboardingOwner])
def list_steps(request):
    from .constants import STEP_META, TOTAL_STEPS
    return Response({
        "total_steps": TOTAL_STEPS,
        "steps": {
            meta["key"]: {
                "key": meta["key"],
                "title": meta["title"],
                "description": meta["description"],
                "optional": meta["optional"],
            }
            for meta in STEP_META.values()
        },
    })


# ============================================================
# STEP — detail (GET) + submit (POST), one handler
# ============================================================

@api_view(["GET", "POST"])
@permission_classes([IsOnboardingOwner])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def step_view(request, step_key: str):
    """
    Single handler for /api/onboarding/steps/<key>/.

    GET  → returns the step's prefill/summary (step 12 returns a flat shape).
    POST → validates + persists the step and returns the updated session.
    """
    from .steps.base import StepRegistry
    from . import steps  # noqa: F401 — populate the registry

    step_key = _resolve_step(step_key)

    if step_key not in STEP_ORDER:
        return Response(
            {"detail": f"Unknown step '{step_key}'."},
            status=status.HTTP_404_NOT_FOUND,
        )

    session = get_or_create_session(request.user)

    # ── GET — prefill ──────────────────────────────────────
    if request.method == "GET":
        try:
            step = StepRegistry.get(step_key)
        except KeyError:
            return Response(
                {"detail": f"Step '{step_key}' has no handler yet."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        summary = step.summary(session)

        # Step 12 flattens its response for the frontend
        if step_key == "step12":
            return Response(summary.get("data", {}))

        return Response(summary)

    # ── POST — submit ───────────────────────────────────────
    payload = request.data

    # Unwrap optional { "data": {...} } envelope
    if (
        hasattr(payload, "get")
        and "data" in payload
        and isinstance(payload.get("data"), dict)
    ):
        payload = payload["data"]

    try:
        result = apply_step(session, step_key, payload)
    except KeyError:
        return Response(
            {"detail": f"Step '{step_key}' has no handler yet."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )
    except ValidationError as exc:
        return Response(
            {"detail": "Validation failed.", "errors": _field_errors(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session.refresh_from_db()

    response_payload = {
        "step": result["step"],
        "stored": result["data"],
        "completion": result["completion"],
        "session": serialize_session(session),
    }

    # ── Step-specific response shapes ──
    if step_key == "step7":
        response_payload["created"] = result["data"].get("categories", [])
        response_payload["progress"] = serialize_session(session)

    if step_key == "step8":
        response_payload["created"] = result["data"].get("products", [])
        response_payload["progress"] = serialize_session(session)

    if step_key == "step12":
        response_payload["progress"] = serialize_session(session)

    return Response(response_payload)


# ============================================================
# STEP-SPECIFIC ACTIONS
# ============================================================

@api_view(["POST"])
@permission_classes([IsOnboardingOwner])
def test_etims(request):
    """
    Probe the KRA eTIMS endpoint with the merchant's credentials.
    Never persists anything — the real save happens on submit.
    """
    device_id = (request.data.get("device_id") or "").strip()
    pin = (request.data.get("pin") or "").strip()
    api_key = (request.data.get("api_key") or "").strip()
    env = (request.data.get("env") or "sandbox").strip()

    if not (device_id and pin and api_key):
        return Response(
            {"ok": False, "detail": "Device ID, PIN, and API key are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    base = (
        "https://etims-api-sbx.kra.go.ke"
        if env == "sandbox"
        else "https://etims-api.kra.go.ke"
    )

    try:
        resp = http_client.post(
            f"{base}/api/v1/health",
            headers={
                "X-Device-Id": device_id,
                "X-Pin": pin,
                "Authorization": f"Bearer {api_key}",
            },
            timeout=10,
        )
    except http_client.exceptions.RequestException as exc:
        return Response({"ok": False, "detail": f"Could not reach eTIMS: {exc}"})

    if resp.status_code == 200:
        return Response({"ok": True, "detail": "Connected to KRA eTIMS."})
    if resp.status_code in (401, 403):
        return Response({"ok": False, "detail": "Invalid credentials."})
    return Response({"ok": False, "detail": f"eTIMS returned {resp.status_code}."})


@api_view(["POST"])
@permission_classes([IsOnboardingOwner])
def test_step4(request):
    """
    Probe Safaricom Daraja with the merchant's M-Pesa credentials.
    Never persists — real save happens on submit.
    """
    creds = request.data.get("credentials") or {}

    required = ["consumer_key", "consumer_secret", "passkey", "shortcode"]
    missing = [k for k in required if not (creds.get(k) or "").strip()]
    if missing:
        return Response(
            {
                "ok": False,
                "detail": f"Missing required fields: {', '.join(missing)}.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    env = (creds.get("env") or "sandbox").strip()
    base = (
        "https://sandbox.safaricom.co.ke"
        if env == "sandbox"
        else "https://api.safaricom.co.ke"
    )

    auth = base64.b64encode(
        f"{creds['consumer_key']}:{creds['consumer_secret']}".encode()
    ).decode()

    try:
        resp = http_client.get(
            f"{base}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {auth}"},
            timeout=10,
        )
    except http_client.exceptions.RequestException as exc:
        return Response({"ok": False, "detail": f"Could not reach Safaricom: {exc}"})

    if resp.status_code == 200 and resp.json().get("access_token"):
        return Response({"ok": True, "detail": "Connected to Safaricom Daraja."})
    if resp.status_code == 401:
        return Response({"ok": False, "detail": "Invalid consumer key or secret."})
    return Response({"ok": False, "detail": f"Daraja returned {resp.status_code}."})


@api_view(["POST"])
@permission_classes([IsOnboardingOwner])
def verify_whatsapp(request):
    """
    Send or check an OTP for the merchant's WhatsApp number.

    - No `otp` in the body → generate a code, store it, return it in DEBUG.
    - `otp` in the body → validate against the stored code.
    """
    number = (request.data.get("number") or "").strip()
    otp = (request.data.get("otp") or "").strip()

    if not number:
        return Response(
            {"ok": False, "detail": "Phone number is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session = get_or_create_session(request.user)
    row = session.step_data.filter(step="step5").first()
    data = dict(row.data) if row else {}

    # ── Request a code ──
    if not otp:
        code = "123456" if settings.DEBUG else f"{random.randint(0, 999999):06d}"
        data["pending_otp"] = code
        data["pending_number"] = number

        from .models import OnboardingStepData
        OnboardingStepData.objects.update_or_create(
            session=session,
            step="step5",
            defaults={
                "data": data,
                "is_complete": row.is_complete if row else False,
            },
        )

        # TODO: send `code` via WhatsApp Cloud API or SMS provider.
        if settings.DEBUG:
            return Response({"ok": True, "detail": f"Dev code: {code}"})
        return Response({"ok": True, "detail": "Code sent. Check your WhatsApp."})

    # ── Verify a code ──
    try:
        from .steps.whatsapp import WhatsAppStep
        WhatsAppStep.validate_otp(otp)
    except ValidationError as exc:
        return Response({"ok": False, "detail": exc.messages[0]})

    expected = data.get("pending_otp")
    expected_number = data.get("pending_number")

    if not expected or expected_number != number:
        return Response({"ok": False, "detail": "Request a new code."})
    if otp != expected:
        return Response({"ok": False, "detail": "Incorrect code."})

    data["verified"] = True
    data["verified_at"] = timezone.now().isoformat()
    data.pop("pending_otp", None)
    data.pop("pending_number", None)

    from .models import OnboardingStepData
    OnboardingStepData.objects.update_or_create(
        session=session,
        step="step5",
        defaults={
            "data": data,
            "is_complete": row.is_complete if row else False,
        },
    )

    return Response({"ok": True, "detail": "Verified."})


@api_view(["POST"])
@permission_classes([IsOnboardingOwner])
def send_whatsapp_test(request):
    """
    Render the merchant's cart template with sample data.
    Never persists anything.
    """
    template = (request.data.get("template") or "").strip()
    if not template:
        return Response(
            {"ok": False, "detail": "Template is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session = get_or_create_session(request.user)
    row = session.step_data.filter(step="step5").first()
    data = row.data if row else {}
    to_number = data.get("number") or ""

    if not to_number:
        return Response(
            {"ok": False, "detail": "Save your WhatsApp number first."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    sample = {
        "store_name": "Your Store",
        "items": "1x Sample Item — KES 1,000",
        "total": "KES 1,000",
        "address": "Sample Street, Nairobi",
        "customer_name": "Sample Customer",
    }
    rendered = template
    for k, v in sample.items():
        rendered = rendered.replace("{" + k + "}", v)

    # TODO: send `rendered` to `to_number` via WhatsApp Cloud API.
    return Response({
        "ok": True,
        "detail": "Test message sent to your WhatsApp.",
        "rendered": rendered,
    })