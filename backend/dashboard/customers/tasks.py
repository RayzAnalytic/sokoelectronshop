import csv
import io
import logging

from celery import shared_task
from django.contrib.auth import get_user_model

from .constants import CustomerSegment
from .models import CustomerProfile

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(name="dashboard.customers.recalculate_all_profiles")
def recalculate_all_profiles():
    BATCH = 500
    count = 0

    qs = CustomerProfile.objects.all().order_by("pk")
    for profile in qs.iterator(chunk_size=BATCH):
        try:
            profile.refresh_stats()
            count += 1
        except Exception:
            logger.exception(
                "Failed to refresh CustomerProfile for user %s", profile.user_id,
            )

    logger.info("Recalculated %d customer profiles.", count)
    return count


@shared_task(name="dashboard.customers.export_customers_csv")
def export_customers_csv(filters: dict | None = None) -> str:
    from .selectors import list_customers

    filters = filters or {}
    qs = list_customers(**filters).select_related("customer_profile")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "email", "phone", "first_name", "last_name",
        "segment", "status", "orders_count", "total_spent",
        "last_order_date", "date_joined",
    ])

    for user in qs.iterator(chunk_size=500):
        p = getattr(user, "customer_profile", None)
        writer.writerow([
            user.pk,
            user.email,
            user.phone,
            user.first_name,
            user.last_name,
            p.segment if p else CustomerSegment.REGULAR,
            user.status,
            p.orders_count if p else 0,
            f"{p.total_spent:.2f}" if p else "0.00",
            p.last_order_date.isoformat() if p and p.last_order_date else "",
            user.date_joined.isoformat(),
        ])

    logger.info("Exported %d customers to CSV.", qs.count())
    return buf.getvalue()