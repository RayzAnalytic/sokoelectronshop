# team/views.py

import logging

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TeamInvite
from .serializers import (
    AcceptInviteSerializer,
    TeamInviteCreateSerializer,
    TeamInviteSerializer,
)
from .services import (
    accept_invite,
    create_invite,
    get_invite_by_token,
    revoke_invite,
    send_invite_email,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# LIST + CREATE
# ─────────────────────────────────────────────────────────────
class TeamInviteListView(generics.ListCreateAPIView):
    """
    GET  /api/team/invites/  — list pending invites for the current user
    POST /api/team/invites/  — create a new invite
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TeamInvite.objects.filter(
            owner=self.request.user,
            status=TeamInvite.Status.PENDING,
        ).order_by("-created_at")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TeamInviteCreateSerializer
        return TeamInviteSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite = serializer.save()
        return Response(
            TeamInviteSerializer(invite).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────
# DETAIL + DELETE (revoke)
# ─────────────────────────────────────────────────────────────
class TeamInviteDetailView(generics.RetrieveDestroyAPIView):
    """
    GET    /api/team/invites/<uuid:id>/  — retrieve one
    DELETE /api/team/invites/<uuid:id>/  — revoke (soft)
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TeamInviteSerializer
    lookup_field = "id"

    def get_queryset(self):
        return TeamInvite.objects.filter(owner=self.request.user)

    def perform_destroy(self, instance):
        # Soft delete — flip status to REVOKED instead of deleting the row
        if not revoke_invite(instance):
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "This invite is no longer pending and can't be revoked."
            )


# ─────────────────────────────────────────────────────────────
# REVOKE (explicit POST variant)
# ─────────────────────────────────────────────────────────────
class RevokeInviteView(APIView):
    """
    POST /api/team/invites/<uuid:id>/revoke/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        invite = TeamInvite.objects.filter(
            owner=request.user, id=id
        ).first()
        if not invite:
            return Response(
                {"detail": "Invite not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not revoke_invite(invite):
            return Response(
                {"detail": "This invite can no longer be revoked."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"detail": "Invite revoked."},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# ACCEPT (public — called from the email link)
# ─────────────────────────────────────────────────────────────
class AcceptInviteView(APIView):
    """
    POST /api/team/accept/
    Body: { "token": "..." }

    Behaviour:
      - If the caller is not authenticated, respond 401 with a
        `requires_auth: true` flag so the frontend can redirect
        to signup/login and then retry.
      - If authenticated, accept the invite.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]

        invite = get_invite_by_token(token)
        if not invite:
            return Response(
                {"detail": "Invalid invitation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Require an authenticated user to accept
        user = request.user if request.user.is_authenticated else None
        if user is None:
            return Response(
                {
                    "detail": "Please sign in to accept this invitation.",
                    "requires_auth": True,
                    "email": invite.email,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        ok, message = accept_invite(invite, user)
        if not ok:
            return Response(
                {"detail": message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "detail": "Invitation accepted.",
                "invite": TeamInviteSerializer(invite).data,
            },
            status=status.HTTP_200_OK,
        )