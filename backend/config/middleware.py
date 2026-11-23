import os
from django.http import Http404

ADMIN_URL    = os.environ.get("ADMIN_URL", "ops-7f3k9z")
ADMIN_PREFIX = f"/{ADMIN_URL}/"          # trailing slash → precise match


class BlockAdminMiddleware:
    """
    Second gate for the Django admin. Only `is_staff` (or `is_superuser`,
    if you prefer) users get past the login page. Everyone else gets a
    404 so the admin's existence isn't even confirmed.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        if path.startswith(ADMIN_PREFIX):
            # Let the login + logout views through, otherwise nobody
            # can ever sign in. (Basic-auth on Vercel still protects them.)
            if path.startswith(ADMIN_PREFIX + "login/") or \
               path.startswith(ADMIN_PREFIX + "logout/"):
                return self.get_response(request)

            user = getattr(request, "user", None)
            if not user or not user.is_authenticated or not user.is_staff:
                # Prefer 404 over redirect — hides the admin from scanners.
                raise Http404
                # If you'd rather show the login page:
                # from django.contrib.auth.views import redirect_to_login
                # return redirect_to_login(request.get_full_path(),
                #                          login_url=ADMIN_PREFIX + "login/")

        return self.get_response(request)