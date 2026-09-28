# apps/onboarding/steps/product.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


MAX_IMAGES_PER_PRODUCT = 3


@StepRegistry.register
class ProductStep(BaseStep):
    key = "step8"
    optional = False

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        import json

        raw = payload.get("products")
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (ValueError, TypeError):
                raise ValidationError({"products": "Invalid products payload."})

        if not isinstance(raw, list) or len(raw) == 0:
            raise ValidationError({"products": "Add at least one product."})

        errors = {}
        for i, p in enumerate(raw):
            if not isinstance(p, dict):
                errors[f"products[{i}]"] = "Invalid product."
                continue

            name = (p.get("name") or "").strip()
            if not name:
                errors[f"products[{i}].name"] = "Product name is required."

            price = (p.get("price") or "").strip()
            if not price:
                errors[f"products[{i}].price"] = "Price is required."
            else:
                try:
                    if float(price) <= 0:
                        errors[f"products[{i}].price"] = "Price must be greater than zero."
                except (TypeError, ValueError):
                    errors[f"products[{i}].price"] = "Price must be a number."

            sale_price = (p.get("sale_price") or "").strip()
            if sale_price:
                try:
                    if float(sale_price) <= 0:
                        errors[f"products[{i}].sale_price"] = "Sale price must be greater than zero."
                except (TypeError, ValueError):
                    errors[f"products[{i}].sale_price"] = "Sale price must be a number."

            try:
                stock = int(p.get("stock") or 0)
                if stock < 0:
                    errors[f"products[{i}].stock"] = "Stock cannot be negative."
            except (TypeError, ValueError):
                errors[f"products[{i}].stock"] = "Stock must be a whole number."

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        import json

        raw = payload.get("products")
        if isinstance(raw, str):
            raw = json.loads(raw)

        products = []
        for i, p in enumerate(raw):
            images = self._store_images(session, i, payload)
            products.append({
                "name": (p.get("name") or "").strip(),
                "category": (p.get("category") or "").strip(),
                "price": str(p.get("price") or "0").strip(),
                "sale_price": (str(p.get("sale_price")).strip() if p.get("sale_price") else None),
                "stock": int(p.get("stock") or 0),
                "sku": (p.get("sku") or "").strip(),
                "short_description": (p.get("short_description") or "").strip(),
                "images": images,
            })

        return {"products": products}

    # ── prefill ─────────────────────────────────────────────
    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}
        raw_products = stored.get("products", []) if isinstance(stored, dict) else []

        products = []
        for i, p in enumerate(raw_products):
            products.append({
                "id": str(i + 1),
                "name": p.get("name", ""),
                "slug": (p.get("name") or "").lower().replace(" ", "-"),
                "short_description": p.get("short_description", ""),
                "price": str(p.get("price", "0")),
                "sale_price": p.get("sale_price"),
                "sku": p.get("sku", ""),
                "stock": int(p.get("stock", 0)),
                "category": None,
                "category_name": p.get("category", ""),
                "images": [
                    {"id": f"img-{i}-{n}", "url": url, "order": n}
                    for n, url in enumerate(p.get("images", []))
                ],
            })

        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {"products": products},
        }

    # ── helpers ─────────────────────────────────────────────
    @staticmethod
    def _store_images(session, product_index: int, payload) -> list[str]:
        """
        For product at index `i`, read `image_{i}_0`, `image_{i}_1`,
        `image_{i}_2` from the multipart payload and save each.
        Returns a list of URLs (may be empty).
        """
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        import os

        urls = []
        for n in range(MAX_IMAGES_PER_PRODUCT):
            key = f"image_{product_index}_{n}"
            file = payload.get(key) if hasattr(payload, "get") else None
            if file is None or not hasattr(file, "read"):
                continue

            ext = os.path.splitext(getattr(file, "name", "img"))[1] or ".png"
            path = f"onboarding/{session.user_id}/product_{product_index}_{n}{ext}"
            if default_storage.exists(path):
                default_storage.delete(path)
            saved = default_storage.save(path, ContentFile(file.read()))
            try:
                urls.append(default_storage.url(saved))
            except Exception:
                urls.append(saved)
        return urls