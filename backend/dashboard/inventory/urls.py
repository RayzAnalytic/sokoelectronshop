from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import InventoryViewSet, MovementListView

router = DefaultRouter()
router.register(r"", InventoryViewSet, basename="inventory")

urlpatterns = router.urls + [
    path("movements/", MovementListView.as_view(), name="inventory-movements"),
]