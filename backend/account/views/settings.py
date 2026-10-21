from django.contrib.auth import logout as django_logout
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializers import (
    PreferencesSerializer,
    ProfileDataSerializer,
    ProfileUpdateSerializer,
)


class SettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfileDataSerializer(request.user).data)

    def patch(self, request):
        ser = ProfileUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        user = request.user
        changed = list(ser.validated_data.keys())

        if not changed:
            return Response(ProfileDataSerializer(user).data)

        for field, value in ser.validated_data.items():
            setattr(user, field, value)
        user.save(update_fields=changed)

        return Response(ProfileDataSerializer(user).data)

    def delete(self, request):
        user = request.user
        user.is_active = False
        user.deletion_requested_at = timezone.now()
        user.save(update_fields=["is_active", "deletion_requested_at"])

        django_logout(request)

        return Response(status=status.HTTP_204_NO_CONTENT)


class PreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PreferencesSerializer(request.user).data)

    def patch(self, request):
        ser = PreferencesSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        user = request.user
        changed = list(ser.validated_data.keys())

        if not changed:
            return Response(PreferencesSerializer(user).data)

        for field, value in ser.validated_data.items():
            setattr(user, field, value)
        user.save(update_fields=changed)

        return Response(PreferencesSerializer(user).data)