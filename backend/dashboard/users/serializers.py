from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .constants import (
    MATRIX_ROLE_CHOICES,
    ROLE_ADMIN,
    STAFF_ROLES,
)
from .models import (
    InviteStatus,
    ModulePermission,
    Role,
    StaffInvite,
    StaffProfile,
)


class UserSerializer(serializers.ModelSerializer):
    id            = serializers.IntegerField(source='user.id', read_only=True)
    email         = serializers.EmailField(source='user.email', read_only=True)
    date_joined   = serializers.DateTimeField(source='user.date_joined', read_only=True)
    last_login_at = serializers.DateTimeField(source='user.last_login', read_only=True)
    dashboard_url = serializers.CharField(read_only=True)

    class Meta:
        model  = StaffProfile
        fields = [
            'id', 'name', 'email', 'role', 'status',
            'department', 'avatar', 'last_login_at',
            'date_joined', 'dashboard_url',
        ]
        read_only_fields = [
            'id', 'email', 'date_joined', 'last_login_at', 'dashboard_url',
        ]


class UserInviteSerializer(serializers.Serializer):
    name       = serializers.CharField(max_length=150)
    email      = serializers.EmailField()
    role       = serializers.ChoiceField(choices=STAFF_ROLES)
    department = serializers.CharField(max_length=64, required=False, allow_blank=True)
    message    = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower()
        User = get_user_model()

        existing_user = User.objects.filter(email=value).first()

        if existing_user:
            if StaffProfile.is_staff_user(existing_user):
                raise serializers.ValidationError(
                    'A staff account with this email already exists.'
                )
            raise serializers.ValidationError(
                'This email belongs to a customer account. '
                'Customers cannot be promoted to staff. Use a different work email.'
            )

        if StaffInvite.objects.filter(
            email=value,
            status=InviteStatus.PENDING,
        ).exists():
            raise serializers.ValidationError(
                'An active invite already exists for this email.'
            )

        return value

    def validate(self, attrs):
        role = attrs.get('role')
        if role == ROLE_ADMIN:
            if StaffProfile.objects.filter(role=ROLE_ADMIN).exists():
                raise serializers.ValidationError({
                    'role': (
                        'There is already an administrator for this shop. '
                        'Only one is allowed.'
                    ),
                })
        return attrs

    def create(self, validated):
        request = self.context['request']
        return StaffInvite.objects.create(
            invited_by=request.user,
            expires_at=StaffInvite.default_expiry(),
            **validated,
        )


class StaffInviteSerializer(serializers.ModelSerializer):
    is_valid    = serializers.BooleanField(read_only=True)
    invited_by  = serializers.StringRelatedField()
    accepted_by = serializers.StringRelatedField()

    class Meta:
        model  = StaffInvite
        fields = [
            'id', 'email', 'name', 'role', 'department',
            'status', 'invited_by', 'accepted_by',
            'created_at', 'expires_at', 'accepted_at', 'cancelled_at',
            'is_valid',
        ]
        read_only_fields = [
            'id', 'status', 'invited_by', 'accepted_by',
            'created_at', 'expires_at', 'accepted_at', 'cancelled_at',
            'is_valid',
        ]


class AcceptInviteSerializer(serializers.Serializer):
    password         = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError(
                {'password_confirm': 'Passwords do not match.'}
            )
        return data


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Role
        fields = ['id', 'name', 'description', 'scope', 'color', 'icon', 'is_customer']


class PermissionRowSerializer(serializers.Serializer):
    module = serializers.CharField()
    group  = serializers.CharField()
    roles  = serializers.DictField(child=serializers.BooleanField())

    @classmethod
    def from_rows(cls, rows):
        grouped: dict = {}
        for p in rows:
            if p.module not in grouped:
                grouped[p.module] = {
                    'module': p.module,
                    'group': p.group,
                    'roles': {},
                }
            grouped[p.module]['roles'][p.role] = p.granted
        return list(grouped.values())


class PermissionMatrixSerializer(serializers.Serializer):
    permissions = PermissionRowSerializer(many=True)

    _valid_roles = {choice[0] for choice in MATRIX_ROLE_CHOICES}

    def validate_permissions(self, rows):
        for row in rows:
            unknown = set(row['roles'].keys()) - self._valid_roles
            if unknown:
                raise serializers.ValidationError(
                    f"Unknown role(s) for module '{row['module']}': "
                    f"{', '.join(sorted(unknown))}"
                )
        return rows

    def save(self, **kwargs):
        rows = self.validated_data['permissions']
        with transaction.atomic():
            for row in rows:
                for role, granted in row['roles'].items():
                    if role == ROLE_ADMIN:
                        continue
                    ModulePermission.objects.update_or_create(
                        module=row['module'],
                        role=role,
                        defaults={'group': row['group'], 'granted': granted},
                    )
        return rows