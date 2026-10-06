import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ChatRequestSerializer, ChatResponseSerializer
from . import services

logger = logging.getLogger(__name__)


class ChatView(APIView):
    """
    POST /api/ai/chat/

    Request:
      { "message": "...", "session_id": "uuid (optional)" }

    Response:
      { "session_id", "message", "products", "chips", "requires_auth" }
    """
    permission_classes = [AllowAny]
    throttle_scope = "ai_chat"

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = serializer.validated_data["message"]
        session_id = serializer.validated_data.get("session_id")

        session = services.get_or_create_session(session_id, request.user)

        try:
            result = services.run_chat_turn(session, message, request)
        except RuntimeError as exc:
            logger.error("AI chat unavailable: %s", exc)
            return Response(
                {"detail": "AI assistant is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("AI chat failed: %s", exc)
            return Response(
                {"detail": "AI assistant is temporarily unavailable. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payload = {
            "session_id": result.session.id,
            "message": result.text,
            "products": result.products,
            "chips": result.chips,
            "requires_auth": result.requires_auth,
        }
        return Response(ChatResponseSerializer(payload).data, status=status.HTTP_200_OK)