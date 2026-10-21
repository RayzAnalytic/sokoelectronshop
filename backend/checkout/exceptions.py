class CheckoutError(Exception):
    status_code: int = 400


class PricingError(CheckoutError):
    status_code = 400


class CouponError(CheckoutError):
    status_code = 400


class InvalidPhone(CheckoutError):
    status_code = 400


class MpesaError(CheckoutError):
    status_code = 502