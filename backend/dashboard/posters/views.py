from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Poster
from .serializers import PosterSerializer


class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or user.is_superuser)
        )


class AdminPosterListCreateView(generics.ListCreateAPIView):
    serializer_class = PosterSerializer
    permission_classes = [IsStaff]
    pagination_class = None

    def get_queryset(self):
        qs = Poster.objects.all()
        placement = self.request.query_params.get("placement")
        if placement:
            qs = qs.filter(placement=placement)
        return qs


class AdminPosterDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Poster.objects.all()
    serializer_class = PosterSerializer
    permission_classes = [IsStaff]


class PublicPosterListView(generics.ListAPIView):
    serializer_class = PosterSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    pagination_class = None

    def get_queryset(self):
        qs = Poster.objects.filter(is_published=True)
        placement = self.request.query_params.get("placement")
        if placement:
            qs = qs.filter(placement=placement)
        return qs


class PosterTrackView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, pk, event):
        poster = get_object_or_404(Poster, pk=pk)
        if event == "impression":
            Poster.objects.filter(pk=poster.pk).update(
                impression_count=F("impression_count") + 1
            )
        elif event == "click":
            Poster.objects.filter(pk=poster.pk).update(
                click_count=F("click_count") + 1
            )
        else:
            return Response({"detail": "Unknown event"}, status=400)
        return Response({"ok": True})