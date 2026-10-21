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

from authentication.models import Role as AuthRole

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


class StaffLoginView(APIView):
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

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        return Response({
            "user": UserSerializer(profile).data,
            "role": profile.role,
            "redirect_to": profile.dashboard_url,
        })


class StaffLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserListView(generics.ListAPIView):
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
    queryset = StaffProfile.objects.select_related("user").all()
    serializer_class = UserSerializer
    permission_classes = [IsStaff, IsAdminOrManager]

    def perform_destroy(self, instance):
        if instance.is_administrator:
            raise PermissionDenied(
                "The primary administrator cannot be deleted."
            )

        try:
            instance.user.delete()
        except Exception as exc:
            raise ValidationError(
                {"detail": f"Cannot delete this user: {exc}"}
            )


@api_view(["POST"])
@permission_classes([IsStaff, IsAdminOrManager])
def toggle_suspend(request, pk):
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

    user = profile.user
    user.is_active = profile.status == UserStatus.ACTIVE
    user.save(update_fields=["is_active"])

    return Response({"status": profile.status})


@api_view(["POST"])
@permission_classes([IsStaff, IsAdministrator])
def reset_password(request, pk):
    try:
        profile = StaffProfile.objects.select_related("user").get(pk=pk)
    except StaffProfile.DoesNotExist:
        return Response(
            {"detail": "User not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    send_password_reset_email.delay(str(profile.user_id))
    return Response({"detail": f"Reset link sent to {profile.user.email}."})


class MyPermissionsView(APIView):
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


class RoleListView(generics.ListAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsStaff]


class PermissionMatrixView(APIView):
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


class InviteListCreateView(generics.ListCreateAPIView):
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
    queryset = StaffInvite.objects.all()
    permission_classes = [IsStaff, IsAdministrator]

    def perform_destroy(self, instance):
        if instance.status == InviteStatus.ACCEPTED:
            raise PermissionDenied("Cannot cancel an accepted invite.")
        instance.mark_cancelled()


class InviteDetailView(generics.RetrieveAPIView):
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

        name_parts = (invite.name or "").split(maxsplit=1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        with transaction.atomic():
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
        