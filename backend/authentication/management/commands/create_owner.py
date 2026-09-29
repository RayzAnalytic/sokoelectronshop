from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from authentication.models import Role, Status

User = get_user_model()


class Command(BaseCommand):
    help = "Create or update the shop OWNER account."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--first-name", default="")
        parser.add_argument("--last-name", default="")

    def handle(self, *args, **opts):
        email = opts["email"].strip().lower()
        password = opts["password"]

        if len(password) < 10:
            raise CommandError("Password must be at least 10 characters.")

        user, created = User.objects.get_or_create(email=email)
        user.role = Role.OWNER
        user.status = Status.ACTIVE
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_email_verified = True
        user.first_name = opts["first_name"]
        user.last_name = opts["last_name"]
        user.set_password(password)
        user.save()

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} owner: {email}"))