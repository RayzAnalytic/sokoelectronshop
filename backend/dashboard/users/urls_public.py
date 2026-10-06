from django.urls import path

from . import views

app_name = 'dashboard_users_public'

urlpatterns = [
    path('<uuid:token>/',         views.InviteDetailView.as_view(), name='invite-detail'),
    path('<uuid:token>/accept/',  views.InviteAcceptView.as_view(), name='invite-accept'),
]