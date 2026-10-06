"""
Thin Daraja (M-Pesa) client. Stateless — no DB, no Django models.

This module knows nothing about checkout's order/guest/user logic. It
only speaks to Safaricom. That separation is deliberate and worth
preserving: any change to the customer-facing flow leaves this file
untouched.

Checkout accepts BOTH guest and authenticated customers. This client
does not care — it receives a phone number, an amount, and a
reference, and returns a Daraja transaction ID. Whether the eventual
Order has a `user` attached or not is decided higher up.

Contract for callers:
    normalize_phone(raw)                    -> "2547XXXXXXXX"
    stk_push(phone, amount, reference)      -> { merchant_request_id, checkout_request_id }
    query_status(checkout_request_id)       -> raw Daraja JSON (see parse_query_result)
    parse_callback(body)                    -> normalised dict, see below
    parse_query_result(body)                -> same shape as parse_callback

The two `parse_*` helpers exist so the views and the reconciliation task
have a single contract regardless of which Daraja endpoint produced the
data. Both return:

    {
      merchant_request_id: str,
      checkout_request_id: str,
      result_code: int,             # -1 when Daraja omitted it (still processing)
      result_description: str,
      receipt: str,                 # "" when absent
      amount: Decimal | None,
      phone: str | None,            # normalised to 2547XXXXXXXX
      transaction_date: datetime | None,   # tz-aware
    }

`result_code` is Safaricom's own numbering — `0` means success, any
other value is a failure with a documented meaning (1032 cancelled by
user, 1037 timeout unreachable, 1 insufficient balance, etc.). Callers
treat `result_code == 0` as the success predicate.
"""

import base64
import logging
import re
import threading
import time
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal, InvalidOperation

import requests
from django.conf import settings
from django.utils import timezone as django_timezone

from .exceptions import InvalidPhone, MpesaError


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# HTTP session
#
# A module-level Session reuses TCP connections across calls. Under
# production load (checkout bursts, reconciliation sweeps), this saves
# a TLS handshake per request. A Session is thread-safe for concurrent
# `requests` use — the underlying urllib3 PoolManager handles
# connection checkout/return atomically.
#
# Note for pre-forked WSGI workers: the session is created at import
# time and inherited by child processes. urllib3 pools do not share
# sockets across forks, so each child opens its own connections on
# first use. No leak, no cross-process interference.
# ─────────────────────────────────────────────────────────────────────────────
_session = requests.Session()


# ─────────────────────────────────────────────────────────────────────────────
# Token cache
#
# Guarded by a lock so a burst of concurrent requests within the same
# worker does not fire N simultaneous OAuth calls to Daraja. Daraja
# rate-limits the OAuth endpoint, and a thundering herd of 50 refreshes
# produces real 429s.
#
# The lock is per-process. Multi-worker deployments still converge via
# the cache once each worker has refreshed once — they won't all fire
# in the same instant, but they also won't all fire on every request.
# ─────────────────────────────────────────────────────────────────────────────
_token_cache = {"value": None, "expires_at": 0.0}
_token_lock = threading.Lock()


def _base_url() -> str:
    return settings.MPESA_BASE_URL


def get_access_token() -> str:
    """
    Fetch (or return cached) OAuth token. Cached for ~55 min.

    Uses double-checked locking: the fast path (cache hit) takes no
    lock at all, so the common case stays fast. Only a miss acquires
    the lock and re-checks — so a burst of concurrent requests
    produces exactly one OAuth call, and the rest wait for the winner's
    result.
    """
    now = time.time()
    # Fast path — cache hit, no lock.
    if _token_cache["value"] and _token_cache["expires_at"] > now:
        return _token_cache["value"]

    with _token_lock:
        # Re-check inside the lock: another thread may have refreshed
        # between our first check and acquiring the lock.
        now = time.time()
        if _token_cache["value"] and _token_cache["expires_at"] > now:
            return _token_cache["value"]

        consumer_key = settings.MPESA_CONSUMER_KEY
        consumer_secret = settings.MPESA_CONSUMER_SECRET
        if not consumer_key or not consumer_secret:
            raise MpesaError("M-Pesa consumer credentials are not configured.")

        url = f"{_base_url()}/oauth/v1/generate?grant_type=client_credentials"
        auth = base64.b64encode(
            f"{consumer_key}:{consumer_secret}".encode()
        ).decode()

        try:
            resp = _session.get(
                url,
                headers={"Authorization": f"Basic {auth}"},
                timeout=15,
            )
        except requests.RequestException as exc:
            raise MpesaError(f"Could not reach Daraja auth: {exc}") from exc

        if resp.status_code != 200:
            raise MpesaError(
                f"Daraja auth failed ({resp.status_code}): {resp.text[:200]}"
            )

        data = resp.json()
        token = data.get("access_token")
        expires_in = int(data.get("expires_in", 3599))
        if not token:
            raise MpesaError("Daraja auth returned no access_token.")

        _token_cache["value"] = token
        # Subtract 60 s as a safety margin so we never fire a request
        # with a token that expires mid-flight.
        _token_cache["expires_at"] = now + max(expires_in - 60, 60)
        return token


# ─────────────────────────────────────────────────────────────────────────────
# Phone normalisation
# ─────────────────────────────────────────────────────────────────────────────
def normalize_phone(raw: str) -> str:
    """
    Normalise a Kenyan mobile number to Daraja's expected wire format.

    Accepted inputs and their normalised outputs:
        0712345678      -> 254712345678
        +254712345678   -> 254712345678
        254712345678    -> 254712345678
        712345678       -> 254712345678
        0112345678      -> 254112345678   (Safaricom 011 range)

    Anything that doesn't reduce to a valid KE mobile prefix raises
    `InvalidPhone` with the original input so the caller can surface a
    field-level error.
    """
    if not raw:
        raise InvalidPhone("Phone number is required.")
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("254"):
        pass
    elif digits.startswith("0"):
        digits = "254" + digits[1:]
    elif digits.startswith(("7", "1")):
        digits = "254" + digits
    else:
        raise InvalidPhone(f"Cannot interpret phone number: {raw}")

    if not re.fullmatch(r"254(7\d{8}|1\d{8})", digits):
        raise InvalidPhone(f"Invalid M-Pesa phone number: {raw}")
    return digits


# ─────────────────────────────────────────────────────────────────────────────
# Reference → AccountReference
#
# Daraja caps AccountReference at 12 chars. The reference format is
# "ORD-YYYYMMDD-XXXXXXXX" (21 chars), so a naive [:12] drops the random
# suffix entirely and every same-day order shares one value in the
# customer's M-Pesa SMS.
#
# Taking the LAST 12 chars gives "MMDD-XXXXXXXX" (the tail of the date
# group plus the 8-char random), e.g. "0101-3F9A2C1D". That keeps month,
# day, and per-order uniqueness. `_ACCOUNT_REF_MAX` is a named constant
# so the intent isn't a magic 12 in the middle of the function.
# ─────────────────────────────────────────────────────────────────────────────
_ACCOUNT_REF_MAX = 12


def _account_reference(reference: str) -> str:
    reference = (reference or "").strip()
    if not reference:
        return ""
    if len(reference) <= _ACCOUNT_REF_MAX:
        return reference
    return reference[-_ACCOUNT_REF_MAX:]


# Daraja also caps TransactionDesc at 13 chars. There's no useful
# information to cram in 13 chars beyond the fact that it's an order
# payment, so use a fixed label. The reference lives in AccountReference.
_TRANSACTION_DESC = "Order payment"[:13]


# ─────────────────────────────────────────────────────────────────────────────
# STK push
# ─────────────────────────────────────────────────────────────────────────────
def _stk_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}".encode()
    return base64.b64encode(raw).decode()


def stk_push(phone: str, amount: int, reference: str) -> dict:
    """
    Fire an STK push. Returns `{merchant_request_id, checkout_request_id}`.

    Raises `InvalidPhone` for a bad number (before any network call) and
    `MpesaError` for any other failure — misconfigured settings,
    network trouble, a non-zero `ResponseCode` from Daraja, or a
    response missing the two request IDs.

    Amount is validated against the Daraja-safe ceiling
    (`constants.MAX_STK_PUSH_AMOUNT`) before any network I/O. The
    serializer checks this too, but a defence-in-depth check here
    means direct callers (admin actions, CLI scripts, reconciliation
    tools) can't accidentally fire an over-limit push.

    Does NOT retry. Safaricom deduplicates on the STK password, which
    is derived from a timestamp; retrying within the same second would
    produce a duplicate prompt on the customer's phone. The view layer
    handles retries by generating a fresh idempotency key.
    """
    # Local import — constants imports nothing from mpesa, but keeping
    # this local avoids any future circular-import surprise.
    from . import constants

    phone = normalize_phone(phone)

    if amount < 1:
        raise MpesaError("Amount must be at least 1 KES.")
    if amount > constants.MAX_STK_PUSH_AMOUNT:
        raise MpesaError(
            f"Amount exceeds M-Pesa single-transaction limit "
            f"({constants.MAX_STK_PUSH_AMOUNT} KES)."
        )

    shortcode = settings.MPESA_SHORTCODE
    passkey = settings.MPESA_PASSKEY
    callback = settings.MPESA_CALLBACK_URL
    tx_type = settings.MPESA_TRANSACTION_TYPE

    if not all([shortcode, passkey, callback]):
        raise MpesaError("M-Pesa settings are incomplete.")

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = _stk_password(shortcode, passkey, timestamp)

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": tx_type,
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback,
        "AccountReference": _account_reference(reference),
        "TransactionDesc": _TRANSACTION_DESC,
    }

    token = get_access_token()
    url = f"{_base_url()}/mpesa/stkpush/v1/processrequest"

    try:
        resp = _session.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        logger.error(
            "Daraja STK push network error: ref=%s phone=%s***: %s",
            reference, phone[:6], exc,
        )
        raise MpesaError(f"Daraja STK push failed: {exc}") from exc

    if resp.status_code != 200:
        logger.error(
            "Daraja STK push HTTP %s: ref=%s phone=%s*** body=%s",
            resp.status_code, reference, phone[:6], resp.text[:300],
        )
        raise MpesaError(
            f"Daraja STK push error ({resp.status_code}): {resp.text[:300]}"
        )

    data = resp.json()
    response_code = str(data.get("ResponseCode", ""))
    if response_code != "0":
        message = (
            data.get("errorMessage")
            or data.get("ResponseDescription")
            or "Daraja rejected the STK push."
        )
        logger.warning(
            "Daraja rejected STK push: ref=%s code=%s msg=%s",
            reference, response_code, message,
        )
        raise MpesaError(message)

    merchant_request_id = data.get("MerchantRequestID")
    checkout_request_id = data.get("CheckoutRequestID")
    if not merchant_request_id or not checkout_request_id:
        raise MpesaError(
            "Daraja response missing MerchantRequestID / CheckoutRequestID."
        )

    logger.info(
        "Daraja STK push accepted: ref=%s mri=%s cri=%s",
        reference, merchant_request_id, checkout_request_id,
    )

    return {
        "merchant_request_id": merchant_request_id,
        "checkout_request_id": checkout_request_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Query status (reconciliation)
# ─────────────────────────────────────────────────────────────────────────────
def query_status(checkout_request_id: str) -> dict:
    """
    Query Daraja for the state of a checkout request.

    Returns the raw Daraja JSON — the caller passes it through
    `parse_query_result` to get the same shape as a callback body.

    The raw return is deliberate: if the query itself fails (bad
    password, unknown checkout ID), the response body carries the
    reason and the reconciliation task wants to log it. Throwing away
    that detail by pre-parsing would make diagnosis harder.

    Does NOT check `ResponseCode` — that field is "did Daraja accept
    the query", not "did the transaction succeed". The transaction
    result lives in `ResultCode`, handled by `parse_query_result`.
    """
    shortcode = settings.MPESA_SHORTCODE
    passkey = settings.MPESA_PASSKEY
    if not shortcode or not passkey:
        raise MpesaError("M-Pesa settings are incomplete.")

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = _stk_password(shortcode, passkey, timestamp)

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id,
    }

    token = get_access_token()
    url = f"{_base_url()}/mpesa/stkpushquery/v1/query"

    try:
        resp = _session.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise MpesaError(f"Daraja query failed: {exc}") from exc

    if resp.status_code != 200:
        raise MpesaError(
            f"Daraja query error ({resp.status_code}): {resp.text[:300]}"
        )

    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# Callback parsing
# ─────────────────────────────────────────────────────────────────────────────
def _safe_int(value, default: int = -1) -> int:
    """
    Safaricom sometimes sends numbers as strings, sometimes as null.
    `-1` means "no result code provided" — distinct from any real code,
    including `1` (insufficient balance).
    """
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_decimal(value) -> Decimal | None:
    """
    Parse a money-ish value to Decimal. Returns None on anything
    unparseable, so the caller can treat it as "no amount provided"
    rather than propagating a bogus number.
    """
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _safe_datetime(value) -> datetime | None:
    """
    Parse Daraja's `YYYYMMDDHHMMSS` int or string into a tz-AWARE
    datetime.

    Daraja returns local Kenyan time with no offset. Africa/Nairobi is
    UTC+3 with no DST, so the value is interpretable — we attach the
    Nairobi offset and convert to UTC so it compares cleanly against
    `django.utils.timezone.now()` and any stored `DateTimeField`.

    Without this, the naive datetime would raise `TypeError` on any
    comparison to an aware value elsewhere in the pipeline.
    """
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        naive = datetime.strptime(raw, "%Y%m%d%H%M%S")
    except ValueError:
        return None
    # Nairobi is UTC+3 year-round. Attach that offset and convert.
    nairobi = dt_timezone(timedelta(hours=3))
    return naive.replace(tzinfo=nairobi).astimezone(dt_timezone.utc)


def _normalize_callback_items(items: list) -> dict:
    """Turn Daraja's `[{"Name": …, "Value": …}, …]` into a plain dict."""
    out: dict = {}
    for entry in items or []:
        if not isinstance(entry, dict):
            continue
        name = entry.get("Name")
        if name:
            out[name] = entry.get("Value")
    return out


def _normalize_phone_from_callback(raw) -> str | None:
    """
    Best-effort normalisation of the phone number Safaricom echoes back.

    Safaricom usually sends `2547XXXXXXXX` already, but we run it
    through `normalize_phone` anyway so the caller sees one format
    regardless. If the value is unparseable (unexpected format), we
    return the raw digits rather than None — logging the anomaly is
    more useful than silently dropping data.
    """
    if raw is None:
        return None
    try:
        return normalize_phone(str(raw))
    except InvalidPhone:
        digits = re.sub(r"\D", "", str(raw))
        return digits or None


def parse_callback(body: dict) -> dict:
    """
    Normalise a Safaricom callback body.

    Returns a flat dict with a stable shape. See the module docstring.

    Raises `MpesaError` if the top-level envelope is missing — that's
    the one failure mode where a caller should log and drop the
    callback rather than try to reconcile. Everything below that level
    is tolerated: a missing `CallbackMetadata` (as happens on a failed
    payment) yields `receipt=""`, `amount=None`, `phone=None`.

    A failed payment still has a valid `result_code` and
    `result_description`, which is what `transition_payment(FAILED)`
    stores.
    """
    try:
        stk = body["Body"]["stkCallback"]
    except (KeyError, TypeError) as exc:
        raise MpesaError("Malformed callback: missing Body.stkCallback") from exc

    result_code = _safe_int(stk.get("ResultCode"), default=-1)
    result_description = stk.get("ResultDesc") or ""

    metadata = stk.get("CallbackMetadata") or {}
    items = metadata.get("Item") or []
    by_name = _normalize_callback_items(items)

    return {
        "merchant_request_id": stk.get("MerchantRequestID") or "",
        "checkout_request_id": stk.get("CheckoutRequestID") or "",
        "result_code": result_code,
        "result_description": result_description,
        "receipt": by_name.get("MpesaReceiptNumber") or "",
        "amount": _safe_decimal(by_name.get("Amount")),
        "phone": _normalize_phone_from_callback(by_name.get("PhoneNumber")),
        "transaction_date": _safe_datetime(by_name.get("TransactionDate")),
    }


def parse_query_result(body: dict) -> dict:
    """
    Normalise the response from `/mpesa/stkpushquery/v1/query`.

    That endpoint returns a shape closer to the STK push response than
    to the callback:

        {
          "ResponseCode": "0",
          "ResponseDescription": "The service request has been accepted successfully",
          "MerchantRequestID": "...",
          "CheckoutRequestID": "...",
          "ResultCode": "1037",           # present once the request terminates
          "ResultDesc": "DS timeout user cannot be reached"
        }

    The normaliser maps this onto the same contract as `parse_callback`
    so callers can treat both sources identically.

    Two edge cases worth knowing about:

      * Before the transaction terminates, Daraja omits `ResultCode`
        entirely. `_safe_int` returns `-1`, which no real Safaricom code
        uses. Callers checking `result_code == 0` treat this as "still
        pending", which is what the reconciliation loop wants.

      * A query-level failure (bad password, unknown checkout ID) puts
        the reason in `ResponseDescription` and leaves `ResultCode`
        absent. Falling back to `ResponseDescription` for the
        description means the log message still carries the reason,
        even though we can't distinguish it from a real result code by
        number alone.
    """
    return {
        "merchant_request_id": body.get("MerchantRequestID") or "",
        "checkout_request_id": body.get("CheckoutRequestID") or "",
        "result_code": _safe_int(body.get("ResultCode"), default=-1),
        "result_description": (
            body.get("ResultDesc")
            or body.get("ResponseDescription")
            or ""
        ),
        "receipt": "",
        "amount": None,
        "phone": None,
        "transaction_date": None,
    }