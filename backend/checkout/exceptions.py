class CheckoutError(Exception):
    """Base for all checkout-domain errors. Views map these to 400/409/502."""


class PricingError(CheckoutError):
    """Client totals do not match server recompute."""


class CouponError(CheckoutError):
    """Coupon is invalid, expired, or over its usage cap."""


class CustomerExists(CheckoutError):
    """Email already registered and the supplied password did not match."""


class InvalidPhone(CheckoutError):
    """Phone number could not be normalized to the M-Pesa format."""


class MpesaError(CheckoutError):
    """Daraja returned an error or was unreachable."""


class PaymentStateError(CheckoutError):
    """Attempted an illegal transition on a terminal payment."""