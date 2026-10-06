"""Symmetric encryption for provider API keys at rest.

Uses Fernet (AES-128-CBC + HMAC-SHA256) from the `cryptography` package.
The encryption key is derived deterministically from `settings.AI_KEY_ENC_KEY`
(falling back to `settings.SECRET_KEY`) so no extra secrets manager is needed.
"""

import base64
import hashlib

from django.conf import settings
from cryptography.fernet import Fernet


def _key() -> bytes:
    """Derive a valid Fernet key from the configured seed."""
    seed = getattr(settings, "AI_KEY_ENC_KEY", None) or settings.SECRET_KEY
    digest = hashlib.sha256(seed.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt(plain: str) -> str:
    """Encrypt a string. Returns '' for empty input."""
    if not plain:
        return ""
    return Fernet(_key()).encrypt(plain.encode()).decode()


def decrypt(cipher: str) -> str:
    """Decrypt a string. Returns '' if the token is invalid or tampered with."""
    if not cipher:
        return ""
    try:
        return Fernet(_key()).decrypt(cipher.encode()).decode()
    except Exception:
        return ""