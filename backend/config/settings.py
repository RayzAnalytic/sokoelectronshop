import warnings
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import environ
from botocore.config import Config
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_SECRET_KEY=(str, ""),
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
    CSRF_TRUSTED_ORIGINS=(list, []),

    SESSION_COOKIE_SAMESITE=(str, "Lax"),
    SESSION_COOKIE_SECURE=(bool, None),
    SESSION_COOKIE_DOMAIN=(str, ""),
    CSRF_COOKIE_SAMESITE=(str, "Lax"),
    CSRF_COOKIE_SECURE=(bool, None),
    CSRF_COOKIE_DOMAIN=(str, ""),

    EMAIL_BACKEND=(str, "django.core.mail.backends.console.EmailBackend"),
    DEFAULT_FROM_EMAIL=(str, "noreply@localhost"),

    FRONTEND_URL=(str, "http://localhost:3000"),
    BACKEND_PUBLIC_URL=(str, "http://localhost:8000"),
    STORE_URL=(str, "http://localhost:3000"),
    SITE_URL=(str, ""),

    USE_S3=(bool, False),

    MPESA_ENV=(str, "sandbox"),
    MPESA_CONSUMER_KEY=(str, ""),
    MPESA_CONSUMER_SECRET=(str, ""),
    MPESA_SHORTCODE=(str, ""),
    MPESA_PASSKEY=(str, ""),
    MPESA_CALLBACK_URL=(str, ""),
    MPESA_TIMEOUT_URL=(str, ""),
    MPESA_TRANSACTION_TYPE=(str, "CustomerPayBillOnline"),
    CHECKOUT_TIMEOUT_SECONDS=(int, 120),

    AI_PROVIDER=(str, "groq"),
    AI_MODEL=(str, ""),
    AI_BASE_URL=(str, ""),
    AI_MAX_TOOL_ITERATIONS=(int, 5),
    AI_HISTORY_TURNS=(int, 6),
    XAI_API_KEY=(str, ""),
    GEMINI_API_KEY=(str, ""),
    GROQ_API_KEY=(str, ""),
    OPENAI_API_KEY=(str, ""),
    ANTHROPIC_API_KEY=(str, ""),
    OPENROUTER_API_KEY=(str, ""),
    OPENROUTER_BASE_URL=(str, "https://openrouter.ai/api/v1"),
    OPENROUTER_MODEL=(str, "openai/gpt-4o-mini"),
    OPENROUTER_HTTP_REFERER=(str, ""),
    OPENROUTER_X_TITLE=(str, "Racetech Hub Admin"),
    OPENROUTER_MONTHLY_BUDGET_KES=(int, 2000),
    AI_KEY_ENC_KEY=(str, ""),

    SENDGRID_API_KEY=(str, ""),
    SENDGRID_SANDBOX_MODE=(bool, False),

    SHOP_NAME=(str, "Racetech Hub"),

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
    WHATSAPP_FALLBACK_IMAGE_URL=(str, ""),
    FIELD_ENCRYPTION_KEY=(str, ""),
    WHATSAPP_BOT_ENABLED=(bool, False),
    WHATSAPP_BOT_MODEL=(str, "llama-3.1-8b-instant"),
    WHATSAPP_BOT_HISTORY_TURNS=(int, 6),
    WHATSAPP_BOT_HUMAN_COOLDOWN_MINUTES=(int, 10),
    WHATSAPP_BOT_RATE_LIMIT_SECONDS=(int, 30),

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

    GOOGLE_OAUTH_CLIENT_ID=(str, ""),
    GOOGLE_OAUTH_CLIENT_SECRET=(str, ""),
    GOOGLE_OAUTH_REDIRECT_URI=(str, "http://localhost:8000/api/v1/auth/google/callback/"),

    GOOGLE_CLIENT_ID=(str, ""),
    GOOGLE_CLIENT_SECRET=(str, ""),
    YOUTUBE_REDIRECT_URI=(str, ""),
    YOUTUBE_SCOPES=(str, ""),

    AUTH_STRATEGY=(str, "both"),

    STAFF_INVITE_TTL_DAYS=(int, 7),
    STAFF_INVITE_ACCEPT_PATH=(str, "/accept-invite"),

    ANALYTICS_PAGEVIEW_ENABLED=(bool, True),
    ANALYTICS_PAGEVIEW_RETENTION_DAYS=(int, 90),
)

environ.Env.read_env(BASE_DIR / ".env")

WHATSAPP_DEV_NO_AUTH = env.bool("WHATSAPP_DEV_NO_AUTH", default=True)

SECRET_KEY = env("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in .env")

DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])


# =====================================================================
# ADDED: Production / Render reverse-proxy support
# =====================================================================
# Render terminates TLS at its edge and forwards HTTP to your app.
# Without SECURE_PROXY_SSL_HEADER, request.build_absolute_uri() will
# return http://... URLs and Google OAuth callbacks break.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Force HTTPS redirects in production only (disable if Render health
# checks start failing — set env SECURE_SSL_REDIRECT=False).
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=not DEBUG)

# HSTS — safe defaults, only active when DEBUG=False
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000 if not DEBUG else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
    "SECURE_HSTS_INCLUDE_SUBDOMAINS", default=not DEBUG
)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)

# Modern browsers
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# Trust CSRF from the Vercel frontend (already augmented below,
# but this captures it early so admin also works)
CSRF_TRUSTED_ORIGINS = list(env.list("CSRF_TRUSTED_ORIGINS", default=[]))
# =====================================================================


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
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
    "django_openrouter",
    'django_extensions',
    "authentication",
    "catalog",
    "checkout",
    "account",
    "ai",
    "dashboard.aiautomations",
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
    "dashboard.settings",
    "dashboard.users",
    "dashboard.reports",
    "dashboard.analytics",
    "dashboard.overview",
    'dashboard.returns',
    'dashboard.payments',
    'dashboard.campaigns',
    "dashboard.posters",
]
SITE_ID = 1

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


SESSION_COOKIE_HTTPONLY = True
_session_samesite = env("SESSION_COOKIE_SAMESITE")
if _session_samesite not in ("Lax", "Strict", "None"):
    _session_samesite = "Lax"
SESSION_COOKIE_SAMESITE = _session_samesite

_session_secure = env("SESSION_COOKIE_SECURE", default=None)
SESSION_COOKIE_SECURE = _session_secure if _session_secure is not None else not DEBUG

if SESSION_COOKIE_SAMESITE == "None" and not SESSION_COOKIE_SECURE:
    raise ImproperlyConfigured(
        "SESSION_COOKIE_SAMESITE=None requires SESSION_COOKIE_SECURE=True. "
        "Either run over HTTPS or set SESSION_COOKIE_SAMESITE=Lax."
    )

SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN") or None
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

CSRF_COOKIE_HTTPONLY = False
_csrf_samesite = env("CSRF_COOKIE_SAMESITE")
if _csrf_samesite not in ("Lax", "Strict", "None"):
    _csrf_samesite = "Lax"
CSRF_COOKIE_SAMESITE = _csrf_samesite

_csrf_secure = env("CSRF_COOKIE_SECURE", default=None)
CSRF_COOKIE_SECURE = _csrf_secure if _csrf_secure is not None else not DEBUG

if CSRF_COOKIE_SAMESITE == "None" and not CSRF_COOKIE_SECURE:
    raise ImproperlyConfigured(
        "CSRF_COOKIE_SAMESITE=None requires CSRF_COOKIE_SECURE=True."
    )

CSRF_COOKIE_DOMAIN = env("CSRF_COOKIE_DOMAIN") or None

CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])


REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
#CACHES = {    "default": {        "BACKEND": "django_redis.cache.RedisCache",
#        "LOCATION": REDIS_URL,
#        "OPTIONS": {
#            "CLIENT_CLASS": "django_redis.client.DefaultClient",
#        },
#        "KEY_PREFIX": "myshop",
#        "TIMEOUT": 300,
#    }
#}
# settings.py
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "unique-snowflake",  # any unique name
    }
}
RATELIMIT_USE_CACHE = "default"


#DATABASES = {
#    "default": {
#        "ENGINE": "django.db.backends.postgresql",
#        "NAME": env("DB_NAME"),
#        "USER": env("DB_USER"),
#        "PASSWORD": env("DB_PASSWORD"),
#        "HOST": env("DB_HOST"),
#        "PORT": env("DB_PORT"),
#    }
#}
import dj_database_url

DATABASES = {
    "default": dj_database_url.config(
        conn_max_age=600,
        default="sqlite:///db.sqlite3",
    )
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
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
        "whatsapp_send": "60/min",
        "whatsapp_catalog_sync": "10/min",
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


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "VERIFYING_KEY": "",
    "AUDIENCE": None,
    "ISSUER": None,
    "JSON_ENCODER": None,
    "JWK_URL": None,
    "LEEWAY": 0,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "USER_AUTHENTICATION_RULE": "rest_framework_simplejwt.authentication.default_user_authentication_rule",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
    "TOKEN_USER_CLASS": "rest_framework_simplejwt.models.TokenUser",
    "JTI_CLAIM": "jti",
    "SLIDING_TOKEN_REFRESH_EXP_CLAIM": "refresh_exp",
    "SLIDING_TOKEN_LIFETIME": timedelta(minutes=5),
    "SLIDING_TOKEN_REFRESH_LIFETIME": timedelta(days=1),
    "TOKEN_OBTAIN_SERIALIZER": "authentication.serializers.CustomTokenObtainPairSerializer",
    "TOKEN_REFRESH_SERIALIZER": "rest_framework_simplejwt.serializers.TokenRefreshSerializer",
    "TOKEN_VERIFY_SERIALIZER": "rest_framework_simplejwt.serializers.TokenVerifySerializer",
    "TOKEN_BLACKLIST_SERIALIZER": "rest_framework_simplejwt.serializers.TokenBlacklistSerializer",
}


SPECTACULAR_SETTINGS = {
    "TITLE": "Myshop API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
}


CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

_FRONTEND_ORIGIN = env("FRONTEND_URL").rstrip("/")
if _FRONTEND_ORIGIN and _FRONTEND_ORIGIN not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS = list(CORS_ALLOWED_ORIGINS) + [_FRONTEND_ORIGIN]

if _FRONTEND_ORIGIN and _FRONTEND_ORIGIN not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = list(CSRF_TRUSTED_ORIGINS) + [_FRONTEND_ORIGIN]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = (
    *default_headers,
    "idempotency-key",
    "authorization",
)


GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_OAUTH_REDIRECT_URI = env("GOOGLE_OAUTH_REDIRECT_URI")

GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET", default="")


EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="anymail.backends.sendgrid.EmailBackend",
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

ANYMAIL = {
    "SENDGRID_API_KEY": env("SENDGRID_API_KEY"),
}

# ── Silenced system checks ────────────────────────────────────────────
# anymail.W003       : django-anymail dropped official SendGrid support
# django_ratelimit.E003 : LocMemCache is not a "shared cache" — fine for
#                         the single Gunicorn worker on Render's free tier
# django_ratelimit.W001 : same reason, warning-level variant
# ──────────────────────────────────────────────────────────────────────
SILENCED_SYSTEM_CHECKS = [
    "anymail.W003",
    "django_ratelimit.E003",
    "django_ratelimit.W001",
]

warnings.filterwarnings(
    "ignore",
    message="django-anymail has dropped official support for SendGrid",
)


SHOP_NAME = env("SHOP_NAME")
STORE_URL = env("STORE_URL")
BACKEND_PUBLIC_URL = env("BACKEND_PUBLIC_URL")
SITE_URL = env("SITE_URL") or BACKEND_PUBLIC_URL
FRONTEND_URL = env("FRONTEND_URL")

STAFF_INVITE_TTL_DAYS = env("STAFF_INVITE_TTL_DAYS")
STAFF_INVITE_ACCEPT_PATH = env("STAFF_INVITE_ACCEPT_PATH")


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
        "task": "dashboard.aiautomations.tasks.generate_insights",
        "schedule": 86400.0,
    },
    "check-ai-budget": {
        "task": "dashboard.aiautomations.tasks.check_budget",
        "schedule": 1800.0,
    },
    "prune-ai-audit-log": {
        "task": "dashboard.aiautomations.tasks.prune_audit_log",
        "schedule": 86400.0,
    },
    "prune-ai-usage": {
        "task": "dashboard.aiautomations.tasks.prune_usage",
        "schedule": 86400.0,
    },
    "sweep-due-ai-automations": {
        "task": "dashboard.aiautomations.tasks.sweep_due_automations",
        "schedule": 30.0,
    },
    "sweep-expired-staff-invites": {
        "task": "dashboard.users.tasks.sweep_expired_invites",
        "schedule": 3600.0,
    },
    "analytics-prune-old-pageviews": {
        "task": "dashboard.analytics.tasks.prune_old_pageviews",
        "schedule": 86400.0,
    },
}

CELERY_TASK_ROUTES = {
    "whatsapp.tasks.process_whatsapp_event": {"queue": "whatsapp.inbound"},
    "whatsapp.tasks.send_whatsapp_message": {"queue": "whatsapp.outbound"},
    "whatsapp.tasks.send_broadcast_batch": {"queue": "whatsapp.broadcast"},
    "social.tasks.publish_post": {"queue": "social.publish"},
    "social.tasks.dispatch_scheduled_posts": {"queue": "social.publish"},
    "social.tasks.sync_all_metrics": {"queue": "social.metrics"},
    "social.tasks.snapshot_followers": {"queue": "social.metrics"},
    "social.tasks.refresh_expiring_tokens": {"queue": "social.metrics"},
    "dashboard.aiautomations.tasks.run_bulk_content": {"queue": "ai.content"},
    "dashboard.aiautomations.tasks.sweep_due_automations": {"queue": "ai.automations"},
}


STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

PUBLIC_BASE_URL = env(
    "PUBLIC_BASE_URL",
    default=BACKEND_PUBLIC_URL,
)
MEDIA_URL_ABSOLUTE = f"{PUBLIC_BASE_URL.rstrip('/')}{MEDIA_URL}"


# Admin uploads: base64-encoded images in JSON bodies and multipart files
# both count against these limits. Defaults (2.5MB) are too small for
# product galleries that carry several base64 images per save.
DATA_UPLOAD_MAX_MEMORY_SIZE = env.int(
    "DATA_UPLOAD_MAX_MEMORY_SIZE",
    default=50 * 1024 * 1024,  # 50 MB
)
FILE_UPLOAD_MAX_MEMORY_SIZE = env.int(
    "FILE_UPLOAD_MAX_MEMORY_SIZE",
    default=50 * 1024 * 1024,  # 50 MB
)
DATA_UPLOAD_MAX_NUMBER_FIELDS = env.int(
    "DATA_UPLOAD_MAX_NUMBER_FIELDS",
    default=10000,
)


STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

if env.bool("USE_S3"):
    from storages.backends.s3 import S3Storage as _BaseS3Storage

    class B2Storage(_BaseS3Storage):
        """S3Storage subclass tuned for Backblaze B2.

        B2 closes the connection when it sees the `Expect: 100-continue`
        header that botocore adds to PutObject requests. This subclass
        strips that header on every outbound S3 request via the
        `before-send` event hook.
        """

        def __init__(self, **settings):
            super().__init__(**settings)

            client = None
            conn = self.connection
            for attr in ("client", "_client"):
                candidate = getattr(conn, attr, None)
                if candidate is not None and hasattr(candidate, "meta"):
                    client = candidate
                    break

            if client is not None:
                def _remove_expect(request, **kwargs):
                    request.headers.pop("Expect", None)

                client.meta.events.register("before-send.s3.*", _remove_expect)

    _required_s3 = ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_STORAGE_BUCKET_NAME")
    _missing = [k for k in _required_s3 if not env(k, default="")]
    if _missing:
        raise ImproperlyConfigured(
            f"USE_S3=True but missing: {', '.join(_missing)}"
        )
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default="") or None
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = env.bool("AWS_QUERYSTRING_AUTH", default=False)

    _s3_options = {
        "bucket_name": AWS_STORAGE_BUCKET_NAME,
        "region_name": AWS_S3_REGION_NAME,
        "access_key": AWS_ACCESS_KEY_ID,
        "secret_key": AWS_SECRET_ACCESS_KEY,
        "file_overwrite": AWS_S3_FILE_OVERWRITE,
        "default_acl": AWS_DEFAULT_ACL,
        "querystring_auth": AWS_QUERYSTRING_AUTH,
        "client_config": Config(
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    }
    if AWS_S3_ENDPOINT_URL:
        _s3_options["endpoint_url"] = AWS_S3_ENDPOINT_URL

    STORAGES["default"] = {
        "BACKEND": "config.settings.B2Storage",
        "OPTIONS": _s3_options,
    }

    _media_public_url = env("MEDIA_URL", default="")
    if not _media_public_url:
        _media_public_url = (
            f"https://{AWS_STORAGE_BUCKET_NAME}.s3."
            f"{AWS_S3_REGION_NAME}.amazonaws.com/"
        )
    MEDIA_URL = _media_public_url.rstrip("/") + "/"
    MEDIA_URL_ABSOLUTE = MEDIA_URL


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


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


WHATSAPP_ENABLED = env("WHATSAPP_ENABLED")
WHATSAPP_DRY_RUN = env("WHATSAPP_DRY_RUN")

META_APP_ID = env("META_APP_ID")
META_APP_SECRET = env("META_APP_SECRET")
META_GRAPH_API_VERSION = env("META_GRAPH_API_VERSION")
META_GRAPH_BASE_URL = f"https://graph.facebook.com/{META_GRAPH_API_VERSION}"

WHATSAPP_WABA_ID = env("WHATSAPP_WABA_ID")
WHATSAPP_PHONE_NUMBER_ID = env("WHATSAPP_PHONE_NUMBER_ID")
WHATSAPP_DISPLAY_PHONE = env("WHATSAPP_DISPLAY_PHONE")
WHATSAPP_BUSINESS_NAME = env("WHATSAPP_BUSINESS_NAME")
WHATSAPP_ACCESS_TOKEN = env("WHATSAPP_ACCESS_TOKEN")
WHATSAPP_TOKEN_EXPIRES_AT = env("WHATSAPP_TOKEN_EXPIRES_AT")
WHATSAPP_VERIFY_TOKEN = env("WHATSAPP_VERIFY_TOKEN")
WHATSAPP_WEBHOOK_PATH = env("WHATSAPP_WEBHOOK_PATH")

WHATSAPP_CART_CHECKOUT_URL = env("WHATSAPP_CART_CHECKOUT_URL")
WHATSAPP_CART_TOKEN_TTL_HOURS = env("WHATSAPP_CART_TOKEN_TTL_HOURS")
WHATSAPP_HANDOFF_RATE_LIMIT = env("WHATSAPP_HANDOFF_RATE_LIMIT")
WHATSAPP_HANDOFF_RATE_WINDOW = env("WHATSAPP_HANDOFF_RATE_WINDOW")
WHATSAPP_BUSINESS_NUMBER_FALLBACK = env("WHATSAPP_BUSINESS_NUMBER_FALLBACK")
WHATSAPP_FALLBACK_IMAGE_URL = env("WHATSAPP_FALLBACK_IMAGE_URL")

WHATSAPP_TEMPLATES = {
    "CART_RECOVERY": env("WHATSAPP_TPL_CART_RECOVERY"),
    "ORDER_CONFIRMATION": env("WHATSAPP_TPL_ORDER_CONFIRMATION"),
    "SHIPPING_UPDATE": env("WHATSAPP_TPL_SHIPPING_UPDATE"),
    "ORDER_DELIVERED": env("WHATSAPP_TPL_ORDER_DELIVERED"),
    "PAYMENT_REMINDER": env("WHATSAPP_TPL_PAYMENT_REMINDER"),
    "VERIFY_NUMBER": env("WHATSAPP_TPL_VERIFY_NUMBER"),
}
WHATSAPP_DEFAULT_TEMPLATE_LANG = env("WHATSAPP_TPL_DEFAULT_LANG")
WHATSAPP_DEFAULT_TEMPLATE_COUNTRY = env("WHATSAPP_TPL_DEFAULT_COUNTRY")

WHATSAPP_SERVICE_WINDOW_HOURS = env("WHATSAPP_SERVICE_WINDOW_HOURS")
WHATSAPP_OTP_TTL_MINUTES = env("WHATSAPP_OTP_TTL_MINUTES")
WHATSAPP_OTP_MAX_ATTEMPTS = env("WHATSAPP_OTP_MAX_ATTEMPTS")
WHATSAPP_OTP_RATE_LIMIT = env("WHATSAPP_OTP_RATE_LIMIT")

WHATSAPP_RATES_USD = {
    "UTILITY": env("WHATSAPP_RATE_UTILITY_USD"),
    "MARKETING": env("WHATSAPP_RATE_MARKETING_USD"),
    "AUTHENTICATION": env("WHATSAPP_RATE_AUTH_USD"),
    "SERVICE": 0.0,
}
WHATSAPP_USD_TO_KES = env("WHATSAPP_USD_TO_KES")
WHATSAPP_FREE_SERVICE_CONVERSATIONS = env("WHATSAPP_FREE_SERVICE_CONVERSATIONS")
WHATSAPP_MONTHLY_SPEND_ALERT_KES = env("WHATSAPP_MONTHLY_SPEND_ALERT_KES")
WHATSAPP_QUALITY_SCORE_ALERT = env("WHATSAPP_QUALITY_SCORE_ALERT")

FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY")


SOCIAL_ENABLED = env("SOCIAL_ENABLED")
SOCIAL_DRY_RUN = env("SOCIAL_DRY_RUN")

SOCIAL_OAUTH_REDIRECT_BASE = env("SOCIAL_OAUTH_REDIRECT_BASE")
SOCIAL_ADMIN_UI_URL = env("SOCIAL_ADMIN_UI_URL")

SOCIAL_METRICS_SYNC_INTERVAL_MINUTES = env("SOCIAL_METRICS_SYNC_INTERVAL_MINUTES")
SOCIAL_MAX_MEDIA_PER_POST = env("SOCIAL_MAX_MEDIA_PER_POST")
SOCIAL_MAX_MEDIA_SIZE_MB = env("SOCIAL_MAX_MEDIA_SIZE_MB")

SOCIAL_OAUTH_REDIRECTS = {
    "FACEBOOK": f"{SOCIAL_OAUTH_REDIRECT_BASE.rstrip('/')}/api/v1/social/oauth/facebook/callback/",
    "INSTAGRAM": f"{SOCIAL_OAUTH_REDIRECT_BASE.rstrip('/')}/api/v1/social/oauth/instagram/callback/",
    "TIKTOK": f"{SOCIAL_OAUTH_REDIRECT_BASE.rstrip('/')}/api/v1/social/oauth/tiktok/callback/",
    "YOUTUBE": env("YOUTUBE_REDIRECT_URI", default=""),
}

FACEBOOK_PAGE_ID = env("FACEBOOK_PAGE_ID")
FACEBOOK_PAGE_ACCESS_TOKEN = env("FACEBOOK_PAGE_ACCESS_TOKEN")
INSTAGRAM_BUSINESS_ACCOUNT_ID = env("INSTAGRAM_BUSINESS_ACCOUNT_ID")
META_SOCIAL_SCOPES = env.list("META_SOCIAL_SCOPES")

TIKTOK_CLIENT_KEY = env("TIKTOK_CLIENT_KEY")
TIKTOK_CLIENT_SECRET = env("TIKTOK_CLIENT_SECRET")
TIKTOK_SCOPES = env.list("TIKTOK_SCOPES")

YOUTUBE_REDIRECT_URI = env("YOUTUBE_REDIRECT_URI", default="")
YOUTUBE_SCOPES = env.list("YOUTUBE_SCOPES", default=[])


BANNERS_ENABLED = env.bool("BANNERS_ENABLED", default=True)
BANNERS_HERO_CACHE_SECONDS = env.int("BANNERS_HERO_CACHE_SECONDS", default=60)
BANNERS_MAX_DESKTOP_UPLOAD_MB = env.int("BANNERS_MAX_DESKTOP_UPLOAD_MB", default=8)
BANNERS_MAX_MOBILE_UPLOAD_MB = env.int("BANNERS_MAX_MOBILE_UPLOAD_MB", default=4)


AI_PROVIDER = env("AI_PROVIDER")
AI_MODEL = env("AI_MODEL")
AI_BASE_URL = env("AI_BASE_URL")
AI_MAX_TOOL_ITERATIONS = env("AI_MAX_TOOL_ITERATIONS")
AI_HISTORY_TURNS = env("AI_HISTORY_TURNS")

AI_KEY_ENC_KEY = env("AI_KEY_ENC_KEY") or SECRET_KEY

GROQ_API_KEY = env("GROQ_API_KEY")
OPENAI_API_KEY = env("OPENAI_API_KEY")
GEMINI_API_KEY = env("GEMINI_API_KEY")
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY")
XAI_API_KEY = env("XAI_API_KEY")

OPENROUTER_API_KEY = env("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = env("OPENROUTER_BASE_URL")
OPENROUTER_MODEL = env("OPENROUTER_MODEL")
OPENROUTER_HTTP_REFERER = env("OPENROUTER_HTTP_REFERER")
OPENROUTER_X_TITLE = env("OPENROUTER_X_TITLE")
OPENROUTER_MONTHLY_BUDGET_KES = env("OPENROUTER_MONTHLY_BUDGET_KES")


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
        "whatsapp": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "whatsapp.webhook": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "social": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "social.oauth": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "social.publish": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "social.metrics": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "banners": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "banners.tasks": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "checkout": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "checkout.tasks": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "dashboard.aiautomations": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "dashboard.aiautomations.services": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "dashboard.aiautomations.tools": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "dashboard.aiautomations.dispatch": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "dashboard.users": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "dashboard.users.tasks": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "dashboard.analytics": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "dashboard.analytics.middleware": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "WARNING",
            "propagate": False,
        },
        "authentication": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "authentication.views": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "authentication.google": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}


ANALYTICS_PAGEVIEW_ENABLED = env.bool("ANALYTICS_PAGEVIEW_ENABLED", default=True)

ANALYTICS_PAGEVIEW_SKIP_PREFIXES = env.list(
    "ANALYTICS_PAGEVIEW_SKIP_PREFIXES",
    default=["/admin", "/static", "/media", "/api", "/_next", "/favicon"],
)

ANALYTICS_PAGEVIEW_RETENTION_DAYS = env.int(
    "ANALYTICS_PAGEVIEW_RETENTION_DAYS",
    default=90,
)


AUTH_STRATEGY = env("AUTH_STRATEGY")

# ⚠️ WARNING: This second LOGGING block overrides the LOGGING defined
# above. That means the `authentication.google` and other per-app
# loggers above will NOT be active while this block is present.
# It's here because you asked to keep all code. Delete this whole
# block once you have finished debugging the Google OAuth redirect.
# TEMPORARY DEBUG LOGGING — remove after fixing
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": "DEBUG",
    },
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}