# apps/onboarding/serializers.py

from rest_framework import serializers


# ============================================================
# REQUEST SHAPES
# ============================================================

class StepSubmitSerializer(serializers.Serializer):
    """
    Generic body for POST /api/onboarding/steps/<key>/submit/.

    Accepts either:
      - a flat payload:      { "name": "…", "email": "…" }
      - an enveloped payload: { "data": { "name": "…", ... } }

    Field-by-field validation happens in each step's validate() — this
    serializer only normalizes the outer envelope so views can always
    read `request.data` as a flat dict.
    """
    data = serializers.DictField(required=False, default=dict)

    def to_internal_value(self, data):
        # If the client sent { data: {...} }, unwrap it.
        if isinstance(data, dict) and "data" in data and isinstance(data["data"], dict):
            data = data["data"]
        # QueryDict (multipart) — .dict() gives us a plain dict.
        elif hasattr(data, "dict"):
            data = data.dict()
        return {"data": dict(data)}


# ============================================================
# RESPONSE SHAPES
# ============================================================

class StepSummarySerializer(serializers.Serializer):
    """Shape returned by GET /api/onboarding/steps/<key>/."""
    key = serializers.CharField()
    optional = serializers.BooleanField()
    complete = serializers.BooleanField()
    data = serializers.DictField()
    meta = serializers.DictField(required=False)


class OnboardingSessionSerializer(serializers.Serializer):
    """Shape returned by GET /api/onboarding/session/ and /progress/."""
    id = serializers.UUIDField()
    status = serializers.CharField()
    current_step = serializers.CharField()
    completion_percent = serializers.IntegerField()
    started_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(allow_null=True)
    steps = StepSummarySerializer(many=True)
    completion = serializers.DictField()


class Step12FinishSerializer(serializers.Serializer):
    """
    Flattened shape returned by GET /api/onboarding/steps/12/
    (step 12 bypasses the standard envelope — see views.step_detail).
    """
    steps = serializers.ListField(child=serializers.DictField())
    stats = serializers.DictField()
    completed_count = serializers.IntegerField()
    total_count = serializers.IntegerField()
    ready_to_go_live = serializers.BooleanField()
    missing_steps = serializers.ListField(child=serializers.IntegerField())
    status = serializers.CharField()
    submitted_at = serializers.DateTimeField(allow_null=True)


# ============================================================
# API PAYLOAD REFERENCE
# ============================================================
"""
Kept as documentation — validation lives in each step's validate()
method, serialization in selectors.serialize_session().

────────────────────────────────────────────────────────────
GLOBAL
────────────────────────────────────────────────────────────
GET  /api/onboarding/progress/          → OnboardingProgress (see lib/api.ts)
GET  /api/onboarding/steps/             → { total_steps, steps: {stepN: meta} }
POST /api/onboarding/session/reset/     → resets session to step1

────────────────────────────────────────────────────────────
STEP 1 — ACCOUNT
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/1/
    → { fullName, email, phone, role }

POST /api/onboarding/steps/1/
    fullName: str (required)
    email: str (required, unique)
    phone: str (required)
    role: "Owner" | "Manager" | "Staff" (default "Owner")
    password: str (optional — if provided, must match `confirm`)
    confirm: str (optional)
    agreed: bool (must be true)

────────────────────────────────────────────────────────────
STEP 2 — STORE PROFILE (accepts multipart)
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/2/
    → { name, tagline, description, logo, street, town, county,
        postal_code, support_email, support_phone }

POST /api/onboarding/steps/2/
    name: str (required)
    tagline: str (optional, ≤120 chars)
    description: str (optional, ≤200 chars)
    logo: File (optional, ≤2MB, PNG/JPG/SVG)
    street: str (optional)
    town: str (optional)
    county: str (optional, must be in VALID_COUNTIES)
    postalCode / postal_code: str (optional)
    supportEmail / support_email: str (optional)
    supportPhone / support_phone: str (optional)

────────────────────────────────────────────────────────────
STEP 3 — BUSINESS & TAX
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/3/
    → { type, kra_pin, reg_number, vat_registered, vat_number,
        etims_enabled, etims_device_id, etims_pin, etims_env,
        etims_api_key_set, invoice_footer }

POST /api/onboarding/steps/3/
    type: "sole" | "ltd" | "partner" | "none" (required)
    kra_pin: str (required unless type == "none")
    reg_number: str (required if type in {"ltd", "partner"})
    vat_registered: bool (default false)
    vat_number: str (required if vat_registered)
    etims_enabled: bool (default false)
    etims_device_id: str (required if etims_enabled)
    etims_pin: str (required if etims_enabled)
    etims_api_key: str (optional on resubmit — previous value preserved)
    etims_env: "sandbox" | "production" (default "sandbox")
    invoice_footer: str (optional, ≤200 chars)

POST /api/onboarding/steps/3/etims-test/
    device_id: str (required)
    pin: str (required)
    api_key: str (required)
    env: "sandbox" | "production" (default "sandbox")
    → { ok: bool, detail: str }

────────────────────────────────────────────────────────────
STEP 4 — PAYMENTS (M-Pesa only)
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/4/
    → { mpesa_enabled, mpesa: { consumer_key, consumer_secret,
        passkey, shortcode, env } }

POST /api/onboarding/steps/4/
    mpesa_enabled: bool (must be true)
    mpesa: {
        consumer_key: str (required)
        consumer_secret: str (required)
        passkey: str (required)
        shortcode: str (required)
        env: "sandbox" | "production"
    }

POST /api/onboarding/steps/4/test/
    credentials: {
        consumer_key: str
        consumer_secret: str
        passkey: str
        shortcode: str
        env: "sandbox" | "production"
    }
    → { ok: bool, detail: str }

────────────────────────────────────────────────────────────
STEP 5 — WHATSAPP
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/5/
    → { number, verified, verified_at, template,
        new_order_alert, auto_reply }

POST /api/onboarding/steps/5/
    number: str (required)
    template: str (optional, ≤1024 chars)
    new_order_alert: bool (default true)
    auto_reply: bool (default false)

POST /api/onboarding/steps/5/verify/
    number: str (required)
    otp: str (optional — omit to request a code)
    → { ok: bool, detail: str }

POST /api/onboarding/steps/5/send-test/
    template: str (optional)
    sample_data: object (optional)
    → { ok: bool, detail: str, rendered?: str }

────────────────────────────────────────────────────────────
STEP 6 — SHIPPING
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/6/
    → { preset, zones: [{ name, counties: [], rates: [
        { method, price, eta }] }],
        free_shipping_enabled, free_shipping_threshold }

POST /api/onboarding/steps/6/
    preset: "national" | "nairobi" | "custom"
    zones: [
        {
            name: str (required)
            counties: [str]
            rates: [
                { method: str (default "Standard"), price: str, eta: str }
            ]
        }
    ]
    free_shipping_enabled: bool
    free_shipping_threshold: str (required if free_shipping_enabled)

────────────────────────────────────────────────────────────
STEP 7 — FIRST CATEGORIES (accepts multipart)
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/7/
    → { categories: [{ id, name, slug, description, image }] }

POST /api/onboarding/steps/7/
    JSON:
        categories: [{ name, slug, description }]
    Multipart:
        categories = JSON string of the above
        image_0 = File
        image_1 = File
        ...

────────────────────────────────────────────────────────────
STEP 8 — FIRST PRODUCTS (accepts multipart)
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/8/
    → { products: [{ id, name, slug, short_description, price,
        sale_price, sku, stock, category, category_name,
        images: [{ id, url, order }] }] }

POST /api/onboarding/steps/8/
    JSON:
        products: [{
            name, category, price, sale_price?,
            stock, sku, short_description
        }]
    Multipart:
        products = JSON string of the above
        image_<i>_<n> = File  (product index, image index 0..2)

────────────────────────────────────────────────────────────
STEP 9 — SOCIAL CHANNELS
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/9/
    → { platforms: [{ id, connected, username, connected_at, gated }],
        connected_count, total_count }

POST /api/onboarding/steps/9/
    connected_platforms: [
        "tiktok_shop" | "instagram" | "facebook" | "youtube" | "x"
    ]

────────────────────────────────────────────────────────────
STEP 10 — THEME
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/10/
    → { preset, primary, accent, font, radius, dark_store }

POST /api/onboarding/steps/10/
    preset: "blue" | "dark" | "white" | "orange" | "green" | "red" | "custom"
    primary: str (hex)
    accent: str (hex)
    font: "Inter" | "Poppins" | "Roboto"
    radius: int (0..24)
    dark_store: bool

────────────────────────────────────────────────────────────
STEP 11 — TEAM INVITES
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/11/
    → { invites: [{ id, email, role, status, created_at, expires_at }] }

POST /api/onboarding/steps/11/
    invites: [
        { email: str, role: "admin" | "manager" | "orders" | "content" }
    ]

────────────────────────────────────────────────────────────
STEP 12 — FINISH (flattened response)
────────────────────────────────────────────────────────────
GET  /api/onboarding/steps/12/
    → { steps: [{ number, slug, title, description, optional, state }],
        stats: { categories_added, products_added,
                 payment_methods, team_members },
        completed_count, total_count,
        ready_to_go_live, missing_steps: [int],
        status: OnboardingStatus,
        submitted_at: str | null }

POST /api/onboarding/steps/12/
    confirm: bool (must be true)
    → standard envelope: { step, stored, completion, session }
"""