import logging

from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import ChatSession
from .serializers import (
    ChatRequestSerializer,
    ChatResponseSerializer,
    ChatSessionSerializer,
    ChatSessionDetailSerializer,
)

logger = logging.getLogger(__name__)


class ChatView(APIView):
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

        except Exception as exc:
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


class ChatSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            ChatSession.objects.filter(user=request.user, is_active=True)
            .annotate(message_count=Count("messages"))
            .order_by("-updated_at")[:50]
        )
        return Response(ChatSessionSerializer(qs, many=True).data)


class ChatSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(
            ChatSession.objects.annotate(message_count=Count("messages")),
            id=session_id,
            user=request.user,
        )
        return Response(ChatSessionDetailSerializer(session).data)


class ChatSessionArchiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(
            ChatSession, id=session_id, user=request.user,
        )
        session.is_active = False
        session.save(update_fields=["is_active", "updated_at"])
        return Response({"ok": True})