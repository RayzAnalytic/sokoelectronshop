from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BannerAdminViewSet, BannerTrackView, HeroSlidesView

router = DefaultRouter()
router.register(r'admin/banners', BannerAdminViewSet, basename='banner')

urlpatterns = [
    # Admin CRUD + actions
    #   /api/v1/admin/banners/
    #   /api/v1/admin/banners/stats/
    #   /api/v1/admin/banners/{id}/toggle/
    #   /api/v1/admin/banners/{id}/duplicate/
    #   /api/v1/admin/banners/reset/
    path('', include(router.urls)),

    # Public hero feed — powers <Hero />
    #   /api/v1/banners/hero/
    path('banners/hero/', HeroSlidesView.as_view(), name='hero-slides'),

    # Public tracking pings
    #   /api/v1/banners/{id}/track/impression/
    #   /api/v1/banners/{id}/track/click/
    #   /api/v1/banners/{id}/track/conversion/
    path(
        'banners/<int:pk>/track/<str:event>/',
        BannerTrackView.as_view(),
        name='banner-track',
    ),
]