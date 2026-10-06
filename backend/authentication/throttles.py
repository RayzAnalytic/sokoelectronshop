from rest_framework.throttling import AnonRateThrottle


# ══════════════════════════════════════════════════════════════════════════
# Core auth throttles
# ══════════════════════════════════════════════════════════════════════════

class LoginThrottle(AnonRateThrottle):
    """
    Anonymous-only throttle for POST /auth/login/.

    Keyed by client IP (DRF's default for AnonRateThrottle). Backs off
    once the `login` scope is exceeded so credential-stuffing attempts
    against the same IP get slower.

    Scope rate (settings.REST_FRAMEWORK.DEFAULT_THROTTLE_RATES):
        login = "5/min"
    """
    scope = "login"


class PasswordResetThrottle(AnonRateThrottle):
    """
    Anonymous-only throttle for the forgot/reset password endpoints.

    Protects the mailer from being turned into a spam cannon and slows
    enumeration attempts via /forgot-password/.

    Applied to three endpoints:
        POST /auth/forgot-password/     — generates + emails the token
        GET  /auth/verify-reset-token/  — cheap but still worth capping
        POST /auth/reset-password/      — consumes the token

    They share one scope so the total number of reset-related requests
    from a single IP per hour is bounded, regardless of which endpoint
    the attacker hammers.

    Scope rate:
        password_reset = "3/hour"
    """
    scope = "password_reset"


class RegisterThrottle(AnonRateThrottle):
    """
    Anonymous-only throttle for POST /auth/register/.

    Without this, a script could flood the users table with throwaway
    CUSTOMER rows from a single IP. Tight scope because real users
    register once.

    Scope rate (must be added to settings — see note below):
        register = "5/hour"
    """
    scope = "register"


# ══════════════════════════════════════════════════════════════════════════
# Staff invite throttles
# ══════════════════════════════════════════════════════════════════════════

class InviteVerifyThrottle(AnonRateThrottle):
    """
    Anonymous-only throttle for GET /auth/invite/verify/.

    The endpoint is public by design (the token is the auth), but it
    accepts a token as a query param — a brute-force attempt could try
    random tokens. The tokens are 256-bit random so guessing is
    infeasible, but capping this anyway keeps a scanner from generating
    log noise and DB load.

    Scope rate:
        invite_verify = "30/hour"
    """
    scope = "invite_verify"


class InviteAcceptThrottle(AnonRateThrottle):
    """
    Anonymous-only throttle for POST /auth/invite/accept/.

    Tighter than verify because accept writes to the DB (creates a
    User, marks the invite accepted). Even with a valid token, a
    malicious script shouldn't be able to spam this endpoint.

    Scope rate:
        invite_accept = "10/hour"
    """
    scope = "invite_accept"