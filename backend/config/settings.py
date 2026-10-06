"""
Django settings for config project.
"""

import warnings
from decimal import Decimal
from pathlib import Path

import environ
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
    CSRF_TRUSTED_ORIGINS=(list, []),
    EMAIL_BACKEND=(str, "django.core.mail.backends.console.EmailBackend"),
    DEFAULT_FROM_EMAIL=(str, "noreply@localhost"),
    FRONTEND_URL=(str, "http://localhost:3000"),
    USE_S3=(bool, False),
    # M-Pesa / checkout
    MPESA_ENV=(str, "sandbox"),
    MPESA_CONSUMER_KEY=(str, ""),
    MPESA_CONSUMER_SECRET=(str, ""),
    MPESA_SHORTCODE=(str, ""),
    MPESA_PASSKEY=(str, ""),
    MPESA_CALLBACK_URL=(str, ""),
    MPESA_TIMEOUT_URL=(str, ""),
    MPESA_TRANSACTION_TYPE=(str, "CustomerPayBillOnline"),
    CHECKOUT_TIMEOUT_SECONDS=(int, 120),
    # AI assistant — provider-agnostic.
    AI_PROVIDER=(str, "groq"),
    AI_MODEL=(str, ""),
    AI_BASE_URL=(str, ""),
    AI_MAX_TOOL_ITERATIONS=(int, 5),
    AI_HISTORY_TURNS=(int, 6),
    XAI_API_KEY=(str, ""),
    GEMINI_API_KEY=(str, ""),
    GROQ_API_KEY=(str, ""),
    OPENROUTER_API_KEY=(str, ""),
    AI_KEY_ENC_KEY=(str, ""),
    # Newsletter / marketing email — SendGrid
    SENDGRID_API_KEY=(str, ""),
    SENDGRID_SANDBOX_MODE=(bool, False),
    SHOP_NAME=(str, "Myshop"),
    STORE_URL=(str, "http://localhost:3000"),
    BACKEND_PUBLIC_URL=(str, "http://localhost:8000"),

    # ── ADDED: Meta / WhatsApp Cloud API ──
    WHATSAPP_ENABLED=(bool, False),
    WHATSAPP_DRY_RUN=(bool, True),
    META_APP_ID=(str, ""),
    META_APP_SECRET=(str, ""),
    META_GRAPH_API_VERSION=(str, "v20.0"),
    WHATSAPP_WABA_ID=(str, ""),
    WHATSAPP_PHONE_NUMBER_ID=(str, ""),
    WHATSAPP_DISPLAY_PHONE=(str, ""),
    WHATSAPP_BUSINESS_NAME=(str, ""),
    WHATSAPP_ACCESS_TOKEN=(str, ""),
    WHATSAPP_TOKEN_EXPIRES_AT=(str, ""),
    WHATSAPP_VERIFY_TOKEN=(str, ""),
    WHATSAPP_WEBHOOK_PATH=(str, "/api/webhooks/whatsapp/"),
    WHATSAPP_CART_CHECKOUT_URL=(str, ""),
    WHATSAPP_CART_TOKEN_TTL_HOURS=(int, 24),
    WHATSAPP_HANDOFF_RATE_LIMIT=(int, 3),
    WHATSAPP_HANDOFF_RATE_WINDOW=(int, 60),
    WHATSAPP_BUSINESS_NUMBER_FALLBACK=(str, ""),
    WHATSAPP_TPL_CART_RECOVERY=(str, "cart_recovery"),
    WHATSAPP_TPL_ORDER_CONFIRMATION=(str, "order_confirmation"),
    WHATSAPP_TPL_SHIPPING_UPDATE=(str, "shipping_update"),
    WHATSAPP_TPL_ORDER_DELIVERED=(str, "order_delivered"),
    WHATSAPP_TPL_PAYMENT_REMINDER=(str, "payment_reminder"),
    WHATSAPP_TPL_VERIFY_NUMBER=(str, "verify_number"),
    WHATSAPP_TPL_DEFAULT_LANG=(str, "en"),
    WHATSAPP_TPL_DEFAULT_COUNTRY=(str, "KE"),
    WHATSAPP_SERVICE_WINDOW_HOURS=(int, 24),
    WHATSAPP_OTP_TTL_MINUTES=(int, 10),
    WHATSAPP_OTP_MAX_ATTEMPTS=(int, 5),
    WHATSAPP_OTP_RATE_LIMIT=(int, 3),
    WHATSAPP_RATE_UTILITY_USD=(float, 0.0040),
    WHATSAPP_RATE_MARKETING_USD=(float, 0.0225),
    WHATSAPP_RATE_AUTH_USD=(float, 0.0080),
    WHATSAPP_USD_TO_KES=(float, 130),
    WHATSAPP_FREE_SERVICE_CONVERSATIONS=(int, 1000),
    WHATSAPP_MONTHLY_SPEND_ALERT_KES=(int, 5000),
    WHATSAPP_QUALITY_SCORE_ALERT=(str, "YELLOW"),

    FIELD_ENCRYPTION_KEY=(str, ""),

    # ── ADDED: Social media hub ──
    SOCIAL_ENABLED=(bool, False),
    SOCIAL_DRY_RUN=(bool, True),
    SOCIAL_OAUTH_REDIRECT_BASE=(str, "http://localhost:8000"),
    SOCIAL_ADMIN_UI_URL=(str, "http://localhost:3000"),
    SOCIAL_METRICS_SYNC_INTERVAL_MINUTES=(int, 60),
    SOCIAL_MAX_MEDIA_PER_POST=(int, 5),
    SOCIAL_MAX_MEDIA_SIZE_MB=(int, 25),

    FACEBOOK_PAGE_ID=(str, ""),
    FACEBOOK_PAGE_ACCESS_TOKEN=(str, ""),
    INSTAGRAM_BUSINESS_ACCOUNT_ID=(str, ""),
    META_SOCIAL_SCOPES=(str, "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management"),

    TIKTOK_CLIENT_KEY=(str, ""),
    TIKTOK_CLIENT_SECRET=(str, ""),
    TIKTOK_SCOPES=(str, "user.info.basic,video.publish,video.upload"),

    GOOGLE_CLIENT_ID=(str, ""),
    GOOGLE_CLIENT_SECRET=(str, ""),
    YOUTUBE_REDIRECT_URI=(str, "http://localhost:8000/api/v1/social/oauth/youtube/callback/"),
    YOUTUBE_SCOPES=(str, "https://www.googleapis.com/auth/youtube.upload,https://www.googleapis.com/auth/youtube.readonly"),

    X_API_KEY=(str, ""),
    X_API_SECRET=(str, ""),
    X_BEARER_TOKEN=(str, ""),
    X_REDIRECT_URI=(str, "http://localhost:8000/api/v1/social/oauth/x/callback/"),

    # ── USERS (dashboard.users) ──
    STAFF_INVITE_TTL_DAYS=(int, 7),
    STAFF_INVITE_ACCEPT_PATH=(str, "/accept-invite"),

    # ── ANALYTICS (dashboard.analytics) ──
    # Middleware that logs one PageView row per storefront request.
    # When True, every hit (except admin/static/api/_next) is recorded.
    ANALYTICS_PAGEVIEW_ENABLED=(bool, True),
)

# ── MUST come before any env() call that reads .env values ──
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")


# ─────────────────────────────────────────────────────────────────────────────
# Applications
# ─────────────────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "django_celery_beat",
    "django_celery_results",
    "phonenumber_field",
    "storages",
    "anymail",
    "django_ratelimit",
    "django_otp",
    "django_otp.plugins.otp_totp",

    # Local
    "authentication",
    "catalog",
    "checkout",
    "account",
    "ai",
    "dashboard.whatsapp",
    "newsletter",
    "whatsapfloat",
    "dashboard.products",
    "dashboard.categories",
    "dashboard.brands",
    "dashboard.newsletter",
    "dashboard.customers",
    "dashboard.orders",
    "dashboard.suppliers",
    "dashboard.inventory",
    "dashboard.reviews",
    "dashboard.discounts",
    "dashboard.transactions",
    "dashboard.shipping",
    "dashboard.social",
    "dashboard.direct_orders",
    "dashboard.banners",
    "dashboard.aiandautomations",
    "dashboard.settings",
    "dashboard.users",
    "dashboard.reports",
    "dashboard.analytics",
     "dashboard.overview",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_otp.middleware.OTPMiddleware",

    # ── ANALYTICS (dashboard.analytics) ──
    # Must run AFTER SessionMiddleware and AuthenticationMiddleware so that
    # `request.session.session_key` and `request.user` are available.
    # Must run BEFORE any view returns so page loads are logged.
    "dashboard.analytics.middleware.PageViewMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "authentication.User"
AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LOGIN_URL = "/api/v1/auth/login/"


# ─────────────────────────────────────────────────────────────────────────────
# Sessions & cookies
# ─────────────────────────────────────────────────────────────────────────────
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")


# ─────────────────────────────────────────────────────────────────────────────
# Cache
# ─────────────────────────────────────────────────────────────────────────────
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "myshop",
        "TIMEOUT": 300,
    }
}

RATELIMIT_USE_CACHE = "default"


# ─────────────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST"),
        "PORT": env("DB_PORT"),
    }
}


# ─────────────────────────────────────────────────────────────────────────────
# DRF
# ─────────────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",
        "password_reset": "3/hour",
        "checkout": "10/min",
        "stk_push": "5/min",
        "reviews": "10/hour",
        "ai_chat": "20/min",
        "whatsapp_config": "60/min",
        "whatsapp_product": "30/min",
        "whatsapp_order": "20/min",
        "whatsapp_cart_handoff": "3/min",
        "whatsapp_otp": "3/hour",
        "subscribe": "30/hour",
        "social_publish": "10/min",
        "social_upload": "20/min",
        "banner_hero": "120/min",
        "banner_track": "120/min",
        "ai_assistant_stream": "30/min",
        "ai_content_generate": "10/min",
        "ai_content_bulk": "2/hour",

        "staff_invite_create": "10/hour",
        "staff_invite_accept": "10/hour",
        "staff_password_reset": "10/hour",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Myshop API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
}


# ─────────────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = (
    *default_headers,
    "idempotency-key",
)


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth (customer login)
# ─────────────────────────────────────────────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default="")
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET", default="")
GOOGLE_OAUTH_REDIRECT_URI = env(
    "GOOGLE_OAUTH_REDIRECT_URI",
    default="http://localhost:8000/api/v1/auth/google/callback/",
)


# ─────────────────────────────────────────────────────────────────────────────
# Email — SendGrid via Anymail
# ─────────────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="anymail.backends.sendgrid.EmailBackend",
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

SENDGRID_API_KEY = env("SENDGRID_API_KEY")

ANYMAIL = {
    "SENDGRID_API_KEY": SENDGRID_API_KEY,
    "SENDGRID_API_URL": "https://api.sendgrid.com/v3/mail/send",
}
SENDGRID_SANDBOX_MODE = env("SENDGRID_SANDBOX_MODE")

SILENCED_SYSTEM_CHECKS = ["anymail.W003"]
warnings.filterwarnings(
    "ignore",
    message="django-anymail has dropped official support for SendGrid",
)


# ─────────────────────────────────────────────────────────────────────────────
# Newsletter / marketing email
# ─────────────────────────────────────────────────────────────────────────────
SHOP_NAME = env("SHOP_NAME")
STORE_URL = env("STORE_URL")

BACKEND_PUBLIC_URL = env("BACKEND_PUBLIC_URL")


# ─────────────────────────────────────────────────────────────────────────────
# Frontend
# ─────────────────────────────────────────────────────────────────────────────
FRONTEND_URL = env("FRONTEND_URL")

STAFF_INVITE_TTL_DAYS     = env("STAFF_INVITE_TTL_DAYS")
STAFF_INVITE_ACCEPT_PATH  = env("STAFF_INVITE_ACCEPT_PATH")


# ─────────────────────────────────────────────────────────────────────────────
# Celery
# ─────────────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

CELERY_BEAT_SCHEDULE = {
    "sweep-pending-payments": {
        "task": "checkout.tasks.sweep_pending_payments",
        "schedule": 30.0,
    },
    "sweep-abandoned-carts": {
        "task": "checkout.tasks.sweep_abandoned_carts",
        "schedule": 3600.0,
    },
    "sweep-unpaid-orders": {
        "task": "checkout.tasks.sweep_unpaid_orders",
        "schedule": 3600.0,
    },
    "sweep-stale-callback-logs": {
        "task": "checkout.tasks.sweep_stale_callback_logs",
        "schedule": 86400.0,
    },
    "send-scheduled-campaigns": {
        "task": "newsletter.tasks.send_scheduled_campaigns",
        "schedule": 60.0,
    },
    "whatsapp-expire-cart-sessions": {
        "task": "whatsapp.tasks.expire_cart_sessions",
        "schedule": 600.0,
    },
    "whatsapp-refresh-template-statuses": {
        "task": "whatsapp.tasks.refresh_template_statuses",
        "schedule": 3600.0,
    },
    "whatsapp-check-token-expiry": {
        "task": "whatsapp.tasks.check_token_expiry",
        "schedule": 86400.0,
    },
    "social-dispatch-scheduled-posts": {
        "task": "social.tasks.dispatch_scheduled_posts",
        "schedule": 60.0,
    },
    "social-sync-metrics": {
        "task": "social.tasks.sync_all_metrics",
        "schedule": 60.0 * env("SOCIAL_METRICS_SYNC_INTERVAL_MINUTES"),
    },
    "social-snapshot-followers": {
        "task": "social.tasks.snapshot_followers",
        "schedule": 86400.0,
    },
    "social-refresh-expiring-tokens": {
        "task": "social.tasks.refresh_expiring_tokens",
        "schedule": 3600.0,
    },
    "banners-flip-expired": {
        "task": "banners.tasks.flip_expired_banners",
        "schedule": 300.0,
    },
    "generate-ai-insights": {
        "task": "dashboard.aiandautomations.tasks.generate_insights",
        "schedule": 86400.0,
    },
    "check-ai-budget": {
        "task": "dashboard.aiandautomations.tasks.check_budget",
        "schedule": 1800.0,
    },
    "prune-ai-audit-log": {
        "task": "dashboard.aiandautomations.tasks.prune_audit_log",
        "schedule": 86400.0,
    },
    "prune-ai-usage": {
        "task": "dashboard.aiandautomations.tasks.prune_usage",
        "schedule": 86400.0,
    },
    "sweep-expired-staff-invites": {
        "task": "dashboard.users.tasks.sweep_expired_invites",
        "schedule": 3600.0,
    },
    # ── ANALYTICS — trim old page views so the table doesn't grow forever.
    # Keeps 90 days by default. If you don't have this task yet, the entry
    # is harmless: Celery will log "task not registered" and skip it.
    "analytics-prune-old-pageviews": {
        "task": "dashboard.analytics.tasks.prune_old_pageviews",
        "schedule": 86400.0,
    },
}

CELERY_TASK_ROUTES = {
    "whatsapp.tasks.process_whatsapp_event": {"queue": "whatsapp.inbound"},
    "whatsapp.tasks.send_whatsapp_message":  {"queue": "whatsapp.outbound"},
    "whatsapp.tasks.send_broadcast_batch":   {"queue": "whatsapp.broadcast"},
    "social.tasks.publish_post":             {"queue": "social.publish"},
    "social.tasks.dispatch_scheduled_posts": {"queue": "social.publish"},
    "social.tasks.sync_all_metrics":         {"queue": "social.metrics"},
    "social.tasks.snapshot_followers":       {"queue": "social.metrics"},
    "social.tasks.refresh_expiring_tokens":  {"queue": "social.metrics"},
    "dashboard.aiandautomations.tasks.run_bulk_content": {"queue": "ai.content"},
}


# ─────────────────────────────────────────────────────────────────────────────
# Static / media
# ─────────────────────────────────────────────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

MEDIA_URL_ABSOLUTE = (
    f"{BACKEND_PUBLIC_URL.rstrip('/')}{MEDIA_URL}" if not DEBUG else MEDIA_URL
)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

if env.bool("USE_S3"):
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None


# ─────────────────────────────────────────────────────────────────────────────
# i18n
# ─────────────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ─────────────────────────────────────────────────────────────────────────────
# Checkout / M-Pesa
# ─────────────────────────────────────────────────────────────────────────────
MPESA_ENV = env("MPESA_ENV")
MPESA_CONSUMER_KEY = env("MPESA_CONSUMER_KEY")
MPESA_CONSUMER_SECRET = env("MPESA_CONSUMER_SECRET")
MPESA_SHORTCODE = env("MPESA_SHORTCODE")
MPESA_PASSKEY = env("MPESA_PASSKEY")
MPESA_CALLBACK_URL = env("MPESA_CALLBACK_URL")
MPESA_TIMEOUT_URL = env("MPESA_TIMEOUT_URL")
MPESA_TRANSACTION_TYPE = env("MPESA_TRANSACTION_TYPE")

if MPESA_ENV == "production":
    MPESA_BASE_URL = "https://api.safaricom.co.ke"
else:
    MPESA_BASE_URL = "https://sandbox.safaricom.co.ke"

CHECKOUT_TIMEOUT_SECONDS = env("CHECKOUT_TIMEOUT_SECONDS")

TAX_RATE = Decimal("0.16")
FREE_DELIVERY_THRESHOLD = Decimal("5000")
DELIVERY_FEES = {
    "express": Decimal("500"),
    "standard": Decimal("300"),
    "pickup": Decimal("0"),
}
DEFAULT_CURRENCY = "KES"

KENYAN_COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu",
    "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
    "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
    "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
    "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi",
    "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya",
    "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana",
    "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
]


# ─────────────────────────────────────────────────────────────────────────────
# WhatsApp Cloud API
# ─────────────────────────────────────────────────────────────────────────────
WHATSAPP_ENABLED          = env("WHATSAPP_ENABLED")
WHATSAPP_DRY_RUN          = env("WHATSAPP_DRY_RUN")

META_APP_ID               = env("META_APP_ID")
META_APP_SECRET           = env("META_APP_SECRET")
META_GRAPH_API_VERSION    = env("META_GRAPH_API_VERSION")
META_GRAPH_BASE_URL       = f"https://graph.facebook.com/{META_GRAPH_API_VERSION}"

WHATSAPP_WABA_ID          = env("WHATSAPP_WABA_ID")
WHATSAPP_PHONE_NUMBER_ID  = env("WHATSAPP_PHONE_NUMBER_ID")
WHATSAPP_DISPLAY_PHONE    = env("WHATSAPP_DISPLAY_PHONE")
WHATSAPP_BUSINESS_NAME    = env("WHATSAPP_BUSINESS_NAME")
WHATSAPP_ACCESS_TOKEN     = env("WHATSAPP_ACCESS_TOKEN")
WHATSAPP_TOKEN_EXPIRES_AT = env("WHATSAPP_TOKEN_EXPIRES_AT")
WHATSAPP_VERIFY_TOKEN     = env("WHATSAPP_VERIFY_TOKEN")
WHATSAPP_WEBHOOK_PATH     = env("WHATSAPP_WEBHOOK_PATH")

WHATSAPP_CART_CHECKOUT_URL        = env("WHATSAPP_CART_CHECKOUT_URL")
WHATSAPP_CART_TOKEN_TTL_HOURS     = env("WHATSAPP_CART_TOKEN_TTL_HOURS")
WHATSAPP_HANDOFF_RATE_LIMIT       = env("WHATSAPP_HANDOFF_RATE_LIMIT")
WHATSAPP_HANDOFF_RATE_WINDOW      = env("WHATSAPP_HANDOFF_RATE_WINDOW")
WHATSAPP_BUSINESS_NUMBER_FALLBACK = env("WHATSAPP_BUSINESS_NUMBER_FALLBACK")

WHATSAPP_TEMPLATES = {
    "CART_RECOVERY":      env("WHATSAPP_TPL_CART_RECOVERY"),
    "ORDER_CONFIRMATION": env("WHATSAPP_TPL_ORDER_CONFIRMATION"),
    "SHIPPING_UPDATE":    env("WHATSAPP_TPL_SHIPPING_UPDATE"),
    "ORDER_DELIVERED":    env("WHATSAPP_TPL_ORDER_DELIVERED"),
    "PAYMENT_REMINDER":   env("WHATSAPP_TPL_PAYMENT_REMINDER"),
    "VERIFY_NUMBER":      env("WHATSAPP_TPL_VERIFY_NUMBER"),
}
WHATSAPP_DEFAULT_TEMPLATE_LANG    = env("WHATSAPP_TPL_DEFAULT_LANG")
WHATSAPP_DEFAULT_TEMPLATE_COUNTRY = env("WHATSAPP_TPL_DEFAULT_COUNTRY")

WHATSAPP_SERVICE_WINDOW_HOURS = env("WHATSAPP_SERVICE_WINDOW_HOURS")
WHATSAPP_OTP_TTL_MINUTES      = env("WHATSAPP_OTP_TTL_MINUTES")
WHATSAPP_OTP_MAX_ATTEMPTS     = env("WHATSAPP_OTP_MAX_ATTEMPTS")
WHATSAPP_OTP_RATE_LIMIT       = env("WHATSAPP_OTP_RATE_LIMIT")

WHATSAPP_RATES_USD = {
    "UTILITY":        env("WHATSAPP_RATE_UTILITY_USD"),
    "MARKETING":      env("WHATSAPP_RATE_MARKETING_USD"),
    "AUTHENTICATION": env("WHATSAPP_RATE_AUTH_USD"),
    "SERVICE":        0.0,
}
WHATSAPP_USD_TO_KES                 = env("WHATSAPP_USD_TO_KES")
WHATSAPP_FREE_SERVICE_CONVERSATIONS = env("WHATSAPP_FREE_SERVICE_CONVERSATIONS")
WHATSAPP_MONTHLY_SPEND_ALERT_KES    = env("WHATSAPP_MONTHLY_SPEND_ALERT_KES")
WHATSAPP_QUALITY_SCORE_ALERT        = env("WHATSAPP_QUALITY_SCORE_ALERT")

FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY")


# ─────────────────────────────────────────────────────────────────────────────
# Social media hub
# ─────────────────────────────────────────────────────────────────────────────
SOCIAL_ENABLED         = env("SOCIAL_ENABLED")
SOCIAL_DRY_RUN         = env("SOCIAL_DRY_RUN")

SOCIAL_OAUTH_REDIRECT_BASE = env("SOCIAL_OAUTH_REDIRECT_BASE")
SOCIAL_ADMIN_UI_URL        = env("SOCIAL_ADMIN_UI_URL")

SOCIAL_METRICS_SYNC_INTERVAL_MINUTES = env("SOCIAL_METRICS_SYNC_INTERVAL_MINUTES")

SOCIAL_MAX_MEDIA_PER_POST = env("SOCIAL_MAX_MEDIA_PER_POST")
SOCIAL_MAX_MEDIA_SIZE_MB  = env("SOCIAL_MAX_MEDIA_SIZE_MB")

SOCIAL_OAUTH_REDIRECTS = {
    "FACEBOOK":  f"{SOCIAL_OAUTH_REDIRECT_BASE.rstrip('/')}/api/v1/social/oauth/facebook/callback/",
    "INSTAGRAM": f"{SOCIAL_OAUTH_REDIRECT_BASE.rstrip('/')}/api/v1/social/oauth/instagram/callback/",
    "TIKTOK":    f"{SOCIAL_OAUTH_REDIRECT_BASE.rstrip('/')}/api/v1/social/oauth/tiktok/callback/",
    "YOUTUBE":   env("YOUTUBE_REDIRECT_URI"),
    "X":         env("X_REDIRECT_URI"),
}

FACEBOOK_PAGE_ID                = env("FACEBOOK_PAGE_ID")
FACEBOOK_PAGE_ACCESS_TOKEN      = env("FACEBOOK_PAGE_ACCESS_TOKEN")
INSTAGRAM_BUSINESS_ACCOUNT_ID   = env("INSTAGRAM_BUSINESS_ACCOUNT_ID")
META_SOCIAL_SCOPES              = env.list("META_SOCIAL_SCOPES")

TIKTOK_CLIENT_KEY     = env("TIKTOK_CLIENT_KEY")
TIKTOK_CLIENT_SECRET  = env("TIKTOK_CLIENT_SECRET")
TIKTOK_SCOPES         = env.list("TIKTOK_SCOPES")

GOOGLE_CLIENT_ID      = env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET  = env("GOOGLE_CLIENT_SECRET")
YOUTUBE_REDIRECT_URI  = env("YOUTUBE_REDIRECT_URI")
YOUTUBE_SCOPES        = env.list("YOUTUBE_SCOPES")

X_API_KEY      = env("X_API_KEY")
X_API_SECRET   = env("X_API_SECRET")
X_BEARER_TOKEN = env("X_BEARER_TOKEN")
X_REDIRECT_URI = env("X_REDIRECT_URI")


# ─────────────────────────────────────────────────────────────────────────────
# Banners & hero
# ─────────────────────────────────────────────────────────────────────────────
BANNERS_ENABLED              = env.bool("BANNERS_ENABLED", default=True)
BANNERS_HERO_CACHE_SECONDS   = env.int("BANNERS_HERO_CACHE_SECONDS", default=60)
BANNERS_MAX_DESKTOP_UPLOAD_MB = env.int("BANNERS_MAX_DESKTOP_UPLOAD_MB", default=8)
BANNERS_MAX_MOBILE_UPLOAD_MB  = env.int("BANNERS_MAX_MOBILE_UPLOAD_MB",  default=4)


# ─────────────────────────────────────────────────────────────────────────────
# AI & Automations
# ─────────────────────────────────────────────────────────────────────────────
AI_PROVIDER = env("AI_PROVIDER")
AI_MODEL = env("AI_MODEL")
AI_BASE_URL = env("AI_BASE_URL")
AI_MAX_TOOL_ITERATIONS = env("AI_MAX_TOOL_ITERATIONS")
AI_HISTORY_TURNS = env("AI_HISTORY_TURNS")

AI_KEY_ENC_KEY = env("AI_KEY_ENC_KEY") or SECRET_KEY

GROQ_API_KEY = env("GROQ_API_KEY")
GEMINI_API_KEY = env("GEMINI_API_KEY")
XAI_API_KEY = env("XAI_API_KEY")
OPENROUTER_API_KEY = env("OPENROUTER_API_KEY")


# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "whatsapp": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "whatsapp.webhook": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "social": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "social.oauth": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "social.publish": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "social.metrics": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "banners": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "banners.tasks": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "checkout": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "checkout.tasks": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "dashboard.aiandautomations": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "dashboard.aiandautomations.services.assistant": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "dashboard.aiandautomations.services.automations": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "dashboard.users": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "dashboard.users.tasks": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },

        # ── ANALYTICS (dashboard.analytics) ──
        # Parent logger — warnings when a tab's query fails.
        "dashboard.analytics": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # Middleware — set to DEBUG to log every page view as it's recorded.
        "dashboard.analytics.middleware": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "WARNING",
            "propagate": False,
        },
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS (dashboard.analytics)
# ─────────────────────────────────────────────────────────────────────────────
# Toggle for the PageView middleware. When False, no rows are written —
# useful in tests or when you want the analytics tab to fall back to
# order-derived estimates.
ANALYTICS_PAGEVIEW_ENABLED = env.bool("ANALYTICS_PAGEVIEW_ENABLED", default=True)

# Skip paths — comma-separated prefixes the middleware should ignore.
# Override in .env if you mount your storefront under a different prefix.
ANALYTICS_PAGEVIEW_SKIP_PREFIXES = env.list(
    "ANALYTICS_PAGEVIEW_SKIP_PREFIXES",
    default=["/admin", "/static", "/media", "/api", "/_next", "/favicon"],
)

# Trim old page views after this many days. The prune task (if registered)
# reads this value.
ANALYTICS_PAGEVIEW_RETENTION_DAYS = env.int(
    "ANALYTICS_PAGEVIEW_RETENTION_DAYS",
    default=90,
)