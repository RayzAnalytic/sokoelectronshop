from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role, Status


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────
class _ActiveBase(BasePermission):
    """
    Every role gate requires:
      * an authenticated user,
      * is_active == True,
      * status == ACTIVE.

    SUSPENDED and PENDING accounts are rejected even if they hold the
    right role — this is the choke point that keeps a suspended user
    from doing anything with a still-valid session cookie.

    PENDING is not a bug: it's the state a freshly-registered customer
    sits in until they enter the email verification code. Excluding it
    here is what makes "unverified users can't do anything except
    verify" a property of the whole permission layer rather than a
    rule every view has to remember. The one deliberate exception is
    IsPendingVerification, which is scoped to the verify endpoints.

    `is_active` is enforced by Django's auth backend on session load
    (returns AnonymousUser if False), but we check it here too — cheap,
    and it catches the case where a user object was cached in memory
    before the flag flipped.
    """

    message = "Your account is not active."

    def _ok(self, user) -> bool:
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_active", True)
            and getattr(user, "status", None) == Status.ACTIVE
        )


# ─────────────────────────────────────────────────────────────────────────────
# Role gates
# ─────────────────────────────────────────────────────────────────────────────
class IsOwner(_ActiveBase):
    """OWNER only — the highest privilege tier."""

    message = "Owner access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.OWNER


class IsOwnerOrStaff(_ActiveBase):
    """OWNER or STAFF — the admin panel tier."""

    message = "Admin access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role in (Role.OWNER, Role.STAFF)


class IsStaffOnly(_ActiveBase):
    """
    STAFF only, excluding OWNER.

    Useful when an action must not be performable by the owner account
    itself (e.g. audit-visible changes that require a second pair of
    hands). Add this only if you actually have such a rule — otherwise
    it's dead code.
    """

    message = "Staff access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.STAFF


class IsCustomer(_ActiveBase):
    """CUSTOMER only — storefront self-service."""

    message = "Customer access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.CUSTOMER


class IsAdminRole(_ActiveBase):
    """
    Alias that mirrors `User.is_admin_role` on the model.

    Prefer this over importing IsOwnerOrStaff when the check is really
    "is this an admin-tier user" and you don't want the permission name
    to drift if a third admin role is added later.
    """

    message = "Admin access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.is_admin_role


# ─────────────────────────────────────────────────────────────────────────────
# Email verification gates
# ─────────────────────────────────────────────────────────────────────────────
class IsPendingVerification(BasePermission):
    """
    The narrow exception to _ActiveBase.

    Allow a signed-in user whose account is *awaiting* email
    verification to reach the verification endpoints and nothing else.

    Applies only when ALL of:
      * authenticated,
      * is_active (Django-disabled accounts are rejected),
      * status is PENDING or ACTIVE (SUSPENDED is rejected),
      * is_email_verified is False.

    Why PENDING *or* ACTIVE, rather than just PENDING
    ─────────────────────────────────────────────────
    The obvious check — `status == Status.PENDING` — breaks idempotent
    verification. `User.mark_email_verified()` flips `status` to ACTIVE
    in the same call that sets `is_email_verified = True`. So:

        1. Customer is PENDING + unverified. They enter the code.
           VerifyEmailSerializer.save() calls mark_email_verified().
           Status flips to ACTIVE, is_email_verified becomes True.
        2. The customer double-clicks Verify, or the tab restores,
           or they hit browser back and resubmit.

    With `status == PENDING`, step 2 is rejected by this permission
    before VerifyEmailSerializer can return its idempotent-success
    response. The frontend sees a 403 for what is really "already
    done, no-op".

    The corrected predicate treats `is_email_verified` as the sole
    source of truth for "does this account still need to verify" and
    consults `status` only to exclude accounts the system has frozen
    (SUSPENDED). It also makes the endpoint tolerant of the ACTIVE +
    unverified combination, which can arise from an admin path that
    set status directly, a data migration, or any manual DB edit —
    such an account *should* be allowed to fix the missing flag.

    Use on:
      * POST /auth/verify-email/
      * POST /auth/resend-verification/

    Do NOT use this on anything else. It exists so the register →
    verify round-trip doesn't deadlock — every other endpoint should
    keep using the _ActiveBase family, which naturally rejects
    PENDING users.

    Note on /auth/me — the frontend's api.me() runs on every page
    mount, including the register page, to decide which of
    {form, verify, continue} to show. If /me used an _ActiveBase gate,
    a PENDING customer would get a 403, the frontend would treat it
    as "no session", and the page would loop back to the register
    form. MeView therefore uses AllowAny and checks
    `request.user.is_authenticated` itself — see views.py. This
    permission class is NOT involved in /me.
    """

    message = "Your account is pending email verification."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not (
            user
            and user.is_authenticated
            and getattr(user, "is_active", True)
        ):
            return False

        # Frozen accounts are excluded by name. Everything else that
        # has an unverified email is allowed to reach the verify
        # endpoints — see the class docstring for the reasoning.
        if getattr(user, "status", None) not in (Status.PENDING, Status.ACTIVE):
            return False

        return not getattr(user, "is_email_verified", False)


class IsVerifiedUser(_ActiveBase):
    """
    Stricter sibling of _ActiveBase: also requires is_email_verified.

    For the ordinary register flow this is equivalent to _ActiveBase —
    PENDING → ACTIVE only happens inside User.mark_email_verified(),
    which also sets is_email_verified=True. So this class adds nothing
    there.

    It matters for the edge cases _ActiveBase does not cover:

      * Google signups where status=ACTIVE but is_email_verified=False
        (provider asserts the email, but our own flag was never set).
      * Accounts created before verification was enforced, or via an
        admin path that skipped the verify step.
      * Anything a manual DB edit leaves half-set.

    Use on endpoints where an unverified email is an actual risk:
    placing an order (we'd email a receipt we can't deliver), changing
    the account email (moves the verification anchor), initiating a
    password reset (relies on email deliverability).
    """

    message = "Please verify your email address first."

    def has_permission(self, request, view):
        return self._ok(request.user) and getattr(
            request.user, "is_email_verified", False
        )


class IsVerifiedCustomer(IsVerifiedUser):
    """
    Verified AND a CUSTOMER.

    The combination you'll want on self-service storefront actions that
    are too sensitive to allow with an unverified email but should
    still be scoped away from admin-tier users.
    """

    message = "Verified customer access required."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == Role.CUSTOMER


# ─────────────────────────────────────────────────────────────────────────────
# Composite gates
# ─────────────────────────────────────────────────────────────────────────────
class IsSelfOrAdmin(_ActiveBase):
    """
    Object-level gate: allow if the target user IS the requester, or
    the requester is OWNER/STAFF.

    Assumes the view passes the target `User` as the object (or sets
    `obj.user`). If the view has no object yet (list/create), only the
    admin branch applies.

    IMPORTANT: `has_permission` must be overridden here. Without it,
    DRF's `BasePermission.has_permission` returns True unconditionally,
    which means list/create endpoints would accept requests from
    anonymous or suspended users — the object-level check only runs on
    detail routes.
    """

    message = "You can only access your own account."

    def has_permission(self, request, view):
        # Any active user may reach the view. Whether they can actually
        # touch the *specific object* is decided per-object below.
        return self._ok(request.user)

    def has_object_permission(self, request, view, obj):
        if not self._ok(request.user):
            return False
        if request.user.is_admin_role:
            return True
        # Accept either a User instance or anything with `.user`.
        target = getattr(obj, "user", obj)
        return target == request.user


class ReadOnly(BasePermission):
    """
    Allow any authenticated user to GET/HEAD/OPTIONS, block writes.
    Useful for endpoints that are read-only for customers but writable
    for admins via a different permission class.
    """

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class IsAnyActiveUser(_ActiveBase):
    """
    OWNER + STAFF + CUSTOMER, all gated on ACTIVE. Equivalent to
    "any signed-in, active user" regardless of role.

    Use this for endpoints that every logged-in user can reach — e.g.
    "view my own orders", "update my own profile".

    Remember this excludes PENDING users by design. If an endpoint
    must be reachable by an unverified customer, use OR with
    IsPendingVerification in the view's permission_classes rather
    than loosening this class.
    """

    message = "Authentication required."

    def has_permission(self, request, view):
        return self._ok(request.user)


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: usable-password gate
# ─────────────────────────────────────────────────────────────────────────────
class HasUsablePassword(BasePermission):
    """
    Reject users whose password is unusable (Google-only signups that
    never set a password).

    Use on endpoints that *require* a password to be meaningful — e.g.
    "change my password", "enable 2FA via password confirmation".
    Without this, a Google-only user hitting those endpoints would
    pass authentication but fail in confusing ways deeper in the view.
    """

    message = "This action requires a password. Set one first."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return user.has_usable_password()