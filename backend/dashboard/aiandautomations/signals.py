"""
Receives events from checkout / catalog / account and forwards them to the
automation dispatcher. Import guarded so the app works even if those apps
don't emit signals yet — the receiver just never fires.
"""
from django.dispatch import Signal, receiver
from .services.automations import dispatch


# Define the events once here so other apps can import them.
order_created        = Signal()   # kwargs: order
order_paid           = Signal()   # kwargs: order
order_status_changed = Signal()   # kwargs: order, old_status, new_status
cart_abandoned       = Signal()   # kwargs: cart
stock_low            = Signal()   # kwargs: product
first_message        = Signal()   # kwargs: customer
customer_became_vip  = Signal()   # kwargs: customer


@receiver(order_created)
def _on_order_created(sender, order, **kw):
    dispatch('order.placed', {
        'order_id': getattr(order, 'pk', None),
        'customer_id': getattr(order, 'customer_id', None),
        'total': float(getattr(order, 'total', 0) or 0),
        'channel': getattr(order, 'channel', None),
    })


@receiver(order_paid)
def _on_order_paid(sender, order, **kw):
    dispatch('order.paid', {
        'order_id': getattr(order, 'pk', None),
        'customer_id': getattr(order, 'customer_id', None),
        'total': float(getattr(order, 'total', 0) or 0),
    })


@receiver(order_status_changed)
def _on_order_status(sender, order, old_status, new_status, **kw):
    dispatch(f'order.status.{new_status}', {
        'order_id': getattr(order, 'pk', None),
        'old_status': old_status,
        'new_status': new_status,
    })


@receiver(cart_abandoned)
def _on_cart_abandoned(sender, cart, **kw):
    dispatch('cart.abandoned', {
        'cart_id': getattr(cart, 'pk', None),
        'customer_id': getattr(cart, 'customer_id', None),
    })


@receiver(stock_low)
def _on_stock_low(sender, product, **kw):
    dispatch('stock.below_threshold', {
        'product_id': getattr(product, 'pk', None),
        'stock': getattr(product, 'stock', None),
    })


@receiver(first_message)
def _on_first_message(sender, customer, **kw):
    dispatch('customer.first_message', {
        'customer_id': getattr(customer, 'pk', None),
    })


@receiver(customer_became_vip)
def _on_customer_vip(sender, customer, **kw):
    dispatch('customer.became_vip', {
        'customer_id': getattr(customer, 'pk', None),
    })