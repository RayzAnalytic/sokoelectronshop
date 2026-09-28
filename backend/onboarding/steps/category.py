# apps/onboarding/steps/category.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


@StepRegistry.register
class CategoryStep(BaseStep):
    key = "step7"
    optional = False

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        errors = {}

        raw_categories = payload.get("categories")

        # Accept either:
        #   - a real list of dicts (JSON path)
        #   - a JSON-encoded string (multipart path — frontend sends JSON string)
        if isinstance(raw_categories, str):
            import json
            try:
                raw_categories = json.loads(raw_categories)
            except (ValueError, TypeError):
                raise ValidationError({
                    "categories": "Invalid categories payload."
                })

        if not isinstance(raw_categories, list) or len(raw_categories) == 0:
            raise ValidationError({
                "categories": "Add at least one category."
            })

        for i, c in enumerate(raw_categories):
            if not isinstance(c, dict):
                errors[f"categories[{i}]"] = "Invalid category."
                continue
            name = (c.get("name") or "").strip()
            if not name:
                errors[f"categories[{i}].name"] = "Category name is required."

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        import json
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        import os

        raw_categories = payload.get("categories")
        if isinstance(raw_categories, str):
            raw_categories = json.loads(raw_categories)

        created = []
        for i, c in enumerate(raw_categories):
            name = (c.get("name") or "").strip()
            slug = (c.get("slug") or name.lower().replace(" ", "-")).strip()

            image_url = self._store_image(session, i, payload)

            created.append({
                "name": name,
                "slug": slug,
                "description": (c.get("description") or "").strip(),
                "image": image_url,
            })

        return {"categories": created}

    # ── prefill ─────────────────────────────────────────────
    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}
        categories = stored.get("categories", []) if isinstance(stored, dict) else []

        # Frontend's Step7CategoryItem shape
        cats = [
            {
                "id": str(i + 1),
                "name": c.get("name", ""),
                "slug": c.get("slug", ""),
                "description": c.get("description", ""),
                "image": c.get("image") or None,
            }
            for i, c in enumerate(categories)
        ]

        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {"categories": cats},
        }

    # ── helpers ─────────────────────────────────────────────
    @staticmethod
    def _store_image(session, index: int, payload) -> str:
        """
        If the frontend sent an image for category at `index`, save it and
        return its URL. Otherwise return "".
        """
        image = None
        if hasattr(payload, "get"):
            image = payload.get(f"image_{index}")
        if image is None or not hasattr(image, "read"):
            return ""

        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        import os

        ext = os.path.splitext(getattr(image, "name", "image"))[1] or ".png"
        path = f"onboarding/{session.user_id}/category_{index}{ext}"
        if default_storage.exists(path):
            default_storage.delete(path)
        saved = default_storage.save(path, ContentFile(image.read()))
        try:
            return default_storage.url(saved)
        except Exception:
            return saved