import logging

from django.db import transaction
from django.db.models import F
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from checkout.models import Order, OrderItem

logger = logging.getLogger(__name__)


COUNTED_STATUSES = {
    Order.Status.DELIVERED,
}


def _adjust_product(product_id, delta, reference=""):
    from catalog.models import Product

    if not product_id or not delta:
        return
    try:
        Product.objects.filter(pk=product_id).update(
            sales_count=F("sales_count") + delta,
        )
    except Exception:
        logger.exception(
            "sales_count update failed for product %s (order %s)",
            product_id, reference,
        )


def _apply_delta(order, sign: int) -> None:
    for item in order.items.all():
        _adjust_product(
            item.product_id,
            sign * item.quantity,
            order.reference,
        )


def _counted_order(order_id):
    if not order_id:
        return None
    try:
        order = Order.objects.only("status", "reference").get(pk=order_id)
    except Order.DoesNotExist:
        return None
    if order.status not in COUNTED_STATUSES:
        return None
    return order


@receiver(pre_save, sender=Order, dispatch_uid="catalog.sync_sales_count")
def sync_sales_count_on_status_change(sender, instance, **kwargs):
    if instance.pk is None:
        return

    try:
        previous = Order.objects.only("status").get(pk=instance.pk)
    except Order.DoesNotExist:
        return

    old_status = previous.status
    new_status = instance.status

    if old_status == new_status:
        return

    was_counted = old_status in COUNTED_STATUSES
    now_counted = new_status in COUNTED_STATUSES

    if was_counted == now_counted:
        return

    sign = 1 if now_counted else -1

    transaction.on_commit(lambda: _apply_delta(instance, sign))


@receiver(post_delete, sender=Order, dispatch_uid="catalog.sync_sales_count_delete")
def sync_sales_count_on_delete(sender, instance, **kwargs):
    if instance.status not in COUNTED_STATUSES:
        return

    transaction.on_commit(lambda: _apply_delta(instance, -1))


@receiver(
    post_delete,
    sender=OrderItem,
    dispatch_uid="catalog.sync_sales_count_item_delete",
)
def sync_sales_count_on_item_delete(sender, instance, **kwargs):
    order = _counted_order(getattr(instance, "order_id", None))
    if order is None:
        return

    product_id = instance.product_id
    quantity = instance.quantity
    reference = order.reference

    transaction.on_commit(
        lambda: _adjust_product(product_id, -quantity, reference)
    )


@receiver(
    pre_save,
    sender=OrderItem,
    dispatch_uid="catalog.sync_sales_count_item_change",
)
def sync_sales_count_on_item_change(sender, instance, **kwargs):
    if instance.pk is None:
        return

    try:
        previous = OrderItem.objects.only("quantity", "product_id").get(
            pk=instance.pk,
        )
    except OrderItem.DoesNotExist:
        return

    if previous.product_id != instance.product_id:
        return

    delta = instance.quantity - previous.quantity
    if delta == 0:
        return

    order = _counted_order(getattr(instance, "order_id", None))
    if order is None:
        return

    product_id = instance.product_id
    reference = order.reference

    transaction.on_commit(
        lambda: _adjust_product(product_id, delta, reference)
    )