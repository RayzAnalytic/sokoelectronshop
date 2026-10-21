import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import ChatRequestSerializer, ChatResponseSerializer

logger = logging.getLogger(__name__)


class ChatView(APIView):
    """
    POST /api/ai/chat/

    Request:
      { "message": "...", "session_id": "uuid (optional)" }

    Response:
      { "session_id", "message", "products", "chips", "requires_auth" }

    Status codes:
      200 — normal reply
      400 — invalid request body
      429 — provider rate limit / quota exceeded
      503 — AI not configured (missing API key, unknown provider)
      502 — provider unreachable or returned an error
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

        except services.AIConfigurationError as exc:
            logger.error("AI chat misconfigured: %s", exc)
            return Response(
                {"detail": "AI assistant is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        except services.AIRateLimitError as exc:
            logger.warning("AI chat rate limited: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        except services.AIProviderUnavailableError as exc:
            logger.warning("AI provider unavailable: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        except Exception as exc:  # noqa: BLE001
            logger.exception("AI chat failed unexpectedly: %s", exc)
            return Response(
                {
                    "detail": (
                        "AI assistant is temporarily unavailable. "
                        "Please try again."
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payload = {
            "session_id": result.session.id,
            "message": result.text,
            "products": result.products,
            "chips": result.chips,
            "requires_auth": result.requires_auth,
        }
        return Response(
            ChatResponseSerializer(payload).data,
            status=status.HTTP_200_OK,
        )