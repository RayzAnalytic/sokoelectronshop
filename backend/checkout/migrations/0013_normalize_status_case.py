from django.db import migrations


VALID_STATUS = {
    'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
    'DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED',
}

VALID_PAYMENT_STATUS = {
    'UNPAID', 'PAID', 'REFUNDED', 'FAILED',
}


def upper_status_and_payment(apps, schema_editor):
    Order = apps.get_model('checkout', 'Order')

    to_update = []
    for o in Order.objects.all().only('id', 'status', 'payment_status'):
        changed = False

        if (
            o.status
            and o.status not in VALID_STATUS
            and o.status.upper() in VALID_STATUS
        ):
            o.status = o.status.upper()
            changed = True

        if (
            o.payment_status
            and o.payment_status not in VALID_PAYMENT_STATUS
            and o.payment_status.upper() in VALID_PAYMENT_STATUS
        ):
            o.payment_status = o.payment_status.upper()
            changed = True

        if changed:
            to_update.append(o)

    if to_update:
        Order.objects.bulk_update(to_update, ['status', 'payment_status'])


def upper_status_events(apps, schema_editor):
    OrderStatusEvent = apps.get_model('checkout', 'OrderStatusEvent')

    to_update = []
    for e in OrderStatusEvent.objects.all().only(
        'id', 'to_status', 'from_status',
    ):
        changed = False

        if (
            e.to_status
            and e.to_status not in VALID_STATUS
            and e.to_status.upper() in VALID_STATUS
        ):
            e.to_status = e.to_status.upper()
            changed = True

        if (
            e.from_status
            and e.from_status not in VALID_STATUS
            and e.from_status.upper() in VALID_STATUS
        ):
            e.from_status = e.from_status.upper()
            changed = True

        if changed:
            to_update.append(e)

    if to_update:
        OrderStatusEvent.objects.bulk_update(
            to_update, ['to_status', 'from_status'],
        )


class Migration(migrations.Migration):

    dependencies = [
        ('checkout', '0012_order_verify_token_orderitem_imei_and_more'),
    ]

    operations = [
        migrations.RunPython(
            upper_status_and_payment,
            migrations.RunPython.noop,
        ),
        migrations.RunPython(
            upper_status_events,
            migrations.RunPython.noop,
        ),
    ]