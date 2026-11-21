from django.urls import path

from .views import InventoryViewSet, MovementListView

urlpatterns = [
    path(
        "",
        InventoryViewSet.as_view({"get": "list"}),
        name="inventory-list",
    ),
    path(
        "adjust/",
        InventoryViewSet.as_view({"post": "adjust"}),
        name="inventory-adjust",
    ),
    path(
        "adjust",
        InventoryViewSet.as_view({"post": "adjust"}),
        name="inventory-adjust-noslash",
    ),
    path(
        "movements/",
        MovementListView.as_view(),
        name="inventory-movements",
    ),
]