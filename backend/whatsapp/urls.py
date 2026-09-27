from django.urls import path
from .views import WhatsAppWebhookView, SendWhatsAppView

urlpatterns = [
    path("webhook/", WhatsAppWebhookView.as_view(), name="whatsapp-webhook"),
    path("send/", SendWhatsAppView.as_view(), name="whatsapp-send"),
]