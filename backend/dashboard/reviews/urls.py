from rest_framework.routers import DefaultRouter

from .views import ReviewModerationViewSet

router = DefaultRouter()
router.register(r"", ReviewModerationViewSet, basename="admin-reviews")

urlpatterns = router.urls