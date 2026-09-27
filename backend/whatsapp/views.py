# whatsapp/views.py

import hashlib
import hmac
import json
import logging

from django.conf import settings

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WhatsAppMessage
from .serializers import (
    WhatsAppMessageSerializer,
    WhatsAppSendSerializer,
    WhatsAppSendTemplateSerializer,
)
from .services.client import WhatsAppClient

logger = logging.getLogger(__name__)


# ============================================================
# WEBHOOK — receives messages and status updates from Meta
# ============================================================
class WhatsAppWebhookView(APIView):
    """
    Handles Meta's webhook:
    - GET: verification handshake
    - POST: incoming messages / status updates
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    # ── Verification handshake ──
    def get(self, request):
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")

        if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
            return Response(int(challenge), status=status.HTTP_200_OK)

        logger.warning(
            "WhatsApp webhook verification failed (mode=%s)", mode
        )
        return Response(status=status.HTTP_403_FORBIDDEN)

    # ── Incoming events ──
    def post(self, request):
        raw_body = request.body
        signature = request.headers.get("X-Hub-Signature-256", "")

        # 1. Verify signature
        if not self._verify_signature(raw_body, signature):
            logger.warning("WhatsApp webhook: invalid signature")
            return Response(status=status.HTTP_403_FORBIDDEN)

        # 2. Parse JSON safely
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            logger.exception("WhatsApp webhook: malformed JSON")
            return Response(
                {"status": "invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Process (never let errors cause Meta to retry forever)
        try:
            self._process_payload(payload)
        except Exception:
            logger.exception("WhatsApp webhook: processing error")

        # 4. Always 200 so Meta stops retrying
        return Response({"status": "ok"}, status=status.HTTP_200_OK)

    # ── Signature verification ──
    def _verify_signature(self, raw_body, signature):
        if not signature or not settings.WHATSAPP_APP_SECRET:
            return False
        expected = "sha256=" + hmac.new(
            settings.WHATSAPP_APP_SECRET.encode(),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    # ── Payload processing ──
    def _process_payload(self, payload):
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for msg in value.get("messages", []):
                    self._save_inbound(msg, value)
                for st in value.get("statuses", []):
                    self._update_status(st)

    def _save_inbound(self, msg, value):
        wa_id = msg.get("id", "")
        if not wa_id:
            return

        # Idempotency — Meta retries webhooks
        if WhatsAppMessage.objects.filter(wa_message_id=wa_id).exists():
            return

        from_number = msg.get("from", "")
        msg_type = msg.get("type", "text")

        # Extract body — text has .text.body, others get a placeholder
        if msg_type == "text":
            body = msg.get("text", {}).get("body", "")
        elif msg_type == "button":
            body = msg.get("button", {}).get("text", "[button]")
        elif msg_type == "interactive":
            interactive = msg.get("interactive", {})
            body = (
                interactive.get("button_reply", {}).get("title")
                or interactive.get("list_reply", {}).get("title")
                or "[interactive]"
            )
        else:
            body = f"[{msg_type} message]"

        WhatsAppMessage.objects.create(
            wa_message_id=wa_id,
            direction=WhatsAppMessage.Direction.INBOUND,
            from_number=from_number,
            to_number=value.get("metadata", {}).get(
                "display_phone_number", ""
            ),
            body=body,
            status=WhatsAppMessage.Status.DELIVERED,
            raw_payload=msg,
        )

    def _update_status(self, st):
        wa_id = st.get("id", "")
        if not wa_id:
            return

        new_status = st.get("status", "").upper()
        if new_status not in dict(WhatsAppMessage.Status.choices):
            return

        WhatsAppMessage.objects.filter(wa_message_id=wa_id).update(
            status=new_status,
        )


# ============================================================
# SEND — outbound text OR template
# ============================================================
class SendWhatsAppView(APIView):
    """
    POST /api/whatsapp/send/

    Two modes:
      - Free-form text:  { "to": "+254712345678", "text": "Hello" }
      - Template message: { "to": "...", "template_name": "order_shipped",
                            "language": "en_US", "components": [...] }

    Free-form text is only allowed within 24 hours of the customer's
    last message. Outside that window, use a template.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Route to template path if template_name is present
        if request.data.get("template_name"):
            return self._send_template(request)
        return self._send_text(request)

    # ── Text send ──
    def _send_text(self, request):
        serializer = WhatsAppSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        client = WhatsAppClient()
        try:
            response = client.send_text(data["to"], data["text"])
        except Exception as exc:
            logger.exception("WhatsApp text send failed")
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        body = data["text"]
        self._log_outbound(data["to"], body, response)

        return Response(response, status=status.HTTP_201_CREATED)

    # ── Template send ──
    def _send_template(self, request):
        serializer = WhatsAppSendTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        client = WhatsAppClient()
        try:
            response = client.send_template(
                to_number=data["to"],
                template_name=data["template_name"],
                language=data.get("language", "en_US"),
                components=data.get("components") or None,
            )
        except Exception as exc:
            logger.exception("WhatsApp template send failed")
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        body = f"[template: {data['template_name']}]"
        self._log_outbound(data["to"], body, response)

        return Response(response, status=status.HTTP_201_CREATED)

    # ── Shared outbound logger ──
    def _log_outbound(self, to, body, response):
        msg_id = ""
        try:
            msg_id = response.get("messages", [{}])[0].get("id", "")
        except (IndexError, AttributeError):
            pass

        WhatsAppMessage.objects.create(
            wa_message_id=msg_id,
            direction=WhatsAppMessage.Direction.OUTBOUND,
            from_number=getattr(settings, "WHATSAPP_BUSINESS_NUMBER", ""),
            to_number=to,
            body=body,
            status=WhatsAppMessage.Status.SENT,
            raw_payload=response,
        )


# ============================================================
# LIST — paginated message history
# ============================================================
class WhatsAppMessageListView(generics.ListAPIView):
    """
    GET /api/whatsapp/messages/
    Optional query params: ?direction=INBOUND, ?status=SENT
    """
    serializer_class = WhatsAppMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = WhatsAppMessage.objects.all().order_by("-created_at")

        direction = self.request.query_params.get("direction")
        status_param = self.request.query_params.get("status")

        if direction:
            qs = qs.filter(direction=direction.upper())
        if status_param:
            qs = qs.filter(status=status_param.upper())

        return qs


# ============================================================
# DETAIL — single message
# ============================================================
class WhatsAppMessageDetailView(generics.RetrieveAPIView):
    """
    GET /api/whatsapp/messages/<uuid:id>/
    """
    serializer_class = WhatsAppMessageSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"
    queryset = WhatsAppMessage.objects.all()