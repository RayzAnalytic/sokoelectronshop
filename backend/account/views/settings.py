"""
account/views/settings.py

Settings page backend. Two endpoints, both authenticated:

    GET/PATCH/DELETE /api/v1/account/settings/
    GET/PATCH        /api/v1/account/settings/preferences/

Note on password change:
    The frontend's settings page calls `api.changePassword(...)`, which
    posts to `/api/v1/auth/change-password/` — that endpoint already
    lives in the authentication app (`ChangePasswordView`), so it is
    NOT duplicated here. Keeping it in `authentication` puts it next to
    every other credential operation (login, reset, verify) which is
    where it belongs.

Note on the profile shape:
    Unlike the earlier draft of this file, there is no separate
    `UserPreferences` model — the preference flags live directly on the
    custom `User`. Reads and writes therefore target `request.user`
    itself, with no `.preferences` relation in between.

ACCOUNT DELETION POLICY
───────────────────────
DELETE is a **soft delete**. It sets:

  * `is_active=False`              — invalidates future authentication
  * `deletion_requested_at=<now>`  — marks the account for the admin
                                      team to purge on a schedule

Hard delete is intentionally not offered. `checkout.Order` rows must
be retained for accounting, and reviews/notifications/addresses are
cascaded anyway when the PII purge happens later. The customer can
keep using the account until they request deletion; after that, they
are logged out and cannot sign back in.

The response is 204 whether or not the flag was already set, so the
frontend's success handler is uniform. A duplicate DELETE from the
same session is harmless.
"""

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


# ─────────────────────────────────────────────────────────────────────────────
# Settings — profile fields + delete
# ─────────────────────────────────────────────────────────────────────────────
class SettingsView(APIView):
    """
    GET    /api/v1/account/settings/   → full profile shape
    PATCH  /api/v1/account/settings/   → partial update (first/last/phone)
    DELETE /api/v1/account/settings/   → request account deletion (soft)

    Response shape (matches `lib/api.ts` ProfileData):

        {
          first_name, last_name,
          email,                       # read-only here
          phone,
          whatsapp_updates, email_promotions,
          sms_promotions, newsletter,
          deletion_requested_at,       # null unless requested
          joined_at
        }

    Email is deliberately read-only. Changing it requires a
    verify-email flow (send to old, send to new, confirm both) which is
    out of scope for the settings page. The frontend already renders the
    email field disabled and points the customer at support.

    PATCH with an empty body is a no-op that returns the current state.
    Without the early return, the view would call `save(update_fields=[])`
    — legal but confusing to anyone reading the trace.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfileDataSerializer(request.user).data)

    def patch(self, request):
        ser = ProfileUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        user = request.user
        changed = list(ser.validated_data.keys())

        # No fields supplied — echo the current state rather than
        # issuing a no-op UPDATE. Cheaper and clearer.
        if not changed:
            return Response(ProfileDataSerializer(user).data)

        for field, value in ser.validated_data.items():
            setattr(user, field, value)
        user.save(update_fields=changed)

        return Response(ProfileDataSerializer(user).data)

    def delete(self, request):
        """
        Soft-delete: mark for admin purge, deactivate the account,
        destroy the session.

        Two writes plus a logout:

          * `is_active=False` — Django's auth backend rejects inactive
            users on every subsequent request. `api.me()` returns 401,
            which the frontend uses to bounce the customer off
            `/pages/account`.

          * `deletion_requested_at=<now>` — a marker for the admin
            team's periodic PII purge job.

          * `django_logout(request)` — flushes the session and clears
            the cookie. Without this, the session row survives until
            its natural expiry; the auth backend would still reject
            it, but leaving a dead session around is a needless
            trace.

        Returns 204 whether the account was already marked or not.
        A second DELETE from the same session is a no-op after the
        logout — the second request is unauthenticated and rejected
        by the permission class before reaching this view.
        """
        user = request.user
        user.is_active = False
        user.deletion_requested_at = timezone.now()
        user.save(update_fields=["is_active", "deletion_requested_at"])

        django_logout(request)

        # NOTE: a confirmation email notifying the customer that the
        # deletion request was received is intentionally deferred. When
        # the notification system is extended, add:
        #
        #   from .services import notify_account_deletion_requested
        #   notify_account_deletion_requested(user)
        #
        # before the logout call — the notifier reads `user.email`,
        # which is still available here even after `is_active=False`.

        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Preferences — the four communication flags
# ─────────────────────────────────────────────────────────────────────────────
class PreferencesView(APIView):
    """
    GET   /api/v1/account/settings/preferences/
    PATCH /api/v1/account/settings/preferences/

    Response shape (matches `lib/api.ts` PreferencesInput):

        {
          whatsapp_updates: boolean,
          email_promotions: boolean,
          sms_promotions: boolean,
          newsletter: boolean
        }

    These are columns on `User`, not a related model. Reads and writes
    go straight to `request.user`. If preferences ever grow beyond a
    handful of booleans, extracting them into a `UserPreferences`
    OneToOne is a straightforward migration — but for four flags on
    the same row, keeping them inline avoids a join on every
    settings-page load.

    Both GET and PATCH return the serializer's output — one shape,
    one code path. Adding a fifth preference means editing
    `PreferencesSerializer` and nothing else.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PreferencesSerializer(request.user).data)

    def patch(self, request):
        ser = PreferencesSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        user = request.user
        changed = list(ser.validated_data.keys())

        # Same empty-patch guard as the profile view.
        if not changed:
            return Response(PreferencesSerializer(user).data)

        for field, value in ser.validated_data.items():
            setattr(user, field, value)
        user.save(update_fields=changed)

        # Echo the current state back so the frontend can re-sync its
        # local toggle state from a single source of truth.
        return Response(PreferencesSerializer(user).data)