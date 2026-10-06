# dashboard/users/views.py

from django.contrib.auth import (
    authenticate,
    login as django_login,
    logout as django_logout,
)
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView

from authentication.models import Role as AuthRole # OWNER / STAFF / CUSTOMER

from .constants import ROLE_ADMIN, ROLE_DASHBOARD_MAP, STAFF_ROLES
from .models import (
    InviteStatus,
    ModulePermission,
    Role,
    StaffInvite,
    StaffProfile,
    UserStatus,
)
from .permissions import IsAdminOrManager, IsAdministrator, IsStaff
from .serializers import (
    AcceptInviteSerializer,
    PermissionMatrixSerializer,
    PermissionRowSerializer,
    RoleSerializer,
    StaffInviteSerializer,
    UserInviteSerializer,
    UserSerializer,
)
from .tasks import send_invite_email, send_password_reset_email

User = get_user_model()


# ─────────────────────────────────────────────────────────────
# LOGIN — session-based, staff only
#
# Mirrors authentication.views.LoginView for staff. The customer
# login lives there and handles customers; this one is for staff.
#
# Rejects non-staff (no StaffProfile) and suspended accounts.
# Sets the session cookie, so subsequent admin API calls authenticate
# via SessionAuthentication (the DRF default in settings).
#
# Deliberately not JWT: the frontend's admin-api.ts uses cookies +
# X-CSRFToken, which is a session pattern. Mixing JWTs in would
# require a separate Bearer-token path on every admin call.
# ─────────────────────────────────────────────────────────────
class StaffLoginView(APIView):
    """
    POST /api/v1/admin/auth/login/

    Body: { email, password }

    Response: { user, redirect_to, role }

    Errors:
        400 — missing credentials
        401 — invalid credentials, not staff, suspended
        409 — a customer session is already active on this device
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""

        if not email or not password:
            return Response(
                {"detail": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Same-device rule (mirrors authentication.views.LoginView)
        current_mode = request.session.get("device_mode")
        if request.user.is_authenticated and current_mode == "customer":
            return Response(
                {"detail": "This device is signed in as a customer. Log out first."},
                status=status.HTTP_409_CONFLICT,
            )

        user = authenticate(request, username=email, password=password)
        if user is None or not user.is_active:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Must be staff — presence of StaffProfile is the signal.
        profile = StaffProfile.for_user(user)
        if profile is None:
            return Response(
                {"detail": "This account is not a staff account."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if profile.status == UserStatus.SUSPENDED:
            return Response(
                {"detail": "This account is suspended."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        django_login(request, user)
        request.session["device_mode"] = "admin"

        # Django's ModelBackend normally updates `last_login` via the
        # `user_logged_in` signal. Setting it here too so the admin
        # sidebar's "last login" column is correct even if you swap
        # backends later.
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        return Response({
            "user": UserSerializer(profile).data,
            "role": profile.role,
            "redirect_to": profile.dashboard_url,
        })


class StaffLogoutView(APIView):
    """POST /api/v1/admin/auth/logout/ — clears the staff session."""
    permission_classes = [AllowAny]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────
# USERS — CRUD on StaffProfile
# ─────────────────────────────────────────────────────────────
class UserListView(generics.ListAPIView):
    """
    GET /api/v1/admin/users/

    Query params:
        role — filter by role string
        q    — search name / email / department

    Permission: Administrator or Manager.
    """
    serializer_class = UserSerializer
    permission_classes = [IsStaff, IsAdminOrManager]

    def get_queryset(self):
        qs = (
            StaffProfile.objects
            .select_related("user")
            .order_by("-user__date_joined")
        )

        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)

        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(user__email__icontains=q)
                | Q(department__icontains=q)
            )

        return qs


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/admin/users/<pk>/
    PATCH  /api/v1/admin/users/<pk>/
    PUT    /api/v1/admin/users/<pk>/
    DELETE /api/v1/admin/users/<pk>/

    Permission: Administrator or Manager.
    """
    queryset = StaffProfile.objects.select_related("user").all()
    serializer_class = UserSerializer
    permission_classes = [IsStaff, IsAdminOrManager]

    def perform_destroy(self, instance):
        if instance.is_administrator:
            raise PermissionDenied(
                "The primary administrator cannot be deleted."
            )

        # Deleting the User cascades to StaffProfile via OneToOne.
        # If the user has orders or other protected FKs, the DB will
        # refuse — surface that as a 400 instead of a 500.
        try:
            instance.user.delete()
        except Exception as exc:
            raise ValidationError(
                {"detail": f"Cannot delete this user: {exc}"}
            )


@api_view(["POST"])
@permission_classes([IsStaff, IsAdminOrManager])
def toggle_suspend(request, pk):
    """
    POST /api/v1/admin/users/<pk>/suspend/

    Toggles Active ↔ Suspended. Administrators cannot be suspended.
    """
    try:
        profile = StaffProfile.objects.select_related("user").get(pk=pk)
    except StaffProfile.DoesNotExist:
        return Response(
            {"detail": "User not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if profile.is_administrator:
        return Response(
            {"detail": "The primary administrator cannot be suspended."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile.status = (
        UserStatus.ACTIVE
        if profile.status == UserStatus.SUSPENDED
        else UserStatus.SUSPENDED
    )
    profile.save(update_fields=["status"])

    # Mirror the state on the auth User so Django's session auth
    # rejects suspended users on the next request.
    user = profile.user
    user.is_active = profile.status == UserStatus.ACTIVE
    user.save(update_fields=["is_active"])

    return Response({"status": profile.status})


@api_view(["POST"])
@permission_classes([IsStaff, IsAdministrator])
def reset_password(request, pk):
    """
    POST /api/v1/admin/users/<pk>/reset-password/

    Dispatches the password-reset email for the given staff member.
    Administrator only — managers shouldn't be able to trigger resets
    for other admins.
    """
    try:
        profile = StaffProfile.objects.select_related("user").get(pk=pk)
    except StaffProfile.DoesNotExist:
        return Response(
            {"detail": "User not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    send_password_reset_email.delay(str(profile.user_id))
    return Response({"detail": f"Reset link sent to {profile.user.email}."})


# ─────────────────────────────────────────────────────────────
# MY PERMISSIONS — sidebar gating
#
# The frontend's AdminSidebar needs to hide nav items the current
# staff member can't access. This endpoint returns the caller's
# effective module list.
#
# Response: { modules: ["Products & Catalog", "Orders", ...] }
#
# For Administrators this returns every module in the catalogue.
# For everyone else it returns the modules their role has been
# granted in the permission matrix.
# ─────────────────────────────────────────────────────────────
class MyPermissionsView(APIView):
    """
    GET /api/v1/admin/users/me/permissions/
    """
    permission_classes = [IsStaff]

    def get(self, request):
        profile = StaffProfile.for_user(request.user)
        if profile is None:
            return Response(
                {"detail": "Not a staff account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({
            "modules": profile.allowed_modules(),
            "role": profile.role,
            "dashboard_url": profile.dashboard_url,
        })


# ─────────────────────────────────────────────────────────────
# ROLES — catalogue
# ─────────────────────────────────────────────────────────────
class RoleListView(generics.ListAPIView):
    """
    GET /api/v1/admin/users/roles/

    Read-only catalogue of every role + Customer. Any staff can read.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsStaff]


# ─────────────────────────────────────────────────────────────
# PERMISSION MATRIX
# ─────────────────────────────────────────────────────────────
class PermissionMatrixView(APIView):
    """
    GET /api/v1/admin/users/permissions/  → full matrix
    PUT /api/v1/admin/users/permissions/  → save matrix

    Administrator only. The serializer pivots the flat
    ModulePermission rows into the nested shape the frontend expects.
    """
    permission_classes = [IsStaff, IsAdministrator]

    def get(self, request):
        rows = (
            ModulePermission.objects
            .all()
            .order_by("group", "module", "role")
        )
        return Response(PermissionRowSerializer.from_rows(rows))

    def put(self, request):
        serializer = PermissionMatrixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Permission matrix saved."})


# ─────────────────────────────────────────────────────────────
# INVITES — admin
# ─────────────────────────────────────────────────────────────
class InviteListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/admin/invites/  → pending invites
    POST /api/v1/admin/invites/  → create + send an invite

    Administrator only.

    GET only returns PENDING invites — accepted, cancelled, and
    expired rows are noise. Filter with ?status= to see the rest.
    """
    permission_classes = [IsStaff, IsAdministrator]

    def get_serializer_class(self):
        return (
            UserInviteSerializer
            if self.request.method == "POST"
            else StaffInviteSerializer
        )

    def get_queryset(self):
        qs = StaffInvite.objects.select_related(
            "invited_by", "accepted_by"
        ).order_by("-created_at")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.filter(status=InviteStatus.PENDING)

        return qs

    def get_throttles(self):
        if self.request.method == "POST":
            t = ScopedRateThrottle()
            t.scope = "staff_invite_create"
            return [t]
        return []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        invite = serializer.save()

        # Dispatch through Celery so the HTTP request doesn't block
        # on SendGrid. on_commit ensures the row is visible to the
        # worker when the task runs.
        transaction.on_commit(
            lambda: send_invite_email.delay(str(invite.id))
        )

        return Response(
            {
                "id": str(invite.id),
                "email": invite.email,
                "name": invite.name,
                "role": invite.role,
                "department": invite.department,
                "status": invite.status,
                "expires_at": invite.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class InviteRevokeView(generics.DestroyAPIView):
    """
    DELETE /api/v1/admin/invites/<uuid>/

    Soft-cancels the invite — sets status=CANCELLED and stamps
    cancelled_at. The row stays for the audit trail.
    """
    queryset = StaffInvite.objects.all()
    permission_classes = [IsStaff, IsAdministrator]

    def perform_destroy(self, instance):
        if instance.status == InviteStatus.ACCEPTED:
            raise PermissionDenied("Cannot cancel an accepted invite.")
        instance.mark_cancelled()


# ─────────────────────────────────────────────────────────────
# INVITES — public
# ─────────────────────────────────────────────────────────────
class InviteDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/staff-invites/<token>/

    Public — prefills the register page. Returns 410 Gone if the
    invite is expired, cancelled, or already accepted.
    """
    queryset = StaffInvite.objects.select_related("invited_by")
    lookup_field = "token"
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def retrieve(self, request, *args, **kwargs):
        invite = self.get_object()

        if not invite.is_valid:
            return Response(
                {"detail": "This invite has expired or already been used."},
                status=status.HTTP_410_GONE,
            )

        return Response({
            "name": invite.name,
            "email": invite.email,
            "role": invite.role,
            "department": invite.department,
        })


class InviteAcceptView(generics.GenericAPIView):
    """
    POST /api/v1/staff-invites/<token>/accept/

    Body: { password, password_confirm }

    Public — token in the URL is the authentication proof.

    Creates a User + StaffProfile in one transaction, marks the
    invite accepted, sets `accepted_by`, and logs the new staff
    member in (session cookie).

    Response: { user, role, redirect_to }  → 201
    """
    serializer_class = AcceptInviteSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_throttles(self):
        t = ScopedRateThrottle()
        t.scope = "staff_invite_accept"
        return [t]

    def post(self, request, token):
        invite = (
            StaffInvite.objects
            .select_related("invited_by")
            .filter(token=token)
            .first()
        )
        if invite is None:
            return Response(
                {"detail": "Invalid invite."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not invite.is_valid:
            return Response(
                {"detail": "This invite has expired or already been used."},
                status=status.HTTP_410_GONE,
            )

        if User.objects.filter(email=invite.email).exists():
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        password = serializer.validated_data["password"]

        # Derive first / last name from the invite's full name.
        name_parts = (invite.name or "").split(maxsplit=1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        with transaction.atomic():
            # Auth-level role: OWNER for Administrators, STAFF otherwise.
            auth_role = (
                AuthRole.OWNER
                if invite.role == ROLE_ADMIN
                else AuthRole.STAFF
            )

            user = User.objects.create_user(
                email=invite.email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=auth_role,
            )
            user.is_active = True
            user.is_staff = True
            user.save(update_fields=["is_active", "is_staff"])

            StaffProfile.objects.create(
                user=user,
                name=invite.name,
                role=invite.role,
                department=invite.department,
                status=UserStatus.ACTIVE,
            )

            invite.mark_accepted(user)

        # Log the new staff member in — same-device session, cookie auth.
        django_login(
            request,
            user,
            backend="django.contrib.auth.backends.ModelBackend",
        )
        request.session["device_mode"] = "admin"

        profile = user.staff_profile
        return Response(
            {
                "user": UserSerializer(profile).data,
                "role": profile.role,
                "redirect_to": profile.dashboard_url,
            },
            status=status.HTTP_201_CREATED,
        )