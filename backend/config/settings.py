"""
Django settings for config project.
"""

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

    # Local
    "authentication",
    "checkout",
    "account",
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
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 7 days
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

CSRF_COOKIE_HTTPONLY = False  # frontend reads it for the X-CSRFToken header
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")


# ─────────────────────────────────────────────────────────────────────────────
# Cache (used by django-ratelimit)
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
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Myshop API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}


# ─────────────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# The default_headers tuple already contains most of what DRF needs, but
# custom headers sent by the frontend must be listed here or the browser
# will silently drop the request after a successful OPTIONS preflight.
CORS_ALLOW_HEADERS = (
    *default_headers,           # accept, accept-encoding, authorization,
                                # content-type, dnt, origin, user-agent,
                                # x-csrftoken, x-requested-with
    "idempotency-key",          # checkout stk-push idempotency
)


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth
# ─────────────────────────────────────────────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default="")
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET", default="")
GOOGLE_OAUTH_REDIRECT_URI = env(
    "GOOGLE_OAUTH_REDIRECT_URI",
    default="http://localhost:8000/api/v1/auth/google/callback/",
)


# ─────────────────────────────────────────────────────────────────────────────
# Email
# ─────────────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = env("EMAIL_BACKEND")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

ANYMAIL = {
    "MAILGUN_API_KEY": env("ANYMAIL_MAILGUN_API_KEY", default=""),
    "MAILGUN_SENDER_DOMAIN": env("ANYMAIL_MAILGUN_SENDER_DOMAIN", default=""),
}


# ─────────────────────────────────────────────────────────────────────────────
# Frontend
# ─────────────────────────────────────────────────────────────────────────────
FRONTEND_URL = env("FRONTEND_URL")


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
}


# ─────────────────────────────────────────────────────────────────────────────
# Static / media
# ─────────────────────────────────────────────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

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
MPESA_ENV = env("MPESA_ENV")                          # "sandbox" | "production"
MPESA_CONSUMER_KEY = env("MPESA_CONSUMER_KEY")
MPESA_CONSUMER_SECRET = env("MPESA_CONSUMER_SECRET")
MPESA_SHORTCODE = env("MPESA_SHORTCODE")              # Paybill / Till number
MPESA_PASSKEY = env("MPESA_PASSKEY")                  # Daraja passkey
MPESA_CALLBACK_URL = env("MPESA_CALLBACK_URL")        # public HTTPS
MPESA_TIMEOUT_URL = env("MPESA_TIMEOUT_URL")          # public HTTPS
MPESA_TRANSACTION_TYPE = env("MPESA_TRANSACTION_TYPE")

# Daraja base URLs — picked by MPESA_ENV, no need to configure per-environment.
if MPESA_ENV == "production":
    MPESA_BASE_URL = "https://api.safaricom.co.ke"
else:
    MPESA_BASE_URL = "https://sandbox.safaricom.co.ke"

# Seconds before a PROCESSING payment is swept to TIMEOUT.
CHECKOUT_TIMEOUT_SECONDS = env("CHECKOUT_TIMEOUT_SECONDS")

# ── Server-side pricing constants ──
# These MUST mirror what the frontend previews. The server is authoritative:
# at checkout, totals are recomputed here and compared against the client's.
TAX_RATE = Decimal("0.16")
FREE_DELIVERY_THRESHOLD = Decimal("5000")
DELIVERY_FEES = {
    "express": Decimal("500"),
    "standard": Decimal("300"),
    "pickup": Decimal("0"),
}
DEFAULT_CURRENCY = "KES"

# ── Kenyan counties ──
# Kept in settings (not a model) because the list is stable and there's no
# admin UI for it yet. Promote to a model when it starts changing.
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