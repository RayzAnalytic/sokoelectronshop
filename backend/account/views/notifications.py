from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Notification
from ..serializers import NotificationSerializer


class NotificationListView(APIView):
    """
    GET    /api/v1/account/notifications/       → list all
    DELETE /api/v1/account/notifications/       → clear all
    """

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
        return Response(NotificationSerializer(qs, many=True).data)

    def delete(self, request):
        deleted, _ = Notification.objects.filter(user=request.user).delete()
        return Response({"deleted": deleted})


class NotificationDetailView(APIView):
    """
    PATCH  /api/v1/account/notifications/<pk>/  → mark one as read
    DELETE /api/v1/account/notifications/<pk>/  → delete one
    """

    def patch(self, request, pk):
        n = get_object_or_404(Notification, pk=pk, user=request.user)
        if not n.is_read:
            n.is_read = True
            n.read_at = timezone.now()
            n.save(update_fields=["is_read", "read_at"])
        return Response(NotificationSerializer(n).data)

    def delete(self, request, pk):
        get_object_or_404(Notification, pk=pk, user=request.user).delete()
        return Response(status=204)


class MarkAllReadView(APIView):
    """
    POST   /api/v1/account/notifications/read-all/  → mark all as read
    """

    def post(self, request):
        updated = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(
            is_read=True,
            read_at=timezone.now(),
        )
        return Response({"marked_read": updated})


class UnreadCountView(APIView):
    """
    GET    /api/v1/account/notifications/unread-count/  → bell badge count
    """

    def get(self, request):
        count = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).count()
        return Response({"unread": count})