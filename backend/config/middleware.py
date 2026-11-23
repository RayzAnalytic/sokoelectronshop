from django.contrib.auth.views import redirect_to_login

class BlockAdminMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin'):
            user = getattr(request, 'user', None)
            if not user or not user.is_authenticated or not user.is_superuser:
                return redirect_to_login(request.get_full_path())
        return self.get_response(request)