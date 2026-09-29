from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from checkout.exceptions import CouponError
from checkout.models import Coupon
from checkout.services import validate_coupon


class CouponTests(TestCase):
    def setUp(self):
        self.coupon = Coupon.objects.create(
            code="SPRING10",
            percent_off=Decimal("0.10"),
            active=True,
        )

    def test_valid_coupon(self):
        result = validate_coupon("spring10", Decimal("2000"))
        self.assertEqual(result.code, "SPRING10")

    def test_invalid_code(self):
        with self.assertRaises(CouponError):
            validate_coupon("NOPE", Decimal("2000"))

    def test_expired(self):
        self.coupon.valid_to = timezone.now() - timezone.timedelta(days=1)
        self.coupon.save()
        with self.assertRaises(CouponError):
            validate_coupon("SPRING10", Decimal("2000"))

    def test_max_uses(self):
        self.coupon.max_uses = 1
        self.coupon.used_count = 1
        self.coupon.save()
        with self.assertRaises(CouponError):
            validate_coupon("SPRING10", Decimal("2000"))