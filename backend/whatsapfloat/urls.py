from django.urls import path
from .views import WhatsAppConfigView

app_name = 'whatsapfloat'

urlpatterns = [
    # Note: the URL path is still `/whatsapp/` because the frontend
    # calls `/api/whatsapp/config/`. Only the Django app is named
    # `whatsapfloat`. If you ever want to rename the URL too, update
    # `whatsappApi.config()` in lib/api.ts as well.
    path('whatsapp/config/', WhatsAppConfigView.as_view(), name='config'),
]