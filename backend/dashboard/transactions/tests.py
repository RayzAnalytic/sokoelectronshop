# dashboard/transactions/tests.py

"""
Smoke tests for the ledger API. Extend per feature as you go.

Cover the four cases that matter for the first deploy:
    1. Unauthorized request → 403, before any query
    2. List returns every method, not just M-Pesa
    3. Summary totals agree with the list
    4. Retry on a successful payment → 400
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from checkout.models import Order, Payment

User = get_user_model()


class LedgerAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.staff = User.objects.create_user(
            username="finance", password="x", is_staff=True,
        )
        self.regular = User.objects.create_user(
            username="cust", password="x",
        )

        self.order = Order.objects.create(
            user=self.staff,
            payment_method=Order.PaymentMethod.MPESA,
            status=Order.Status.CONFIRMED,
            payment_status=Order.PaymentStatus.PAID,
            delivery_method="standard",
            contact_email="brian@example.com",
            contact_phone="254712345678",
            total=Decimal("1000.00"),
            snapshot={"full_name": "Brian Kiprop"},
        )

        self.success_payment = Payment.objects.create(
            order=self.order,
            method=Payment.Method.MPESA,
            status=Payment.Status.SUCCESS,
            amount=Decimal("1000.00"),
            fee=Decimal("57.00"),
            phone_number="254712345678",
            mpesa_receipt_number="MPX123",
            idempotency_key="k-success",
            settled_at=timezone.now(),
        )

        self.failed_payment = Payment.objects.create(
            order=self.order,
            method=Payment.Method.MPESA,
            status=Payment.Status.FAILED,
            amount=Decimal("500.00"),
            fee=Decimal("0.00"),
            phone_number="254711111111",
            result_code=1032,
            result_description="Request cancelled by user",
            idempotency_key="k-failed",
        )

    # ── Permission ────────────────────────────────────────────────
    def test_anonymous_gets_403(self):
        resp = self.client.get("/api/v1/dashboard/transactions/")
        self.assertIn(resp.status_code, (401, 403))

    def test_regular_user_gets_403(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.get("/api/v1/dashboard/transactions/")
        self.assertEqual(resp.status_code, 403)

    def test_staff_user_can_list(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/v1/dashboard/transactions/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 2)

    # ── Row shape ─────────────────────────────────────────────────
    def test_row_has_frontend_field_names(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/v1/dashboard/transactions/")
        row = next(r for r in resp.json() if r["id"] == str(self.success_payment.id))
        for key in (
            "ref", "orderNumber", "amount", "fee", "phoneNumber",
            "status", "responseCode", "responseDesc", "date",
            "customerName", "customerEmail", "merchantRequestId",
            "checkoutRequestId", "payload", "timeline",
        ):
            self.assertIn(key, row)

    def test_response_code_is_string(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/v1/dashboard/transactions/")
        failed = next(r for r in resp.json() if r["id"] == str(self.failed_payment.id))
        self.assertEqual(failed["responseCode"], "1032")
        self.assertEqual(failed["status"], "Failed")

    # ── Summary ───────────────────────────────────────────────────
    def test_summary_matches_list(self):
        self.client.force_authenticate(user=self.staff)
        summary = self.client.get("/api/v1/dashboard/transactions/summary/").json()
        self.assertEqual(summary["transactionCount"], 2)
        self.assertEqual(Decimal(summary["totalSuccessful"]), Decimal("1000.00"))
        self.assertEqual(Decimal(summary["totalFailed"]), Decimal("500.00"))

    # ── Retry ─────────────────────────────────────────────────────
    def test_retry_on_successful_payment_fails(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(
            f"/api/v1/dashboard/transactions/{self.success_payment.id}/retry/",
            {},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "checkout_error")

    # ── Reconcile ─────────────────────────────────────────────────
    def test_reconcile_writes_audit_row(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(
            f"/api/v1/dashboard/transactions/{self.failed_payment.id}/reconcile/",
            {"status": "Unmatched", "note": "No matching order"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.failed_payment.refresh_from_db()
        self.assertEqual(self.failed_payment.reconciliations.count(), 1)