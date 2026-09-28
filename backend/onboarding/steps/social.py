# apps/onboarding/steps/social.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


VALID_PLATFORMS = {"tiktok_shop", "instagram", "facebook", "youtube", "x"}

# Platforms that require seller approval before they can be connected.
GATED_PLATFORMS = {"tiktok_shop", "youtube"}


@StepRegistry.register
class SocialStep(BaseStep):
    key = "step9"
    optional = True

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        # Every field is optional. Only sanity-check the shape.
        connected = payload.get("connected_platforms")
        if connected is None:
            return
        if not isinstance(connected, list):
            raise ValidationError({
                "connected_platforms": "Must be a list of platform IDs."
            })
        invalid = [p for p in connected if p not in VALID_PLATFORMS]
        if invalid:
            raise ValidationError({
                "connected_platforms": f"Unknown platforms: {', '.join(invalid)}."
            })

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        connected_list = payload.get("connected_platforms") or []
        # Normalize + dedupe while preserving order
        seen = set()
        connected = []
        for p in connected_list:
            if p in VALID_PLATFORMS and p not in seen:
                connected.append(p)
                seen.add(p)

        return {
            "connected_platforms": connected,
            "skipped": len(connected) == 0,
        }

    # ── prefill / status ────────────────────────────────────
    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}

        # Pull real connection state from the social app if it exists.
        # If not, we fall back to the merchant's saved choice.
        live_accounts = self._load_live_accounts(session.user)

        platforms = []
        for pid in ["tiktok_shop", "instagram", "facebook", "youtube", "x"]:
            live = live_accounts.get(pid)
            platforms.append({
                "id": pid,
                "connected": bool(live),
                "username": (live or {}).get("username", ""),
                "connected_at": (live or {}).get("connected_at"),
                "gated": pid in GATED_PLATFORMS,
            })

        connected_count = sum(1 for p in platforms if p["connected"])

        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {
                "platforms": platforms,
                "connected_count": connected_count,
                "total_count": len(platforms),
                # Optional — include what the merchant chose to keep during onboarding
                "connected_platforms": stored.get("connected_platforms", []),
            },
        }

    # ── helpers ─────────────────────────────────────────────
    @staticmethod
    def _load_live_accounts(user) -> dict:
        """
        Return a dict of {platform_id: {username, connected_at}} by reading
        SocialAccount rows. If your project doesn't have such a model, this
        returns {} and the frontend shows everything as disconnected — which
        is fine because step 9 is optional.
        """
        accounts = {}
        try:
            # Try the common import path — adjust if yours differs.
            from social.models import SocialAccount  # type: ignore
        except Exception:
            return accounts

        qs = SocialAccount.objects.filter(user=user, is_active=True)
        for acc in qs:
            key = (getattr(acc, "platform", "") or "").lower()
            # Normalize platform codes like 'TIKTOK_SHOP' → 'tiktok_shop'
            key = key.lower()
            accounts[key] = {
                "username": getattr(acc, "username", "") or "",
                "connected_at": (
                    acc.connected_at.isoformat()
                    if getattr(acc, "connected_at", None)
                    else None
                ),
            }
        return accounts