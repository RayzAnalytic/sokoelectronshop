# onboarding/urls.py

from django.urls import path

from onboarding.views import (
    # ── Meta ──
    OnboardingProgressView,
    OnboardingStepsMetaView,

    # ── Step 1: Account ──
    Step1AccountView,

    # ── Step 2: Store Profile ──
    Step2StoreView,

    # ── Step 3: Business & Tax ──
    Step3BusinessView,
    Step3ETimsTestView,

    # ── Step 4: Payments ──
    Step4PaymentsView,
    Step4TestConnectionView,

    # ── Step 5: WhatsApp ──
    Step5WhatsAppView,
    Step5VerifyWhatsAppView,
    Step5SendTestView,

    # ── Step 6: Shipping ──
    Step6ShippingView,

    # ── Step 7: First Categories ──
    Step7CategoriesView,

    # ── Step 8: First Products ──
    Step8ProductsView,

    # ── Step 9: Social Channels ──
    Step9SocialView,

    # ── Step 10: Theme ──
    Step10ThemeView,

    # ── Step 11: Team ──
    Step11TeamView,

    # ── Step 12: Finish ──
    Step12FinishView,
)

app_name = "onboarding"


urlpatterns = [
    # ─────────────────────────────────────────────────────
    # GLOBAL — progress + step metadata
    # ─────────────────────────────────────────────────────
    path("progress/", OnboardingProgressView.as_view(), name="progress"),
    path("steps/", OnboardingStepsMetaView.as_view(), name="steps-meta"),

    # ─────────────────────────────────────────────────────
    # STEP 1 — Account
    # ─────────────────────────────────────────────────────
    path("steps/1/", Step1AccountView.as_view(), name="step-1"),

    # ─────────────────────────────────────────────────────
    # STEP 2 — Store Profile
    # ─────────────────────────────────────────────────────
    path("steps/2/", Step2StoreView.as_view(), name="step-2"),

    # ─────────────────────────────────────────────────────
    # STEP 3 — Business & Tax
    # ─────────────────────────────────────────────────────
    path("steps/3/", Step3BusinessView.as_view(), name="step-3"),
    path(
        "steps/3/etims-test/",
        Step3ETimsTestView.as_view(),
        name="step-3-etims-test",
    ),

    # ─────────────────────────────────────────────────────
    # STEP 4 — Payments
    # ─────────────────────────────────────────────────────
    path("steps/4/", Step4PaymentsView.as_view(), name="step-4"),
    path(
        "steps/4/test/",
        Step4TestConnectionView.as_view(),
        name="step-4-test",
    ),

    # ─────────────────────────────────────────────────────
    # STEP 5 — WhatsApp
    # ─────────────────────────────────────────────────────
    path("steps/5/", Step5WhatsAppView.as_view(), name="step-5"),
    path(
        "steps/5/verify/",
        Step5VerifyWhatsAppView.as_view(),
        name="step-5-verify",
    ),
    path(
        "steps/5/send-test/",
        Step5SendTestView.as_view(),
        name="step-5-send-test",
    ),

    # ─────────────────────────────────────────────────────
    # STEP 6 — Shipping
    # ─────────────────────────────────────────────────────
    path("steps/6/", Step6ShippingView.as_view(), name="step-6"),

    # ─────────────────────────────────────────────────────
    # STEP 7 — First Categories
    # ─────────────────────────────────────────────────────
    path("steps/7/", Step7CategoriesView.as_view(), name="step-7"),

    # ─────────────────────────────────────────────────────
    # STEP 8 — First Products
    # ─────────────────────────────────────────────────────
    path("steps/8/", Step8ProductsView.as_view(), name="step-8"),

    # ─────────────────────────────────────────────────────
    # STEP 9 — Social Channels
    # ─────────────────────────────────────────────────────
    path("steps/9/", Step9SocialView.as_view(), name="step-9"),

    # ─────────────────────────────────────────────────────
    # STEP 10 — Theme
    # ─────────────────────────────────────────────────────
    path("steps/10/", Step10ThemeView.as_view(), name="step-10"),

    # ─────────────────────────────────────────────────────
    # STEP 11 — Team
    # ─────────────────────────────────────────────────────
    path("steps/11/", Step11TeamView.as_view(), name="step-11"),

    # ─────────────────────────────────────────────────────
    # STEP 12 — Finish
    # ─────────────────────────────────────────────────────
    path("steps/12/", Step12FinishView.as_view(), name="step-12"),
]