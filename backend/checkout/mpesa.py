import base64
import logging
import re
import threading
import time
from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal, InvalidOperation

import requests
from django.conf import settings
from django.utils import timezone as django_timezone

from .exceptions import InvalidPhone, MpesaError


logger = logging.getLogger(__name__)


_session = requests.Session()


_token_cache = {"value": None, "expires_at": 0.0}
_token_lock = threading.Lock()


def _base_url() -> str:
    return settings.MPESA_BASE_URL


def get_access_token() -> str:
    now = time.time()
    if _token_cache["value"] and _token_cache["expires_at"] > now:
        return _token_cache["value"]

    with _token_lock:
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
        _token_cache["expires_at"] = now + max(expires_in - 60, 60)
        return token


def normalize_phone(raw: str) -> str:
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


_ACCOUNT_REF_MAX = 12


def _account_reference(reference: str) -> str:
    reference = (reference or "").strip()
    if not reference:
        return ""
    if len(reference) <= _ACCOUNT_REF_MAX:
        return reference
    return reference[-_ACCOUNT_REF_MAX:]


_TRANSACTION_DESC = "Order payment"[:13]


def _stk_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}".encode()
    return base64.b64encode(raw).decode()


def stk_push(phone: str, amount: int, reference: str) -> dict:
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


def query_status(checkout_request_id: str) -> dict:
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


def _safe_int(value, default: int = -1) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_decimal(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _safe_datetime(value) -> datetime | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        naive = datetime.strptime(raw, "%Y%m%d%H%M%S")
    except ValueError:
        return None
    nairobi = dt_timezone(timedelta(hours=3))
    return naive.replace(tzinfo=nairobi).astimezone(dt_timezone.utc)


def _normalize_callback_items(items: list) -> dict:
    out: dict = {}
    for entry in items or []:
        if not isinstance(entry, dict):
            continue
        name = entry.get("Name")
        if name:
            out[name] = entry.get("Value")
    return out


def _normalize_phone_from_callback(raw) -> str | None:
    if raw is None:
        return None
    try:
        return normalize_phone(str(raw))
    except InvalidPhone:
        digits = re.sub(r"\D", "", str(raw))
        return digits or None


def parse_callback(body: dict) -> dict:
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