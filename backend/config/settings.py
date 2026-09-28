# config/settings.py

from pathlib import Path
from datetime import timedelta
import environ

# ============================================================
# PATHS & ENVIRONMENT
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)

# Read .env file
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# ============================================================
# APPLICATION DEFINITION
# ============================================================
INSTALLED_APPS = [
    # ── Django core ──
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",  # required for allauth

    # ── Third-party ──
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # for logout + password reset
    "django_filters",
    "corsheaders",
    "django_extensions",
    "django_celery_beat",
    "django_celery_results",
    "phonenumber_field",
    "drf_spectacular",
    "storages",
    "anymail",
    "channels",

    # ── Auth stack ──
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    # --- Social Media Login Providers (optional, for user auth) ---
    # "allauth.socialaccount.providers.facebook",
    # "allauth.socialaccount.providers.twitter_oauth2",
    # "allauth.socialaccount.providers.instagram",
    "dj_rest_auth",
    "dj_rest_auth.registration",

    # ── Local apps ──
    "authentication",
    "onboarding",
    
]

# ── Custom User Model ──
# config/settings.py
AUTH_USER_MODEL = "authentication.User"

# ── Authentication Backends ──
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

# ── Middleware ──
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",  # required by allauth
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# ============================================================
# GOOGLE — SHARED CREDENTIALS
# ============================================================
GOOGLE_CLIENT_ID = env(
    "GOOGLE_CLIENT_ID",
    default=env("YOUTUBE_OAUTH2_CLIENT_ID", default=""),
)
GOOGLE_CLIENT_SECRET = env(
    "GOOGLE_CLIENT_SECRET",
    default=env("YOUTUBE_OAUTH2_CLIENT_SECRET", default=""),
)
GOOGLE_REDIRECT_URI = env(
    "GOOGLE_REDIRECT_URI",
    default="http://127.0.0.1:8000/accounts/google/login/callback/",
)
GOOGLE_PROJECT_ID = env("GOOGLE_PROJECT_ID", default="")
GOOGLE_API_KEY = env(
    "GOOGLE_API_KEY",
    default=env("YOUTUBE_API_KEY", default=""),
)

# ============================================================
# DJANGO-ALLAUTH — CORE
# ============================================================
SITE_ID = 1

LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"
LOGIN_URL = "/accounts/login/"

SOCIALACCOUNT_LOGIN_ON_GET = True

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": GOOGLE_CLIENT_ID,
            "secret": GOOGLE_CLIENT_SECRET,
            "key": "",
        },
        "SCOPE": [
            "profile",
            "email",
        ],
        "AUTH_PARAMS": {
            "access_type": "online",
            "prompt": "select_account",
        },
        "OAUTH_PKCE_ENABLED": True,
        "FETCH_USERINFO": True,
    },
    # "facebook": {
    #     "METHOD": "oauth2",
    #     "SCOPE": ["email", "public_profile"],
    #     "AUTH_PARAMS": {"auth_type": "reauthenticate"},
    #     "FIELDS": ["id", "email", "name", "first_name", "last_name"],
    #     "VERIFIED_EMAIL": False,
    #     "VERSION": "v13.0",
    # },
    # "twitter_oauth2": {
    #     "APP": {
    #         "client_id": env("X_CLIENT_ID", default=""),
    #         "secret": env("X_CLIENT_SECRET", default=""),
    #         "key": "",
    #     },
    #     "SCOPE": ["users.read", "tweet.read", "offline.access"],
    # },
    # "instagram": {
    #     "APP": {
    #         "client_id": env("INSTAGRAM_CLIENT_ID", default=""),
    #         "secret": env("INSTAGRAM_CLIENT_SECRET", default=""),
    #         "key": "",
    #     },
    #     "SCOPE": ["user_profile", "user_media"],
    # },
}

# ============================================================
# DJ-REST-AUTH
# ============================================================
REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_COOKIE": "auth-access",
    "JWT_AUTH_REFRESH_COOKIE": "auth-refresh",
    "JWT_AUTH_HTTPONLY": True,
    "JWT_AUTH_SECURE": not DEBUG,
    "JWT_AUTH_SAMESITE": "Lax",
    "SESSION_LOGIN": False,
    "TOKEN_MODEL": None,
    "USER_DETAILS_SERIALIZER": "authentication.serializers.auth_serializer.UserDetailSerializer",
}

# ============================================================
# ALLAUTH / DJ-REST-AUTH — ACCOUNT SETTINGS
# ============================================================
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = "email"
ACCOUNT_EMAIL_VERIFICATION = "optional"
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_LOGOUT_ON_GET = True

SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_VERIFICATION = "none"
SOCIALACCOUNT_EMAIL_REQUIRED = True
SOCIALACCOUNT_QUERY_EMAIL = True

# ============================================================
# TEMPLATES
# ============================================================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
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

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ============================================================
# DATABASE — SQLite (dev)
# ============================================================
# DATABASES = {
#     "default": {
#         "ENGINE": "django.db.backends.postgresql",
#         "NAME": env("DB_NAME", default=""),
#         "USER": env("DB_USER", default=""),
#         "PASSWORD": env("DB_PASSWORD", default=""),
#         "HOST": env("DB_HOST", default="localhost"),
#         "PORT": env("DB_PORT", default="5432"),
#     }
# }

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ============================================================
# PASSWORD VALIDATION
# ============================================================
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ============================================================
# INTERNATIONALIZATION
# ============================================================
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ============================================================
# STATIC & MEDIA
# ============================================================
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ============================================================
# DJANGO REST FRAMEWORK
# ============================================================
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
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/day",
        "user": "1000/day",
        # Auth-specific throttles
        "login": "10/min",
        "register": "5/hour",
        "password_reset": "5/hour",
        "password_reset_email": "3/hour",
        "password_reset_validate": "60/hour",
        # Payment-specific throttles
        "payment_initiate": "20/hour",
        # Social media throttles
        "social_post": "30/hour",
        "social_read": "100/hour",
        # WhatsApp throttles
        "whatsapp_send": "100/hour",
        # Onboarding throttles
        "onboarding": "200/hour",
        # Team throttles
        "team_invite": "30/hour",
    },
}

# ============================================================
# JWT (SimpleJWT)
# ============================================================
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ============================================================
# CORS
# ============================================================
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)
CORS_ALLOW_CREDENTIALS = True

# ============================================================
# REDIS + CACHE
# ============================================================
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://127.0.0.1:6379/1"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

# ============================================================
# CELERY
# ============================================================
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = "django-db"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# ============================================================
# CHANNELS (WebSockets)
# ============================================================
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://127.0.0.1:6379/2")],
        },
    },
}

# ============================================================
# STORAGE (S3 / Local)
# ============================================================
USE_S3 = env.bool("USE_S3", default=False)

if USE_S3:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")
    AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"
    AWS_DEFAULT_ACL = "public-read"
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}

    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    STATICFILES_STORAGE = "storages.backends.s3boto3.S3StaticStorage"

# ============================================================
# EMAIL (Anymail)
# ============================================================
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
ANYMAIL = {
    "MAILGUN_API_KEY": env("MAILGUN_API_KEY", default=""),
    "MAILGUN_SENDER_DOMAIN": env("MAILGUN_SENDER_DOMAIN", default=""),
}
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@example.com")
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# ============================================================
# FRONTEND
# ============================================================
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")

# ============================================================
# PHONE NUMBERS
# ============================================================
PHONENUMBER_DEFAULT_REGION = env("PHONENUMBER_DEFAULT_REGION", default="KE")
PHONENUMBER_DB_FORMAT = "E164"

# ============================================================
# PASSWORD RESET
# ============================================================
PASSWORD_RESET_TIMEOUT = 60 * 60 * 24  # 24 hours

# ============================================================
# PAYMENTS — M-PESA ONLY
# ============================================================
PAYMENT_CURRENCY = env("PAYMENT_CURRENCY", default="KES")
PAYMENT_COUNTRY = env("PAYMENT_COUNTRY", default="KE")
PAYMENT_METHODS = env.list(
    "PAYMENT_METHODS",
    default=["mpesa"],
)

# --- M-Pesa (Safaricom Daraja) ---
MPESA_CONSUMER_KEY = env("MPESA_CONSUMER_KEY", default="")
MPESA_CONSUMER_SECRET = env("MPESA_CONSUMER_SECRET", default="")
MPESA_SHORTCODE = env("MPESA_SHORTCODE", default="")
MPESA_PASSKEY = env("MPESA_PASSKEY", default="")
MPESA_CALLBACK_URL = env("MPESA_CALLBACK_URL", default="")
MPESA_BASE_URL = env(
    "MPESA_BASE_URL",
    default="https://sandbox.safaricom.co.ke",
)
MPESA_ENVIRONMENT = env("MPESA_ENVIRONMENT", default="sandbox")  # sandbox | production
MPESA_TRANSACTION_TYPE = env(
    "MPESA_TRANSACTION_TYPE",
    default="CustomerPayBillOnline",
)

# ============================================================
# WHATSAPP BUSINESS CLOUD API
# ============================================================
WHATSAPP_ACCESS_TOKEN = env("WHATSAPP_ACCESS_TOKEN", default="")
WHATSAPP_PHONE_NUMBER_ID = env("WHATSAPP_PHONE_NUMBER_ID", default="")
WHATSAPP_BUSINESS_ACCOUNT_ID = env("WHATSAPP_BUSINESS_ACCOUNT_ID", default="")
WHATSAPP_APP_SECRET = env("WHATSAPP_APP_SECRET", default="")
WHATSAPP_VERIFY_TOKEN = env("WHATSAPP_VERIFY_TOKEN", default="")
WHATSAPP_API_VERSION = env("WHATSAPP_API_VERSION", default="v22.0")
WHATSAPP_BASE_URL = env("WHATSAPP_BASE_URL", default="https://graph.facebook.com")
WHATSAPP_BUSINESS_NUMBER = env("WHATSAPP_BUSINESS_NUMBER", default="")

# ============================================================
# SOCIAL MEDIA MANAGEMENT — API CREDENTIALS
# ============================================================

# --- Google / YouTube (Google Cloud Console) ---
YOUTUBE_API_KEY = env(
    "YOUTUBE_API_KEY",
    default=GOOGLE_API_KEY,
)
YOUTUBE_OAUTH2_CLIENT_ID = env(
    "YOUTUBE_OAUTH2_CLIENT_ID",
    default=GOOGLE_CLIENT_ID,
)
YOUTUBE_OAUTH2_CLIENT_SECRET = env(
    "YOUTUBE_OAUTH2_CLIENT_SECRET",
    default=GOOGLE_CLIENT_SECRET,
)
YOUTUBE_OAUTH2_CALLBACK_URL = env(
    "YOUTUBE_OAUTH2_CALLBACK_URL",
    default="http://127.0.0.1:8000/api/social/youtube/callback/",
)
YOUTUBE_SCOPES = env.list(
    "YOUTUBE_SCOPES",
    default=[
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
)
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"
YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3"

# --- X / Twitter (Developer Portal) ---
X_CLIENT_ID = env("X_CLIENT_ID", default="")
X_CLIENT_SECRET = env("X_CLIENT_SECRET", default="")
X_BEARER_TOKEN = env("X_BEARER_TOKEN", default="")
X_API_KEY = env("X_API_KEY", default="")
X_API_SECRET = env("X_API_SECRET", default="")
X_ACCESS_TOKEN = env("X_ACCESS_TOKEN", default="")
X_ACCESS_TOKEN_SECRET = env("X_ACCESS_TOKEN_SECRET", default="")

# --- Facebook & Instagram (Meta for Developers) ---
FACEBOOK_PAGE_ACCESS_TOKEN = env("FACEBOOK_PAGE_ACCESS_TOKEN", default="")
FACEBOOK_APP_ID = env("FACEBOOK_APP_ID", default="")
FACEBOOK_APP_SECRET = env("FACEBOOK_APP_SECRET", default="")
INSTAGRAM_BUSINESS_ACCOUNT_ID = env("INSTAGRAM_BUSINESS_ACCOUNT_ID", default="")
INSTAGRAM_CLIENT_ID = env("INSTAGRAM_CLIENT_ID", default="")
INSTAGRAM_CLIENT_SECRET = env("INSTAGRAM_CLIENT_SECRET", default="")
INSTAGRAM_ACCESS_TOKEN = env("INSTAGRAM_ACCESS_TOKEN", default="")

# --- TikTok Shop (Partner Center) ---
TIKTOK_SHOP_APP_KEY = env("TIKTOK_SHOP_APP_KEY", default="")
TIKTOK_SHOP_APP_SECRET = env("TIKTOK_SHOP_APP_SECRET", default="")
TIKTOK_SHOP_SERVICE_ID = env("TIKTOK_SHOP_SERVICE_ID", default="")
TIKTOK_SHOP_ACCESS_TOKEN = env("TIKTOK_SHOP_ACCESS_TOKEN", default="")
TIKTOK_SHOP_SHOP_CIPHER = env("TIKTOK_SHOP_SHOP_CIPHER", default="")
TIKTOK_SHOP_BASE_URL = env(
    "TIKTOK_SHOP_BASE_URL",
    default="https://open-api.tiktokglobalshop.com",
)
TIKTOK_SHOP_AUTH_BASE_URL = env(
    "TIKTOK_SHOP_AUTH_BASE_URL",
    default="https://auth.tiktok-shops.com",
)
TIKTOK_SHOP_REDIRECT_URI = env(
    "TIKTOK_SHOP_REDIRECT_URI",
    default="http://127.0.0.1:8000/api/social/tiktok/callback/",
)

# ============================================================
# API DOCUMENTATION (drf-spectacular)
# ============================================================
SPECTACULAR_SETTINGS = {
    "TITLE": "Your API",
    "DESCRIPTION": "API documentation",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ============================================================
# RATE LIMITING
# ============================================================
RATELIMIT_USE_CACHE = "default"
RATELIMIT_ENABLE = True

# ============================================================
# LOGGING
# ============================================================
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose" if DEBUG else "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "payments": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "social_media": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "whatsapp": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "onboarding": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "catalog": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "team": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# ============================================================
# SECURITY (production only)
# ============================================================
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")