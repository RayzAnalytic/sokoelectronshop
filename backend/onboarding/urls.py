# apps/onboarding/urls.py

from django.urls import path

from . import views

app_name = "onboarding"

urlpatterns = [
    # ── Session-level ──
    path("progress/", views.current_session, name="progress"),
    path("session/", views.current_session, name="current-session"),
    path("session/reset/", views.reset, name="reset-session"),

    # ── Step listing ──
    path("steps/", views.list_steps, name="list-steps"),

    # ── Step-specific actions (MUST come before the generic step route) ──
    path(
        "steps/<str:step_key>/etims-test/",
        views.test_etims,
        name="test-etims",
    ),
    path(
        "steps/<str:step_key>/test/",
        views.test_step4,
        name="test-step4",
    ),
    path(
        "steps/<str:step_key>/verify/",
        views.verify_whatsapp,
        name="verify-whatsapp",
    ),
    path(
        "steps/<str:step_key>/send-test/",
        views.send_whatsapp_test,
        name="send-whatsapp-test",
    ),

    # ── Generic step view (GET = detail, POST = submit) ──
    path(
        "steps/<str:step_key>/",
        views.step_view,
        name="step-view",
    ),
]