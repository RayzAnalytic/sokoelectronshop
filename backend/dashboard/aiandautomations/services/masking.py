"""Strip PII from data before sending to the LLM."""
import re

EMAIL_RE = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
PHONE_RE = re.compile(r'(?:\+?254|0)\d{9}\b')


def mask_text(text: str) -> str:
    if not text:
        return text
    text = EMAIL_RE.sub('[email]', text)
    text = PHONE_RE.sub('[phone]', text)
    return text


def mask_rows(rows):
    """Mask any string cell inside a list-of-lists or list-of-dicts."""
    if isinstance(rows, list):
        return [mask_rows(r) for r in rows]
    if isinstance(rows, dict):
        return {k: mask_rows(v) for k, v in rows.items()}
    if isinstance(rows, str):
        return mask_text(rows)
    return rows