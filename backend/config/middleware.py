import os
from django.http import Http404


ADMIN_URL = os.environ.get("ADMIN_URL", "ops-7f3k9z")
ADMIN_PREFIX = f"/{ADMIN_URL}/"


class BlockAdminMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        if path.startswith(ADMIN_PREFIX):
            if path.startswith(ADMIN_PREFIX + "login/") or \
               path.startswith(ADMIN_PREFIX + "logout/"):
                return self.get_response(request)

            user = getattr(request, "user", None)
            if not user or not user.is_authenticated or not user.is_staff:
                raise Http404

        return self.get_response(request)