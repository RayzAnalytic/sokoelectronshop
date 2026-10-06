"""
Smoke tests for the customers module.

Covers the segment rules and the profile cache — the two things most
likely to drift when order or user models change.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from checkout.models import Order

from .constants import CustomerSegment
from .models import CustomerProfile
from . import selectors, services

User = get_user_model()


def make_customer(email="c@test.com", **kwargs):
    return User.objects.create_user(
        email=email,
        password="x",
        role="CUSTOMER",
        **kwargs,
    )


def make_order(user, total=10000, status=Order.Status.DELIVERED, days_ago=0):
    order = Order.objects.create(
        user=user,
        status=status,
        payment_status=Order.PaymentStatus.PAID,
        payment_method=Order.PaymentMethod.MPESA,
        delivery_method="standard",
        total=total,
        subtotal=total,
        tax=0,
        shipping=0,
        discount=0,
    )
    if days_ago:
        Order.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        order.refresh_from_db()
    return order


class ProfileBootstrapTests(TestCase):
    def test_profile_created_on_user_creation(self):
        u = make_customer()
        self.assertTrue(CustomerProfile.objects.filter(user=u).exists())


class SegmentRuleTests(TestCase):
    def test_new_customer_no_orders(self):
        u = make_customer()
        p = u.customer_profile
        p.refresh_stats()
        self.assertEqual(p.segment, CustomerSegment.NEW)

    def test_vip_by_spend(self):
        u = make_customer()
        for i in range(3):
            make_order(u, total=100_000, days_ago=i * 10)
        p = u.customer_profile
        p.refresh_stats()
        self.assertEqual(p.segment, CustomerSegment.VIP)

    def test_loyal_by_orders(self):
        u = make_customer()
        for i in range(3):
            make_order(u, total=20_000, days_ago=i * 10)
        p = u.customer_profile
        p.refresh_stats()
        self.assertEqual(p.segment, CustomerSegment.LOYAL)

    def test_at_risk(self):
        u = make_customer()
        make_order(u, total=10_000, days_ago=70)
        p = u.customer_profile
        p.refresh_stats()
        self.assertEqual(p.segment, CustomerSegment.AT_RISK)

    def test_churned(self):
        u = make_customer()
        make_order(u, total=10_000, days_ago=120)
        p = u.customer_profile
        p.refresh_stats()
        self.assertEqual(p.segment, CustomerSegment.CHURNED)


class ActionTests(TestCase):
    def test_block_and_unblock(self):
        u = make_customer()
        services.set_customer_status(u.pk, blocked=True)
        u.refresh_from_db()
        self.assertEqual(u.status, "SUSPENDED")

        services.set_customer_status(u.pk, blocked=False)
        u.refresh_from_db()
        self.assertEqual(u.status, "ACTIVE")

    def test_consent_subscribed(self):
        u = make_customer()
        services.set_marketing_consent(u.pk, "Subscribed")
        u.refresh_from_db()
        self.assertTrue(u.whatsapp_updates)
        self.assertTrue(u.email_promotions)
        self.assertTrue(u.sms_promotions)
        self.assertTrue(u.newsletter)

    def test_add_note(self):
        u = make_customer()
        note = services.add_note(user_id=u.pk, author_id=u.pk, text="Hello")
        self.assertEqual(note.text, "Hello")


class SelectorTests(TestCase):
    def test_search_filters(self):
        make_customer(email="alice@test.com", first_name="Alice")
        make_customer(email="bob@test.com", first_name="Bob")
        qs = selectors.list_customers(search="alice")
        self.assertEqual(qs.count(), 1)

    def test_stats(self):
        u = make_customer()
        make_order(u, total=50_000, days_ago=10)
        u.customer_profile.refresh_stats()
        stats = selectors.get_dashboard_stats()
        self.assertEqual(stats["total_customers"], 1)
        self.assertEqual(stats["total_revenue"], 50_000)