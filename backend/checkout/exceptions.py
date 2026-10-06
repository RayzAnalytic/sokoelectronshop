"""
checkout/exceptions.py

Every checkout error carries its own HTTP status code, so views can
map them uniformly:

    from .exceptions import CheckoutError

    try:
        ...
    except CheckoutError as exc:
        return Response(
            {"detail": str(exc)},
            status=exc.status_code,
        )

`CheckoutError` is the base — catching it alone covers every domain
error. Subclasses exist so views can add behaviour (e.g. a coupon
error might also clear a stale coupon from the client's state) without
parsing the message text.

Two exceptions in the original file — `CustomerExists` and
`PaymentStateError` — were removed because nothing in the current
codebase raises them. They belonged to an earlier design where
checkout required authentication and where `transition_payment`
raised on terminal states. The current design:

  * Allows guest checkout (any email at order time; claim happens
    later via `claim_guest_orders`).
  * Treats a transition on a terminal payment as a no-op with a
    warning log (`transition_payment` in services.py), not an error.
    Webhooks and the timeout sweep both race the same payment, and
    the second caller must not blow up.

If a future flow needs either behaviour, add the exception back with
a comment explaining who raises it.
"""


class CheckoutError(Exception):
    """
    Base for all checkout-domain errors.

    Views catch this as the last except clause and return `status_code`
    with `str(exc)` as the detail. Subclasses only override
    `status_code` and (optionally) provide a clearer log line.
    """

    status_code: int = 400


class PricingError(CheckoutError):
    """
    Client-declared totals do not match the server's recompute.

    Raised by `recompute_totals()` when any of subtotal, discount,
    shipping, tax, or total differs by even a cent. The client's
    numbers are treated as a claim to be verified, never as trusted
    input.
    """

    status_code = 400


class CouponError(CheckoutError):
    """
    Coupon is invalid, expired, deactivated, over its usage cap, or
    below its minimum order value.

    Raised by `validate_coupon()`. The specific reason is the message
    — the frontend surfaces it directly to the customer.
    """

    status_code = 400


class InvalidPhone(CheckoutError):
    """
    Phone number could not be normalized to Daraja's wire format.

    Raised by `mpesa.normalize_phone()` *before* any network call, so
    a bad phone never generates a Daraja request. The message carries
    the original input so a field-level error is possible.
    """

    status_code = 400


class MpesaError(CheckoutError):
    """
    Daraja returned an error or was unreachable.

    Raised by `mpesa.stk_push()` and `mpesa.query_status()` on:
      * Network failure
      * Non-200 HTTP response
      * Non-zero `ResponseCode` from Daraja (bad shortcode, wrong
        passkey, over-limit amount)
      * Missing `MerchantRequestID` / `CheckoutRequestID`

    Maps to 502 (Bad Gateway) because the failure is on the upstream
    service, not the customer's request. The frontend shows the
    message and offers "Try again" / "Change payment method".
    """

    status_code = 502