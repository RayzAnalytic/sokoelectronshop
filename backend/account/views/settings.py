from django.contrib.auth import logout
from django.utils import timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializers import (
    PreferencesSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
)


class ProfileView(APIView):
    """
    GET    /api/v1/account/profile/   → read profile + preferences + joined_at
    PATCH  /api/v1/account/profile/   → update first_name / last_name / phone
    """

    def get(self, request):
        return Response(ProfileSerializer(request.user).data)

    def patch(self, request):
        ser = ProfileUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        user = request.user
        for field in ("first_name", "last_name", "phone"):
            if field in ser.validated_data:
                setattr(user, field, ser.validated_data[field])
        user.save()

        return Response(ProfileSerializer(user).data)


class PreferencesView(APIView):
    """
    GET    /api/v1/account/profile/preferences/   → read the four booleans
    PATCH  /api/v1/account/profile/preferences/   → update any of them
    """

    FIELDS = (
        "whatsapp_updates",
        "email_promotions",
        "sms_promotions",
        "newsletter",
    )

    def get(self, request):
        user = request.user
        return Response({f: getattr(user, f) for f in self.FIELDS})

    def patch(self, request):
        ser = PreferencesSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        user = request.user
        for f in self.FIELDS:
            if f in ser.validated_data:
                setattr(user, f, ser.validated_data[f])
        user.save()

        return Response({f: getattr(user, f) for f in self.FIELDS})


class DeleteAccountView(APIView):
    """
    POST   /api/v1/account/profile/delete/
    Soft-deletes the account and logs the user out. Orders, payments,
    and reviews remain in the DB so accounting and support stay intact.
    """

    def post(self, request):
        if request.data.get("confirm") != "DELETE":
            return Response(
                {"detail": 'Set "confirm": "DELETE" to confirm.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        user.is_active = False
        user.deletion_requested_at = timezone.now()
        user.save(update_fields=["is_active", "deletion_requested_at"])

        # Clear the session so the next request is anonymous.
        logout(request)

        return Response(status=status.HTTP_204_NO_CONTENT)