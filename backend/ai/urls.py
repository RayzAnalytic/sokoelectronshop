from django.urls import path

from .views import ChatView

app_name = "ai"

urlpatterns = [
    path("chat/", ChatView.as_view(), name="chat"),
]