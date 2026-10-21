from django.urls import path

from .views import WhatsAppConfigView

app_name = 'whatsapfloat'

urlpatterns = [
    path('whatsapp/config/', WhatsAppConfigView.as_view(), name='config'),
]