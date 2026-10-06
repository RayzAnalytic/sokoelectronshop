"""Symmetric encryption for provider API keys at rest."""

import base64
import hashlib

from django.conf import settings
from cryptography.fernet import Fernet


def _key() -> bytes:
    seed = getattr(settings, "AI_KEY_ENC_KEY", None) or settings.SECRET_KEY
    digest = hashlib.sha256(seed.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt(plain: str) -> str:
    if not plain:
        return ""
    return Fernet(_key()).encrypt(plain.encode()).decode()


def decrypt(cipher: str) -> str:
    if not cipher:
        return ""
    try:
        return Fernet(_key()).decrypt(cipher.encode()).decode()
    except Exception:
        return ""
