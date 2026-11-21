from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BannerAdminViewSet, BannerTrackView, HeroSlidesView

router = DefaultRouter()
router.register(r'admin/banners', BannerAdminViewSet, basename='banner')

urlpatterns = [
    path('', include(router.urls)),
    path('banners/hero/', HeroSlidesView.as_view(), name='hero-slides'),
    path(
        'banners/<int:pk>/track/<str:event>/',
        BannerTrackView.as_view(),
        name='banner-track',
    ),
]