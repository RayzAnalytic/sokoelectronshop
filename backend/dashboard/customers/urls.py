from django.urls import path

from . import views

app_name = "dashboard_customers"

urlpatterns = [
    path("", views.CustomerListView.as_view(), name="list"),
    path("stats/", views.CustomerStatsView.as_view(), name="stats"),
    path("segments/", views.SegmentCountsView.as_view(), name="segments"),
    path("export/", views.ExportCustomersView.as_view(), name="export"),

    path("<int:user_id>/", views.CustomerDetailView.as_view(), name="detail"),
    path("<int:user_id>/block/", views.BlockCustomerView.as_view(), name="block"),
    path("<int:user_id>/consent/", views.MarketingConsentView.as_view(), name="consent"),

    path("<int:user_id>/notes/", views.NoteListCreateView.as_view(), name="notes"),
    path("<int:user_id>/notes/<int:note_id>/", views.NoteDeleteView.as_view(), name="note-delete"),

    path("<int:user_id>/whatsapp/", views.WhatsAppSendView.as_view(), name="whatsapp"),
    path("<int:user_id>/email/", views.EmailSendView.as_view(), name="email"),

    path("<int:user_id>/addresses/", views.AddressCreateView.as_view(), name="addresses"),
    path("<int:user_id>/addresses/<int:address_id>/", views.AddressDeleteView.as_view(), name="address-delete"),
]