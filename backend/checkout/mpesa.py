"""Thin Daraja (M-Pesa) client. Stateless — no DB, no Django models."""

import base64
import logging
import re
import time
from datetime import datetime

import requests
from django.conf import settings

from .exceptions import InvalidPhone, MpesaError

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Token cache (module-level; the worker restarts will refetch)
# ─────────────────────────────────────────────────────────────────────────────
_token_cache = {"value": None, "expires_at": 0.0}


def _base_url() -> str:
    return settings.MPESA_BASE_URL


def get_access_token() -> str:
    """Fetch (or return cached) OAuth token. Cached for ~55 min."""
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
        resp = requests.get(
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
    _token_cache["expires_at"] = now + max(expires_in - 60, 60)
    return token


# ─────────────────────────────────────────────────────────────────────────────
# Phone normalisation
# ─────────────────────────────────────────────────────────────────────────────
def normalize_phone(raw: str) -> str:
    """07XX... / +2547XX... / 2547XX... → 2547XXXXXXXX (or 2541XXXXXXXX)."""
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
# STK push
# ─────────────────────────────────────────────────────────────────────────────
def _stk_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}".encode()
    return base64.b64encode(raw).decode()


def stk_push(phone: str, amount: int, reference: str) -> dict:
    """Fire STK push. Returns {merchant_request_id, checkout_request_id}."""
    phone = normalize_phone(phone)
    if amount < 1:
        raise MpesaError("Amount must be at least 1 KES.")

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
        "AccountReference": reference[:12],  # Daraja limits this
        "TransactionDesc": f"Order {reference}"[:13],
    }

    token = get_access_token()
    url = f"{_base_url()}/mpesa/stkpush/v1/processrequest"

    try:
        resp = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise MpesaError(f"Daraja STK push failed: {exc}") from exc

    if resp.status_code != 200:
        raise MpesaError(
            f"Daraja STK push error ({resp.status_code}): {resp.text[:300]}"
        )

    data = resp.json()
    if str(data.get("ResponseCode")) != "0":
        raise MpesaError(
            data.get("errorMessage")
            or data.get("ResponseDescription")
            or "Daraja rejected the STK push."
        )

    merchant_request_id = data.get("MerchantRequestID")
    checkout_request_id = data.get("CheckoutRequestID")
    if not merchant_request_id or not checkout_request_id:
        raise MpesaError(
            "Daraja response missing MerchantRequestID / CheckoutRequestID."
        )

    return {
        "merchant_request_id": merchant_request_id,
        "checkout_request_id": checkout_request_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Query status
# ─────────────────────────────────────────────────────────────────────────────
def query_status(checkout_request_id: str) -> dict:
    """Query Daraja for the state of a checkout request. Used by reconciliation."""
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
        resp = requests.post(
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
def parse_callback(body: dict) -> dict:
    """Normalise a Safaricom callback body into a flat dict.

    Returns:
        {
          "merchant_request_id": str,
          "checkout_request_id": str,
          "result_code": int,
          "result_description": str,
          "receipt": str,
          "amount": float | None,
          "phone": str | None,
          "transaction_date": str | None,
        }
    """
    try:
        stk = body["Body"]["stkCallback"]
    except (KeyError, TypeError) as exc:
        raise MpesaError("Malformed callback: missing Body.stkCallback") from exc

    result_code = int(stk.get("ResultCode", -1))
    result_description = stk.get("ResultDesc", "") or ""

    metadata = stk.get("CallbackMetadata") or {}
    items = metadata.get("Item") or []
    by_name = {i.get("Name"): i.get("Value") for i in items if "Name" in i}

    return {
        "merchant_request_id": stk.get("MerchantRequestID", "") or "",
        "checkout_request_id": stk.get("CheckoutRequestID", "") or "",
        "result_code": result_code,
        "result_description": result_description,
        "receipt": by_name.get("MpesaReceiptNumber") or "",
        "amount": by_name.get("Amount"),
        "phone": by_name.get("PhoneNumber"),
        "transaction_date": by_name.get("TransactionDate"),
    }