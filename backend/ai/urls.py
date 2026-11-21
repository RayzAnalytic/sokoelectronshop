from django.urls import path

from .views import (
    ChatView,
    ChatSessionListView,
    ChatSessionDetailView,
    ChatSessionArchiveView,
)

app_name = "ai"

urlpatterns = [
    path("chat/", ChatView.as_view(), name="chat"),
    path("sessions/", ChatSessionListView.as_view(), name="session-list"),
    path(
        "sessions/<uuid:session_id>/",
        ChatSessionDetailView.as_view(),
        name="session-detail",
    ),
    path(
        "sessions/<uuid:session_id>/archive/",
        ChatSessionArchiveView.as_view(),
        name="session-archive",
    ),
]