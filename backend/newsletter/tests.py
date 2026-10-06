from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Subscriber


# ─────────────────────────────────────────────────────────────
# Model-level tests
# ─────────────────────────────────────────────────────────────
class SubscriberModelTests(TestCase):
    def test_email_is_normalized_to_lowercase(self):
        sub = Subscriber.objects.create(email="  User@Example.COM  ")
        self.assertEqual(sub.email, "user@example.com")

    def test_email_is_unique(self):
        Subscriber.objects.create(email="a@example.com")
        with self.assertRaises(Exception):
            Subscriber.objects.create(email="a@example.com")

    def test_mark_unsubscribed_flips_flag_and_sets_timestamp(self):
        sub = Subscriber.objects.create(email="a@example.com")
        self.assertTrue(sub.is_active)
        self.assertIsNone(sub.unsubscribed_at)

        sub.mark_unsubscribed()
        sub.refresh_from_db()

        self.assertFalse(sub.is_active)
        self.assertIsNotNone(sub.unsubscribed_at)

    def test_mark_subscribed_reactivates(self):
        sub = Subscriber.objects.create(email="a@example.com", is_active=False)
        sub.mark_subscribed(source="checkout")
        sub.refresh_from_db()

        self.assertTrue(sub.is_active)
        self.assertIsNone(sub.unsubscribed_at)
        self.assertEqual(sub.source, "checkout")

    def test_unsubscribe_token_is_auto_generated(self):
        sub = Subscriber.objects.create(email="a@example.com")
        self.assertIsNotNone(sub.unsubscribe_token)

    def test_two_subscribers_have_different_tokens(self):
        a = Subscriber.objects.create(email="a@example.com")
        b = Subscriber.objects.create(email="b@example.com")
        self.assertNotEqual(a.unsubscribe_token, b.unsubscribe_token)


# ─────────────────────────────────────────────────────────────
# API tests
# ─────────────────────────────────────────────────────────────
class SubscribeViewTests(APITestCase):
    url = reverse("newsletter:subscribe")

    def test_new_subscription_returns_201(self):
        resp = self.client.post(self.url, {"email": "new@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], "subscribed")
        self.assertTrue(Subscriber.objects.filter(email="new@example.com").exists())

    def test_email_is_lowercased_and_trimmed(self):
        self.client.post(self.url, {"email": "  New@Example.COM "}, format="json")
        self.assertTrue(Subscriber.objects.filter(email="new@example.com").exists())

    def test_duplicate_email_returns_200_already_subscribed(self):
        Subscriber.objects.create(email="dup@example.com")
        resp = self.client.post(self.url, {"email": "dup@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "already_subscribed")
        self.assertEqual(Subscriber.objects.filter(email="dup@example.com").count(), 1)

    def test_reactivation_after_unsubscribe(self):
        sub = Subscriber.objects.create(email="back@example.com")
        sub.mark_unsubscribed()

        resp = self.client.post(self.url, {"email": "back@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "reactivated")

        sub.refresh_from_db()
        self.assertTrue(sub.is_active)
        self.assertIsNone(sub.unsubscribed_at)

    def test_invalid_email_returns_400(self):
        resp = self.client.post(self.url, {"email": "not-an-email"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", resp.data)

    def test_missing_email_returns_400(self):
        resp = self.client.post(self.url, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", resp.data)

    def test_blank_email_returns_400(self):
        resp = self.client.post(self.url, {"email": ""}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_source_is_captured(self):
        self.client.post(
            self.url,
            {"email": "src@example.com", "source": "checkout"},
            format="json",
        )
        sub = Subscriber.objects.get(email="src@example.com")
        self.assertEqual(sub.source, "checkout")

    def test_default_source_is_homepage(self):
        self.client.post(self.url, {"email": "d@example.com"}, format="json")
        sub = Subscriber.objects.get(email="d@example.com")
        self.assertEqual(sub.source, "homepage")


class UnsubscribeViewTests(APITestCase):
    url = reverse("newsletter:unsubscribe")

    def test_unsubscribe_by_email(self):
        Subscriber.objects.create(email="u@example.com")
        resp = self.client.post(self.url, {"email": "u@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        sub = Subscriber.objects.get(email="u@example.com")
        self.assertFalse(sub.is_active)

    def test_unsubscribe_by_token(self):
        sub = Subscriber.objects.create(email="t@example.com")
        resp = self.client.post(self.url, {"token": str(sub.unsubscribe_token)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        sub.refresh_from_db()
        self.assertFalse(sub.is_active)

    def test_unsubscribe_unknown_email_still_returns_200(self):
        resp = self.client.post(self.url, {"email": "ghost@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_unsubscribe_without_email_or_token_returns_400(self):
        resp = self.client.post(self.url, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unsubscribing_twice_is_idempotent(self):
        Subscriber.objects.create(email="twice@example.com")
        self.client.post(self.url, {"email": "twice@example.com"}, format="json")
        resp = self.client.post(self.url, {"email": "twice@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        sub = Subscriber.objects.get(email="twice@example.com")
        self.assertFalse(sub.is_active)