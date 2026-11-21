from django.urls import path

from .views import (
    AdminPosterDetailView,
    AdminPosterListCreateView,
    PosterTrackView,
    PublicPosterListView,
)

urlpatterns = [
    path(
        "admin/posters/",
        AdminPosterListCreateView.as_view(),
        name="admin-posters-list",
    ),
    path(
        "admin/posters/<int:pk>/",
        AdminPosterDetailView.as_view(),
        name="admin-posters-detail",
    ),
    path("posters/", PublicPosterListView.as_view(), name="posters-list"),
    path(
        "posters/<int:pk>/track/<str:event>/",
        PosterTrackView.as_view(),
        name="posters-track",
    ),
]