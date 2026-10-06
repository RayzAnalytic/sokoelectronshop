"""
Create or update the shop OWNER account.

Usage:
    python manage.py create_owner --email owner@example.com --password "..."

The resulting user has every flag set — role OWNER, staff, superuser,
active, email-verified — so they can log into the admin panel and the
storefront without further setup.

Idempotent: re-running with the same email updates the existing row
instead of raising a conflict.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from authentication.models import Role, Status

User = get_user_model()


class Command(BaseCommand):
    help = "Create or update the shop OWNER account."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            required=True,
            help="Owner email address. Stored lowercased.",
        )
        parser.add_argument(
            "--password",
            required=True,
            help="Password (minimum 10 characters).",
        )
        parser.add_argument(
            "--first-name",
            default="",
            help="Optional first name.",
        )
        parser.add_argument(
            "--last-name",
            default="",
            help="Optional last name.",
        )
        parser.add_argument(
            "--phone",
            default="",
            help="Optional phone number.",
        )

    def handle(self, *args, **opts):
        email = opts["email"].strip().lower()
        password = opts["password"]

        if len(password) < 10:
            raise CommandError("Password must be at least 10 characters.")

        user, created = User.objects.get_or_create(email=email)

        # Role / status / flags — every one forced, no defaults relied on.
        user.role = Role.OWNER
        user.status = Status.ACTIVE
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_email_verified = True

        # Profile fields — only overwrite when a value was passed.
        if opts["first_name"]:
            user.first_name = opts["first_name"]
        if opts["last_name"]:
            user.last_name = opts["last_name"]
        if opts["phone"]:
            user.phone = opts["phone"]

        # Always set the password — this doubles as a reset mechanism.
        user.set_password(password)

        # Save every field we touched.
        user.save(
            update_fields=[
                "role",
                "status",
                "is_staff",
                "is_superuser",
                "is_active",
                "is_email_verified",
                "first_name",
                "last_name",
                "phone",
                "password",
            ]
        )

        verb = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} owner: {email}\n"
                f"  role={user.role} staff={user.is_staff} "
                f"superuser={user.is_superuser} active={user.is_active}"
            )
        )