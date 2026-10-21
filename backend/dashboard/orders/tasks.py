import csv
import io
import logging
from datetime import timedelta

from celery import shared_task
from django.core.mail import EmailMessage
from django.db import transaction
from django.utils import timezone

from checkout.models import Order, Payment, PaymentEvent

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
    name="dashboard.orders.tasks.render_receipt_pdf",
)
def render_receipt_pdf(self, reference: str) -> dict:
    try:
        order = (
            Order.objects
            .select_related("user")
            .prefetch_related("items", "payments")
            .get(reference=reference)
        )
    except Order.DoesNotExist:
        logger.warning("render_receipt_pdf: order %s not found", reference)
        return {"ok": False, "reason": "not_found", "reference": reference}

    try:
        from .pdf import build_receipt_pdf
        buf = build_receipt_pdf(order)
    except Exception as exc:
        logger.exception(
            "render_receipt_pdf: PDF rendering failed for %s", reference,
        )
        raise self.retry(exc=exc)

    pdf_bytes = buf.getvalue()

    snapshot = order.snapshot or {}
    snapshot["receipt_pdf_size"] = len(pdf_bytes)
    snapshot["receipt_rendered_at"] = timezone.now().isoformat()
    Order.objects.filter(pk=order.pk).update(snapshot=snapshot)

    return {"ok": True, "reference": reference, "size": len(pdf_bytes)}


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    name="dashboard.orders.tasks.email_receipt",
)
def email_receipt(self, reference: str, to_email: str | None = None) -> dict:
    try:
        order = (
            Order.objects
            .select_related("user")
            .prefetch_related("items", "payments")
            .get(reference=reference)
        )
    except Order.DoesNotExist:
        logger.warning("email_receipt: order %s not found", reference)
        return {"ok": False, "reason": "not_found", "reference": reference}

    recipient = to_email or order.customer_email
    if not recipient:
        logger.warning(
            "email_receipt: order %s has no email address", reference,
        )
        return {"ok": False, "reason": "no_recipient", "reference": reference}

    try:
        from .pdf import build_receipt_pdf
        buf = build_receipt_pdf(order)
    except Exception as exc:
        logger.exception(
            "email_receipt: PDF rendering failed for %s", reference,
        )
        raise self.retry(exc=exc)

    subject = f"Your receipt for order {order.reference}"
    body = (
        f"Hi {order.customer_name or 'there'},\n\n"
        f"Thanks for shopping with us. Your receipt for order "
        f"{order.reference} is attached.\n\n"
        f"Total: KES {order.total}\n"
        f"Payment status: {order.get_payment_status_display()}\n\n"
        f"If you have any questions, just reply to this email.\n"
    )

    try:
        msg = EmailMessage(subject=subject, body=body, to=[recipient])
        msg.attach(
            f"receipt-{order.reference}.pdf",
            buf.getvalue(),
            "application/pdf",
        )
        msg.send(fail_silently=False)
    except Exception as exc:
        logger.exception(
            "email_receipt: send failed for %s to %s", reference, recipient,
        )
        raise self.retry(exc=exc)

    return {"ok": True, "reference": reference, "sent_to": recipient}


@shared_task(
    bind=True,
    name="dashboard.orders.tasks.export_orders_csv",
)
def export_orders_csv(self, filters: dict, requested_by_email: str) -> dict:
    from . import selectors

    qs = selectors.list_orders(
        tab=filters.get("tab") or "all",
        search=filters.get("search") or "",
        payment_status=filters.get("payment_status") or "",
        date_from=filters.get("date_from"),
        date_to=filters.get("date_to"),
    ).select_related("user")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Reference", "Date", "Customer", "Email", "Phone",
        "Items", "Subtotal", "Discount", "Shipping", "Tax", "Total",
        "Payment Method", "Payment Status", "Fulfillment Status",
        "Courier", "Tracking Number",
    ])

    row_count = 0
    for order in qs.iterator(chunk_size=500):
        writer.writerow([
            order.reference,
            order.created_at.isoformat(),
            order.customer_name,
            order.contact_email,
            order.contact_phone,
            order.items.count(),
            str(order.subtotal),
            str(order.discount),
            str(order.shipping),
            str(order.tax),
            str(order.total),
            order.payment_method,
            order.payment_status,
            order.status,
            order.courier,
            order.tracking_number,
        ])
        row_count += 1

    csv_bytes = buf.getvalue().encode("utf-8")

    if requested_by_email:
        try:
            msg = EmailMessage(
                subject=f"Orders export — {row_count} rows",
                body=(
                    f"Your export is attached.\n\n"
                    f"Filters: {filters}\n"
                    f"Rows: {row_count}\n"
                ),
                to=[requested_by_email],
            )
            msg.attach(
                f"orders-{timezone.now():%Y-%m-%d}.csv",
                csv_bytes,
                "text/csv",
            )
            msg.send(fail_silently=False)
        except Exception:
            logger.exception(
                "export_orders_csv: failed to email export to %s",
                requested_by_email,
            )

    return {
        "ok": True,
        "rows": row_count,
        "bytes": len(csv_bytes),
        "delivered_to": requested_by_email,
    }


@shared_task(
    name="dashboard.orders.tasks.sweep_stale_pending_payments",
)
def sweep_stale_pending_payments(max_age_minutes: int = 30) -> dict:
    cutoff = timezone.now() - timedelta(minutes=max_age_minutes)

    stale_qs = Payment.objects.filter(
        status__in=[
            Payment.Status.PENDING,
            Payment.Status.PROCESSING,
        ],
        created_at__lt=cutoff,
    )

    timed_out = 0
    for payment in stale_qs.iterator(chunk_size=200):
        try:
            with transaction.atomic():
                payment.status = Payment.Status.TIMEOUT
                payment.result_description = (
                    payment.result_description
                    or "Timed out — no callback received."
                )
                payment.save(update_fields=[
                    "status", "result_description", "updated_at",
                ])
                PaymentEvent.log(
                    payment,
                    "Payment timed out",
                    state=PaymentEvent.State.FAILED,
                    detail=f"No callback within {max_age_minutes} minutes.",
                )
                timed_out += 1
        except Exception:
            logger.exception(
                "sweep_stale_pending_payments: failed on payment %s",
                payment.pk,
            )

    return {"ok": True, "timed_out": timed_out, "cutoff": cutoff.isoformat()}


@shared_task(
    name="dashboard.orders.tasks.send_abandoned_cart_reminder",
)
def send_abandoned_cart_reminder(user_id: int) -> dict:
    logger.info("send_abandoned_cart_reminder: user_id=%s (stub)", user_id)
    return {"ok": True, "user_id": user_id, "stub": True}