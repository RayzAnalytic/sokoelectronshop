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


LIST_HARD_CAP = 500


class NotificationListView(APIView):
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


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = get_object_or_404(
            Notification, pk=pk, user=request.user
        )
        mark_notification_read(notification)
        return Response(NotificationSerializer(notification).data)


class NotificationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        Notification.objects.filter(pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = mark_all_read(request.user)
        return Response(
            {"updated": count},
            status=status.HTTP_200_OK,
        )


class NotificationClearView(APIView):
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


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"unread": unread_count(request.user)})