# dashboard/transactions/apps.py

from django.apps import AppConfig


class TransactionsConfig(AppConfig):
    """
    Admin transactions ledger — the app behind `/dashboard/transactions`.

    Owns NO models. The `Payment`, `PaymentEvent`, and
    `ReconciliationLog` models live in `checkout.models` because that
    is where the data is created. This app is the presentation and
    orchestration layer: serializers, views, URLs, and the two
    staff-only service functions that mutate a Payment in ways the
    customer-facing checkout does not.

    `label` is set explicitly so the app label is `transactions`, not
    the default `transactions` derived from `dashboard.transactions`
    (which works, but is fragile if the package ever moves).
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.transactions"
    label = "transactions"
    verbose_name = "Transactions Ledger"