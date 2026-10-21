from django.db.models import Q
from django_filters import rest_framework as filters

from account.models import Review


STATUS_FRONTEND_TO_DB = {
    "pending": Review.Status.PENDING,
    "approved": Review.Status.PUBLISHED,
    "rejected": Review.Status.REJECTED,
}


class ReviewFilter(filters.FilterSet):
    status = filters.CharFilter(method="filter_status")
    rating = filters.NumberFilter(field_name="rating")
    verified = filters.BooleanFilter(field_name="is_verified_purchase")
    flagged = filters.BooleanFilter(method="filter_flagged")
    search = filters.CharFilter(method="filter_search")

    class Meta:
        model = Review
        fields = []

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