"""
dashboard/settings/views.py

Endpoints backing the Settings page.

  • Singleton views — one GET + one PATCH each on a fixed URL
    (no pk, no list route).
  • Runtime view — one GET returning the flat snapshot every other
    admin page reads to gate its UI.
  • Public view — one GET for the customer app (safe subset only).
  • Multi-row viewsets — routers are appropriate since they do CRUD.
  • Security actions — password change, 2FA setup / verify, session list,
    session revoke.
  • Public M-Pesa callback — Safaricom POSTs here, no auth.

Every successful PATCH:
  1. Snapshots `before` + `after` values,
  2. Writes a SettingsAuditLog row per changed field,
  3. Invalidates the settings cache so the next read hits the DB.
"""

from django.contrib.auth import update_session_auth_hash
from django.contrib.sessions.models import Session
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework import mixins, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import serializers as s
from .models import (
    CheckoutSettings,
    DeliveryZone,
    EtimsConfig,
    EtimsSubmission,
    GeneralSettings,
    IntegrationStatus,
    InventorySettings,
    LoginEvent,
    MpesaConfig,
    MpesaTransaction,
    NotificationLog,
    NotificationSettings,
    PaymentSettings,
    ReviewSettings,
    SecuritySettings,
    SettingsAuditLog,
    ShippingProvider,
    ShippingSettings,
    StoreSettings,
    TaxSettings,
    WhatsAppConfig,
)
from .services import (
    audit_diff,
    get_runtime_settings,
    handle_mpesa_callback,
    invalidate_settings_cache,
    refresh_integration_status,
)


# ══════════════════════════════════════════════════════════════
# Base singleton view — GET + PATCH on a fixed URL
#
# We use APIView instead of GenericViewSet because DRF's DefaultRouter
# skips the list route when a viewset lacks a `list` method. Singletons
# only expose GET + PATCH, so registering them with a router produces
# `/general/{pk}/` and NOT `/general/`. Registering them with plain
# `path()` and APIView keeps the base URL alive with no pk.
# ══════════════════════════════════════════════════════════════

# Fields excluded from the before / after snapshot. These are managed
# by the framework and shouldn't show up in the audit log.
_SNAPSHOT_IGNORE = {"id", "updated_at", "pk"}


class SingletonView(APIView):
    permission_classes = [IsAdminUser]
    model_class = None
    serializer_class = None

    # ── helpers ────────────────────────────────────────────────

    @staticmethod
    def _snapshot(obj) -> dict:
        return {
            f.name: getattr(obj, f.name)
            for f in obj._meta.fields
            if f.name not in _SNAPSHOT_IGNORE
        }

    # ── HTTP methods ───────────────────────────────────────────

    def get(self, request):
        obj = self.model_class.load()
        return Response(self.serializer_class(obj).data)

    def patch(self, request):
        obj = self.model_class.load()
        before = self._snapshot(obj)

        ser = self.serializer_class(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        updated = ser.save()

        after = self._snapshot(updated)
        audit_diff(
            self.model_class.__name__,
            before,
            after,
            user=request.user,
            ip=request.META.get("REMOTE_ADDR"),
        )

        # Every settings write invalidates the shared bundle so the
        # next request reads the fresh values.
        invalidate_settings_cache()

        return Response(self.serializer_class(updated).data)


# ── Concrete singletons ────────────────────────────────────────

class GeneralView(SingletonView):
    model_class = GeneralSettings
    serializer_class = s.GeneralSerializer


class StoreView(SingletonView):
    model_class = StoreSettings
    serializer_class = s.StoreSerializer


class CheckoutView(SingletonView):
    model_class = CheckoutSettings
    serializer_class = s.CheckoutSerializer


class InventoryView(SingletonView):
    model_class = InventorySettings
    serializer_class = s.InventorySerializer


class ReviewView(SingletonView):
    model_class = ReviewSettings
    serializer_class = s.ReviewSerializer


class PaymentView(SingletonView):
    model_class = PaymentSettings
    serializer_class = s.PaymentSerializer


class ShippingView(SingletonView):
    model_class = ShippingSettings
    serializer_class = s.ShippingSerializer


class NotificationView(SingletonView):
    model_class = NotificationSettings
    serializer_class = s.NotificationSerializer


class SecurityView(SingletonView):
    model_class = SecuritySettings
    serializer_class = s.SecuritySerializer


class TaxView(SingletonView):
    model_class = TaxSettings
    serializer_class = s.TaxSerializer


# ══════════════════════════════════════════════════════════════
# Runtime snapshot — the single flat read every admin page uses
#
# Replaces ten separate GETs on mount with one cached request. The
# payload is computed by `services.get_runtime_settings()`, which
# merges the singleton values, derives combined flags (e.g.
# `mpesa_enabled` is the AND of PaymentSettings and MpesaConfig), and
# caches the whole object for 5 minutes.
# ══════════════════════════════════════════════════════════════

class RuntimeSettingsView(APIView):
    """GET /api/v1/admin/settings/runtime/

    Flat snapshot of every setting a page might gate on. Backend
    caches for 5 minutes; frontend refetches after any save.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(get_runtime_settings().to_dict())


class PublicSettingsView(APIView):
    """GET /api/v1/settings/public/

    Safe subset for the customer storefront — no admin-only fields
    like `admin_alert_email` or `session_timeout_minutes`.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        rt = get_runtime_settings()
        return Response(
            {
                "business_name": rt.business_name,
                "currency": rt.currency,
                "vat_enabled": rt.vat_enabled,
                "vat_rate": rt.vat_rate,
                "prices_include_tax": rt.prices_include_tax,
                "free_shipping_threshold_kes": rt.free_shipping_threshold_kes,
                "default_delivery_fee_kes": rt.default_delivery_fee_kes,
                "mpesa_enabled": rt.mpesa_enabled,
                "allow_guest_checkout": rt.allow_guest_checkout,
                "require_phone": rt.require_phone,
                "store_status": rt.store_status,
                "store_paused_message": rt.store_paused_message,
            }
        )


# ══════════════════════════════════════════════════════════════
# Status-only views — read-only, no credentials exposed
# ══════════════════════════════════════════════════════════════

class MpesaStatusView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(s.MpesaStatusSerializer(MpesaConfig.load()).data)


class WhatsAppStatusView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(s.WhatsAppStatusSerializer(WhatsAppConfig.load()).data)


class EtimsStatusView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(s.EtimsStatusSerializer(EtimsConfig.load()).data)


# ══════════════════════════════════════════════════════════════
# Multi-row viewsets — router is appropriate (they have CRUD)
# ══════════════════════════════════════════════════════════════

class ShippingProviderViewSet(viewsets.ModelViewSet):
    queryset = ShippingProvider.objects.all()
    serializer_class = s.ShippingProviderSerializer
    permission_classes = [IsAdminUser]
    lookup_field = "key"


class DeliveryZoneViewSet(viewsets.ModelViewSet):
    queryset = DeliveryZone.objects.all()
    serializer_class = s.DeliveryZoneSerializer
    permission_classes = [IsAdminUser]

    def perform_create(self, serializer):
        last = DeliveryZone.objects.order_by("-display_order").first()
        next_order = (last.display_order + 1) if last else 0
        serializer.save(display_order=next_order)


class PublicDeliveryZoneViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Anonymous storefront reads for the checkout delivery picker."""

    queryset = DeliveryZone.objects.filter(enabled=True)
    serializer_class = s.DeliveryZoneSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class MpesaTransactionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = MpesaTransaction.objects.all()
    serializer_class = s.MpesaTransactionSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["status", "order_id"]


class NotificationLogViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = NotificationLog.objects.all()
    serializer_class = s.NotificationLogSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["event", "channel", "success"]


class LoginHistoryView(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Login events for the current admin only — not everyone's."""

    serializer_class = s.LoginEventSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

    def get_queryset(self):
        return LoginEvent.objects.filter(user=self.request.user)[:50]


class IntegrationStatusViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = IntegrationStatus.objects.all()
    serializer_class = s.IntegrationStatusSerializer
    permission_classes = [IsAdminUser]
    lookup_field = "key"
    filterset_fields = ["category", "connected"]

    def retrieve(self, request, *args, **kwargs):
        """GET /integrations/<key>/ — also pings the service first.

        The grid on the Settings page hits this when a card is clicked,
        so the "Connected" badge reflects reality, not the last Celery
        run.
        """
        try:
            refresh_integration_status()
        except Exception:
            # Never let a health-check failure break the read.
            pass
        return super().retrieve(request, *args, **kwargs)


class AuditLogViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = SettingsAuditLog.objects.all()
    serializer_class = s.SettingsAuditLogSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["section", "field_name", "changed_by"]


class EtimsSubmissionViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = EtimsSubmission.objects.all()
    serializer_class = s.EtimsSubmissionSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["status", "order_id"]


# ══════════════════════════════════════════════════════════════
# Security actions
# ══════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAdminUser])
def change_password(request):
    ser = s.ChangePasswordSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    user = request.user
    if not user.check_password(ser.validated_data["current_password"]):
        return Response({"detail": "Current password is incorrect"}, status=400)

    user.set_password(ser.validated_data["new_password"])
    user.save()

    # Keep the current session alive after a password change.
    update_session_auth_hash(request, user)

    return Response({"detail": "Password updated"})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def setup_2fa(request):
    device, _ = TOTPDevice.objects.get_or_create(
        user=request.user,
        name="default",
    )
    return Response(
        {
            "secret": device.key,
            "otpauth_url": device.config_url,
            "confirmed": device.confirmed,
        }
    )


@api_view(["POST"])
@permission_classes([IsAdminUser])
def verify_2fa(request):
    ser = s.TwoFAVerifySerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    try:
        device = TOTPDevice.objects.get(user=request.user, name="default")
    except TOTPDevice.DoesNotExist:
        return Response({"detail": "No 2FA device"}, status=400)

    if device.verify_token(ser.validated_data["code"]):
        device.confirmed = True
        device.save()
        return Response({"detail": "2FA enabled"})

    return Response({"detail": "Invalid code"}, status=400)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def list_sessions(request):
    """Active sessions belonging to the current user.

    Django's Session table stores the decoded user id — we walk the
    non-expired rows and keep only this user's sessions.
    """
    current_key = request.session.session_key
    user_id_str = str(request.user.pk)

    rows = []
    for sess in Session.objects.filter(expire_date__gte=timezone.now()):
        try:
            data = sess.get_decoded()
        except Exception:
            continue
        if data.get("_auth_user_id") == user_id_str:
            rows.append(
                {
                    "id": sess.session_key,
                    "expires_at": sess.expire_date,
                    "current": sess.session_key == current_key,
                }
            )

    return Response(rows)


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def revoke_session(request, session_key):
    # Guard: never let an admin revoke their own current session.
    if session_key == request.session.session_key:
        return Response(
            {"detail": "You cannot revoke the session you are currently using."},
            status=400,
        )

    Session.objects.filter(session_key=session_key).delete()
    return Response(status=204)


# ══════════════════════════════════════════════════════════════
# Integration refresh
# ══════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAdminUser])
def refresh_integrations(request):
    """Force-rerun the health checks.

    Called by the "Refresh status" button on the Integrations tab.
    Returns the freshly-updated rows so the frontend can re-render
    without a second GET.
    """
    try:
        refresh_integration_status()
    except Exception as e:
        return Response(
            {"detail": f"Refresh failed: {e}"},
            status=500,
        )

    rows = IntegrationStatus.objects.all()
    return Response(s.IntegrationStatusSerializer(rows, many=True).data)


# ══════════════════════════════════════════════════════════════
# M-Pesa callback (public, no auth)
# ══════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([AllowAny])
def mpesa_callback(request):
    """Safaricom POSTs here. We always return 200 — if we return an
    error, Safaricom retries up to three times, which we don't want."""
    try:
        handle_mpesa_callback(request.data)
    except Exception:
        # Swallow — the handler already logs. Safaricom must see 200.
        import logging

        logging.getLogger(__name__).exception("M-Pesa callback failed")

    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})