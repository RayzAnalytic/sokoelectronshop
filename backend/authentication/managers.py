from django.contrib.auth.models import BaseUserManager


# ══════════════════════════════════════════════════════════════════════════
# Phone normalization
# ══════════════════════════════════════════════════════════════════════════
#
# The frontend accepts phones in a loose format: "+254 712 345 678",
# "0712345678", "(0722) 887-991", etc. Before it hits the DB, we strip
# everything except digits and a leading "+". This guarantees that
# "+254 712 345 678" and "+254712345678" can't coexist as two rows,
# and that the unique constraint on phone actually does its job.
#
# We do NOT guess a country code here — a user in the UK entering
# "0712345678" should not silently become a Kenyan number. If you later
# want to default to +254 for bare "07..." numbers, do it in the
# serializer where you have request context, not here.

def normalize_phone(phone: str | None) -> str:
    if not phone:
        return ""
    raw = phone.strip()
    has_plus = raw.startswith("+")
    digits = "".join(ch for ch in raw if ch.isdigit())
    return f"+{digits}" if has_plus else digits


# ══════════════════════════════════════════════════════════════════════════
# Manager
# ══════════════════════════════════════════════════════════════════════════

class UserManager(BaseUserManager):
    """
    Manager for the custom, email-identified User model.

    Key guarantees:

      * `email` is required and normalized (lowercased, domain
        normalized) before hitting the DB — so `Foo@Example.com` and
        `foo@example.com` can't coexist as two rows.
      * `phone` is normalized to digits (+ optional leading `+`) so the
        unique constraint on non-empty phones actually holds.
      * `create_user` defaults to CUSTOMER / ACTIVE / non-staff.
      * `create_staff` is a dedicated path for invite acceptance —
        callers cannot accidentally create a STAFF user with
        `is_superuser=True`.
      * `create_superuser` FORCES OWNER / ACTIVE / is_staff /
        is_superuser / is_email_verified — a caller cannot accidentally
        (or maliciously) downgrade a superuser to CUSTOMER by passing
        `role="CUSTOMER"`.
      * `use_in_migrations = True` so data migrations can reconstruct
        historical rows using this manager's logic.

    NOTE ON IMPORTS:
        `Role` and `Status` live in `models.py`, which imports this
        module at the top. Importing them here at module scope would
        create a circular import (`models` → `managers` → `models`).
        We therefore import them lazily inside the methods that need
        them — those run at call time, after `models.py` has finished
        loading.
    """

    use_in_migrations = True

    # ── Internal ──
    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()

        # Normalize phone if the caller passed one.
        if "phone" in extra:
            extra["phone"] = normalize_phone(extra.get("phone"))

        user = self.model(email=email, **extra)

        if password:
            user.set_password(password)
        else:
            # An account with no usable password can't log in via the
            # password form. Google OAuth still works, since it bypasses
            # the password check entirely.
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    # ── Public API ──
    def create_user(self, email, password=None, **extra):
        """
        Create a regular user. Defaults to a CUSTOMER, but honours an
        explicitly-passed `role` — this is what lets seeding code do
        `create_user(..., role=Role.STAFF)` without reaching for
        `create_superuser`.

        Prefer `create_staff` for the invite-acceptance flow (see below):
        it hard-codes the invariants that a STAFF account should have.
        """
        from .models import Role, Status  # lazy import — see class docstring

        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        extra.setdefault("role", Role.CUSTOMER)
        extra.setdefault("status", Status.ACTIVE)
        return self._create_user(email, password, **extra)

    def create_staff(self, email, password, *, invited_by=None, **extra):
        """
        Create a STAFF (or OWNER) account via the invite-acceptance flow.

        Enforces the invariants that the accept-invite view depends on:

          * Role is either STAFF or OWNER. A caller cannot pass
            `role=CUSTOMER` here — that path goes through `create_user`.
          * `is_superuser` is always False. Superuser is reserved for
            `create_superuser` (bootstrap / recovery only).
          * `is_staff` is True, so Django admin access works out of the
            box (subject to `role`-based permissions elsewhere).
          * `invited_by` is recorded.
          * `is_email_verified` defaults to True — the invite was sent to
            a verified address; the person proved ownership by clicking
            the link.

        Raises ValueError if the role isn't an admin role.
        """
        from .models import Role, Status  # lazy import — see class docstring

        role = extra.get("role", Role.STAFF)
        if role not in (Role.STAFF, Role.OWNER):
            raise ValueError(
                f"create_staff only supports STAFF or OWNER roles, got {role!r}"
            )

        extra["role"] = role
        extra["is_staff"] = True
        extra["is_superuser"] = False
        extra["status"] = extra.get("status", Status.ACTIVE)
        extra.setdefault("is_email_verified", True)
        extra["invited_by"] = invited_by

        if not password:
            raise ValueError("Staff accounts must have a password.")

        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password, **extra):
        """
        Create an OWNER with all flags set.

        The Django convention is that `create_superuser` receives
        `is_staff` and `is_superuser` from the CLI (`createsuperuser`
        passes them as True). We force them here instead of trusting
        the caller, so no code path — including a compromised shell
        script — can create a login that is simultaneously
        `is_superuser=True` and `role=CUSTOMER`.
        """
        from .models import Role, Status  # lazy import — see class docstring

        # Hard-override: caller cannot pass these.
        extra["is_staff"] = True
        extra["is_superuser"] = True
        extra["role"] = Role.OWNER
        extra["status"] = Status.ACTIVE
        extra["is_email_verified"] = True

        # Guard against a caller thinking they can create a superuser
        # with no password. `createsuperuser` always prompts, but the
        # programmatic path could be misused.
        if not password:
            raise ValueError("Superusers must have a password.")

        return self._create_user(email, password, **extra)

    # ── Lookup helpers ──
    def get_by_email(self, email):
        """Case-insensitive lookup — safe because email is stored lowercased."""
        if not email:
            return None
        return self.filter(email=self.normalize_email(email).lower()).first()

    def email_exists(self, email) -> bool:
        return self.filter(email=self.normalize_email(email).lower()).exists()

    def phone_exists(self, phone) -> bool:
        """
        Returns False for empty/blank phones. The serializer should treat
        "no phone provided" as not-taken, not as a collision.
        """
        normalized = normalize_phone(phone)
        if not normalized:
            return False
        return self.filter(phone=normalized).exists()