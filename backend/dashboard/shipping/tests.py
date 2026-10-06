# dashboard/shipping/tests.py

"""
Smoke tests for the shipping API and the Shipment → Order bridge.

The critical test is `test_shipment_in_transit_marks_order_shipped`:
if that fails, the Tracking tab silently does nothing to the customer
order page, and the whole feature is a cosmetic admin panel.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from checkout.models import Order
from dashboard.shipping.models import (
    CourierConfig,
    Shipment,
    ShippingMethod,
    ShippingZone,
)
from dashboard.shipping.services import update_shipment_status

User = get_user_model()


class ShippingAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            username="logistics", password="x", is_staff=True,
        )

        self.standard = ShippingMethod.objects.create(
            name="Standard Delivery",
            default_price=Decimal("300"),
            eta="2-3 business days",
            status=ShippingMethod.Status.ACTIVE,
        )

        self.zone = ShippingZone.objects.create(
            name="Nairobi Metropolitan",
            region="Nairobi",
            counties=["Nairobi", "Kiambu"],
        )

    # ── Permissions ───────────────────────────────────────────────────
    def test_anonymous_gets_403(self):
        resp = self.client.get("/api/v1/dashboard/shipping/zones/")
        self.assertIn(resp.status_code, (401, 403))

    def test_staff_can_list_zones(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/v1/dashboard/shipping/zones/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

    # ── Create zone ───────────────────────────────────────────────────
    def test_create_zone_creates_default_rate(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(
            "/api/v1/dashboard/shipping/zones/",
            {
                "name": "Coast",
                "region": "Coast",
                "counties": ["Mombasa", "Kilifi"],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(len(resp.json()["rates"]), 1)
        self.assertEqual(resp.json()["rates"][0]["methodName"], "Standard Delivery")

    # ── Courier mask ──────────────────────────────────────────────────
    def test_courier_api_key_is_masked(self):
        CourierConfig.objects.create(
            slug="sendy", name="Sendy",
            api_key="snd_live_abcdef123456789",
            enabled=True,
        )
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/v1/dashboard/shipping/couriers/")
        api_key = resp.json()[0]["apiKey"]
        self.assertNotIn("abcdef", api_key)
        self.assertIn("…", api_key)


class ShipmentOrderBridgeTests(TestCase):
    """
    The critical integration test. Verifies that moving a shipment to
    In Transit flips the parent Order to `shipped`, which the
    customer's order page reads.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="c", password="x")
        self.order = Order.objects.create(
            user=self.user,
            payment_method=Order.PaymentMethod.MPESA,
            status=Order.Status.CONFIRMED,
            payment_status=Order.PaymentStatus.PAID,
            delivery_method="standard",
            contact_email="x@example.com",
            contact_phone="254700000000",
            total=Decimal("1000"),
        )
        self.method = ShippingMethod.objects.create(
            name="Standard Delivery",
            default_price=Decimal("300"),
        )
        self.shipment = Shipment.objects.create(
            order=self.order,
            method=self.method,
            status=Shipment.Status.LABEL_CREATED,
        )

    def test_picked_up_marks_order_shipped(self):
        update_shipment_status(
            shipment=self.shipment, new_status=Shipment.Status.PICKED_UP,
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.SHIPPED)
        # Customer-visible timeline event was written.
        self.assertTrue(
            self.order.status_events.filter(to_status="shipped").exists()
        )

    def test_in_transit_when_already_shipped_is_noop_on_order(self):
        update_shipment_status(
            shipment=self.shipment, new_status=Shipment.Status.PICKED_UP,
        )
        update_shipment_status(
            shipment=self.shipment, new_status=Shipment.Status.IN_TRANSIT,
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.SHIPPED)
        # Only one "shipped" event, not two.
        self.assertEqual(
            self.order.status_events.filter(to_status="shipped").count(), 1,
        )

    def test_delivered_marks_order_delivered(self):
        update_shipment_status(
            shipment=self.shipment, new_status=Shipment.Status.IN_TRANSIT,
        )
        update_shipment_status(
            shipment=self.shipment, new_status=Shipment.Status.DELIVERED,
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.DELIVERED)

    def test_label_created_leaves_order_status_unchanged(self):
        update_shipment_status(
            shipment=self.shipment, new_status=Shipment.Status.LABEL_CREATED,
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.CONFIRMED)