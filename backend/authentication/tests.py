"""
Tests for the authentication app.

Endpoints covered (adjust URLs if yours differ):
  POST /api/auth/register/
  POST /api/auth/login/
  POST /api/auth/logout/
  POST /api/auth/token/refresh/
  GET  /api/auth/me/
  POST /api/auth/password/reset/
  GET  /api/auth/password/reset/validate/
  POST /api/auth/password/reset/confirm/
"""
import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework.test import APIClient


User = get_user_model()
pytestmark = pytest.mark.django_db


# ============================================================
# HELPERS
# ============================================================

STRONG_PASSWORD = "TestPass!123"

REGISTER_PAYLOAD = {
    "fullName": "Test User",
    "email": "newuser@example.com",
    "phone": "+254700000000",
    "password": STRONG_PASSWORD,
    "confirmPassword": STRONG_PASSWORD,
    "termsAccepted": True,
}

LOGIN_PAYLOAD = {
    "email": "user@example.com",
    "password": "TestPass!123",
}


# ============================================================
# REGISTRATION
# ============================================================

class TestRegister:
    url = "/api/auth/register/"

    def test_register_succeeds(self, api):
        r = api.post(self.url, REGISTER_PAYLOAD, format="json")
        assert r.status_code in (200, 201), r.content
        body = r.json()
        # JWT pair returned
        assert "access" in body or "tokens" in body
        assert User.objects.filter(email="newuser@example.com").exists()

    def test_register_rejects_duplicate_email(self, api, user):
        payload = {**REGISTER_PAYLOAD, "email": user.email}
        r = api.post(self.url, payload, format="json")
        assert r.status_code == 400
        assert "email" in r.json()

    def test_register_rejects_password_mismatch(self, api):
        payload = {**REGISTER_PAYLOAD, "confirmPassword": "DifferentPass!9"}
        r = api.post(self.url, payload, format="json")
        assert r.status_code == 400

    def test_register_rejects_weak_password(self, api):
        payload = {**REGISTER_PAYLOAD, "password": "123", "confirmPassword": "123"}
        r = api.post(self.url, payload, format="json")
        assert r.status_code == 400

    def test_register_rejects_missing_email(self, api):
        payload = {k: v for k, v in REGISTER_PAYLOAD.items() if k != "email"}
        r = api.post(self.url, payload, format="json")
        assert r.status_code == 400

    def test_register_rejects_terms_not_accepted(self, api):
        payload = {**REGISTER_PAYLOAD, "termsAccepted": False}
        r = api.post(self.url, payload, format="json")
        # If your backend enforces this, expect 400. Otherwise delete this test.
        assert r.status_code == 400


# ============================================================
# LOGIN
# ============================================================

class TestLogin:
    url = "/api/auth/login/"

    def test_login_returns_tokens(self, api, user):
        r = api.post(self.url, LOGIN_PAYLOAD, format="json")
        assert r.status_code == 200, r.content
        body = r.json()
        assert "access" in body
        assert "refresh" in body
        assert body["user"]["email"] == user.email

    def test_login_wrong_password(self, api, user):
        r = api.post(
            self.url,
            {"email": user.email, "password": "wrong"},
            format="json",
        )
        assert r.status_code in (400, 401)

    def test_login_unknown_email(self, api):
        r = api.post(
            self.url,
            {"email": "nobody@example.com", "password": STRONG_PASSWORD},
            format="json",
        )
        assert r.status_code in (400, 401)

    def test_login_rejects_missing_fields(self, api):
        r = api.post(self.url, {}, format="json")
        assert r.status_code == 400


# ============================================================
# ME
# ============================================================

class TestMe:
    url = "/api/auth/me/"

    def test_me_requires_auth(self, api):
        r = api.get(self.url)
        assert r.status_code in (401, 403)

    def test_me_returns_profile(self, auth_api, user):
        r = auth_api.get(self.url)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == user.email
        # Never expose password hash
        assert "password" not in body


# ============================================================
# LOGOUT
# ============================================================

class TestLogout:
    url = "/api/auth/logout/"

    def test_logout_blacklists_refresh(self, api, user):
        login = api.post("/api/auth/login/", LOGIN_PAYLOAD, format="json").json()
        refresh = login["refresh"]

        r = api.post(self.url, {"refresh": refresh}, format="json")
        assert r.status_code in (200, 204)

        # Refresh token is now blacklisted
        second = api.post(
            "/api/auth/token/refresh/",
            {"refresh": refresh},
            format="json",
        )
        assert second.status_code == 401

    def test_logout_accepts_empty_body(self, api):
        # Depending on your impl, this may return 200, 204, or 400.
        # Adjust the assertion to your design.
        r = api.post(self.url, {}, format="json")
        assert r.status_code in (200, 204, 400)


# ============================================================
# JWT REFRESH
# ============================================================

class TestTokenRefresh:
    url = "/api/auth/token/refresh/"

    def test_refresh_returns_new_access(self, api, user):
        login = api.post("/api/auth/login/", LOGIN_PAYLOAD, format="json").json()
        r = api.post(self.url, {"refresh": login["refresh"]}, format="json")
        assert r.status_code == 200
        assert "access" in r.json()

    def test_refresh_rejects_garbage_token(self, api):
        r = api.post(self.url, {"refresh": "not.a.token"}, format="json")
        assert r.status_code == 401

    def test_refresh_rejects_empty_body(self, api):
        r = api.post(self.url, {}, format="json")
        assert r.status_code == 400


# ============================================================
# PASSWORD RESET
# ============================================================

@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class TestPasswordReset:

    def test_request_reset_sends_email(self, api, user):
        r = api.post(
            "/api/auth/password/reset/",
            {"email": user.email},
            format="json",
        )
        assert r.status_code == 200
        assert len(mail.outbox) == 1
        assert user.email in mail.outbox[0].to

    def test_request_reset_silent_on_unknown_email(self, api):
        # Do not reveal whether an email exists
        r = api.post(
            "/api/auth/password/reset/",
            {"email": "nobody@example.com"},
            format="json",
        )
        assert r.status_code == 200
        assert len(mail.outbox) == 0

    def test_reset_requires_valid_token(self, api):
        r = api.get(
            "/api/auth/password/reset/validate/?token=not-a-real-token",
        )
        assert r.status_code in (200, 400, 404)
        if r.status_code == 200:
            assert r.json().get("valid") is False


# ============================================================
# PASSWORD CHANGE (if you have it)
# ============================================================

class TestPasswordChange:

    def test_change_requires_auth(self, api):
        r = api.post(
            "/api/auth/password/change/",
            {"old_password": "x", "new_password": "y"},
            format="json",
        )
        assert r.status_code in (401, 403, 404)

    def test_change_with_wrong_old_password(self, auth_api):
        r = auth_api.post(
            "/api/auth/password/change/",
            {
                "old_password": "wrong",
                "new_password": "NewPass!456",
                "confirm_password": "NewPass!456",
            },
            format="json",
        )
        # If endpoint exists: 400. If not: 404.
        assert r.status_code in (400, 404)