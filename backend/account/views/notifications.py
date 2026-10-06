"""
account/views/notifications.py

Notification endpoints. All require authentication and scope by
`user=request.user`.

Endpoints:

    GET    /api/v1/account/notifications/                 — list
    POST   /api/v1/account/notifications/<id>/read/       — mark one read
    DELETE /api/v1/account/notifications/<id>/            — delete one
    POST   /api/v1/account/notifications/read-all/        — mark all read
    POST   /api/v1/account/notifications/clear/           — delete all
    GET    /api/v1/account/notifications/unread-count/    — badge count

Writes go through `account.services` so a future change to delivery
(email, push, webhook) lives in one place. The views stay thin.

LIST SIZE AND PAGINATION
------------------------
The list endpoint caps results at `LIST_HARD_CAP` (500) to bound
response size. The cap is generous enough that a normal customer never
hits it, and large enough that the frontend's client-side "unread"
counter is accurate for anyone whose total is under the cap.

Two response headers describe the truncation:

    X-Total-Count    — total notifications for this user
    X-Unread-Count   — unread notifications for this user

The frontend derives its header text from the loaded array today.
Those headers are the migration path: when the list grows past the
cap in practice, swap to `?before=<iso>` cursor pagination and the
frontend can read the headers to know when to show a "load more" link.

WHY POST FOR CLEAR
------------------
The frontend calls `POST /clear/` (see `lib/api.ts`). POST-on-collection
avoids the corner cases of DELETE-on-collection that some proxies and
older CDNs mishandle. The operation is idempotent regardless of method.
"""

from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Notification
from ..serializers import NotificationSerializer
from ..services import (
    mark_all_read,
    mark_notification_read,
    unread_count,
)


# Maximum rows the list endpoint will return. Chosen to fit comfortably
# in a mobile browser's memory and to keep the response under ~250 KB.
# Bump this only after adding pagination — raising it without a cursor
# is a stopgap that pushes the problem downstream.
LIST_HARD_CAP = 500


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────
class NotificationListView(APIView):
    """
    GET /api/v1/account/notifications/

    Returns the customer's notifications, newest first, capped at
    `LIST_HARD_CAP`.

    Response shape matches `lib/api.ts` NotificationRow:

        [
          {
            id, type, title, body, href, metadata,
            is_read, read_at, created_at
          },
          ...
        ]

    Also sets two response headers:

        X-Total-Count    — how many notifications exist for this user
        X-Unread-Count   — how many are unread

    The frontend derives its header text from the loaded array. Those
    headers give it a way to detect truncation without changing the
    response shape — a future "load more" feature reads them to decide
    whether to show the button.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
        total = qs.count()
        unread = qs.filter(is_read=False).count()
        page = qs[:LIST_HARD_CAP]

        response = Response(NotificationSerializer(page, many=True).data)
        response["X-Total-Count"] = str(total)
        response["X-Unread-Count"] = str(unread)
        return response


# ─────────────────────────────────────────────────────────────────────────────
# Mark one as read
# ─────────────────────────────────────────────────────────────────────────────
class NotificationMarkReadView(APIView):
    """
    POST /api/v1/account/notifications/<id>/read/

    Ownership-scoped — a customer can only mark their own notifications
    read. A foreign id returns 404, not 403.

    Idempotent: calling this on an already-read notification is a
    no-op. The `mark_notification_read` service short-circuits when
    the flag is already set, so no write fires and the returned
    `read_at` is the original timestamp.

    Returns the serialized row — the frontend uses the response's
    `read_at` to replace its optimistic timestamp with the server's
    exact value, avoiding a client/server clock skew of a few ms.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = get_object_or_404(
            Notification, pk=pk, user=request.user
        )
        mark_notification_read(notification)
        return Response(NotificationSerializer(notification).data)


# ─────────────────────────────────────────────────────────────────────────────
# Delete one
# ─────────────────────────────────────────────────────────────────────────────
class NotificationDeleteView(APIView):
    """
    DELETE /api/v1/account/notifications/<id>/

    Ownership-scoped. Returns 204 whether or not the row existed —
    the customer is dismissing it, and a "not found" response would
    just be noise on a UI action they already committed to.

    Delete is hard, not soft. Notifications are ephemeral UI; the
    durable audit trail for anything order-related lives in
    `checkout.OrderStatusEvent`.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        Notification.objects.filter(pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Mark all read
# ─────────────────────────────────────────────────────────────────────────────
class NotificationMarkAllReadView(APIView):
    """
    POST /api/v1/account/notifications/read-all/

    Bulk update. Returns `{ updated: N }` — the count of rows that
    actually flipped from unread to read. The frontend ignores the
    number, but it's useful in logs and for tests.

    Ownership is enforced by the `user=request.user` filter inside
    `mark_all_read` — no cross-user write is possible even if the
    view forgot to filter.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = mark_all_read(request.user)
        return Response(
            {"updated": count},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Clear all
# ─────────────────────────────────────────────────────────────────────────────
class NotificationClearView(APIView):
    """
    POST /api/v1/account/notifications/clear/

    Deletes every notification belonging to the customer. Returns
    `{ deleted: N }`.

    Throttled with the `notifications_clear` scope — the operation is
    destructive and a scripted caller could hammer the DB with
    repeated bulk DELETEs. Register the rate in
    `settings.REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`:

        "notifications_clear": "10/hour"

    The frontend already calls this via POST, not DELETE — see the
    module docstring for why.
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "notifications_clear"

    def post(self, request):
        deleted, _ = Notification.objects.filter(
            user=request.user
        ).delete()
        return Response(
            {"deleted": deleted},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Unread count
# ─────────────────────────────────────────────────────────────────────────────
class NotificationUnreadCountView(APIView):
    """
    GET /api/v1/account/notifications/unread-count/

    Lightweight endpoint for the nav badge. Returns just the count —
    no serialization, no query beyond the aggregate. Polled periodically
    by the layout, so it needs to stay cheap.

    Routes through `services.unread_count()` so any future change to
    what "unread" means (e.g. excluding expired promos) lands in one
    place. The service does the exact same query, but the indirection
    is where the logic belongs.

    Response shape matches `lib/api.ts`:

        { unread: number }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"unread": unread_count(request.user)})