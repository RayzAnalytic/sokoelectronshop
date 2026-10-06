"""
Filters for the admin review list.

The frontend sends Title Case status values (`Pending`, `Approved`,
`Rejected`) — the model uses lowercase (`pending`, `published`,
`rejected`). The `status` filter maps between them so the API contract
stays frontend-friendly while the DB stays consistent with the rest of
the codebase.
"""

from django.db.models import Q
from django_filters import rest_framework as filters

from account.models import Review


STATUS_FRONTEND_TO_DB = {
    "pending": Review.Status.PENDING,        # "Pending"
    "approved": Review.Status.PUBLISHED,     # "Approved" → published
    "rejected": Review.Status.REJECTED,      # "Rejected"
}


class ReviewFilter(filters.FilterSet):
    """
    Query params accepted by `GET /api/v1/admin/reviews/`:

        status    = all | Pending | Approved | Rejected
        rating    = 1..5
        verified  = true | false
        flagged   = true | false
        search    = free text against customer, product, body

    Every filter is optional. Missing → no filter.
    """

    status = filters.CharFilter(method="filter_status")
    rating = filters.NumberFilter(field_name="rating")
    verified = filters.BooleanFilter(field_name="is_verified_purchase")
    flagged = filters.BooleanFilter(method="filter_flagged")
    search = filters.CharFilter(method="filter_search")

    class Meta:
        model = Review
        fields = []  # custom methods handle everything

    def filter_status(self, qs, name, value):
        if not value or value.lower() == "all":
            return qs
        db_value = STATUS_FRONTEND_TO_DB.get(value.lower())
        if not db_value:
            return qs
        return qs.filter(status=db_value)

    def filter_flagged(self, qs, name, value):
        if value is True:
            return qs.filter(flag_status="flagged")
        if value is False:
            return qs.exclude(flag_status="flagged")
        return qs

    def filter_search(self, qs, name, value):
        if not value:
            return qs
        q = value.strip()
        return qs.filter(
            Q(product_name__icontains=q)
            | Q(body__icontains=q)
            | Q(user__email__icontains=q)
            | Q(user__first_name__icontains=q)
            | Q(user__last_name__icontains=q)
            | Q(guest_author_name__icontains=q)
        )