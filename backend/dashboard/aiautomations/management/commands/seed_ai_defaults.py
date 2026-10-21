from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from dashboard.aiautomations.models import (
    AIAlert,
    AIAutomation,
    AIInsight,
    AISettings,
)


DEFAULT_AUTOMATIONS = [
    {
        "name": "Order Confirmation",
        "kind": "custom",
        "trigger": "Order placed",
        "action": "Send WhatsApp confirmation",
        "description": "Sends a WhatsApp confirmation to the customer as soon as an order is placed.",
        "trigger_config": {},
        "action_config": {"template": "Hi {name}, your order has been received. We'll update you when it ships."},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Shipping Update",
        "kind": "custom",
        "trigger": "Order status → Shipped",
        "action": "Send WhatsApp tracking link",
        "description": "Sends the tracking link as soon as the order is marked shipped.",
        "trigger_config": {},
        "action_config": {"template": "Hi {name}, your order is on the way! Track it here: {tracking_url}"},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Delivery Confirmation",
        "kind": "custom",
        "trigger": "Order status → Delivered",
        "action": "Send WhatsApp thank-you + review request",
        "description": "Thanks the customer after delivery and asks for a review.",
        "trigger_config": {},
        "action_config": {"template": "Thanks for shopping with us, {name}! Would you leave a quick review? {review_url}"},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Abandoned Cart Recovery",
        "kind": "abandoned_cart",
        "trigger": "Cart abandoned for 1 hour",
        "action": "Send WhatsApp reminder",
        "description": "Nudges customers who left items in their cart over an hour ago.",
        "trigger_config": {"idle_minutes": 60},
        "action_config": {"template": "Hi {name}, you left something in your cart. Finish up here: {cart_url}"},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "interval",
        "schedule_interval_minutes": 30,
        "cooldown_minutes": 1440,
        "max_runs_per_day": 500,
    },
    {
        "name": "Payment Reminder",
        "kind": "pending_order",
        "trigger": "Order unpaid for 24 hours",
        "action": "Send WhatsApp payment link",
        "description": "Reminds customers whose orders are still unpaid after 24 hours.",
        "trigger_config": {"idle_hours": 24},
        "action_config": {"template": "Hi {name}, your order {reference} is still awaiting payment."},
        "status": "Paused",
        "is_enabled": False,
        "schedule_kind": "hourly",
    },
    {
        "name": "Welcome Message",
        "kind": "custom",
        "trigger": "First message from new customer",
        "action": "Send welcome + catalog link",
        "description": "Greets first-time WhatsApp contacts with a catalogue link.",
        "trigger_config": {},
        "action_config": {"template": "Hi {name}, welcome! Browse our catalogue here: {catalog_url}"},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Low Stock Alert",
        "kind": "low_stock",
        "trigger": "Stock below threshold",
        "action": "Notify admin team",
        "description": "Alerts the admin team when any product falls to or below its low-stock threshold.",
        "trigger_config": {"threshold": 5},
        "action_config": {"to_wa_id": ""},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "interval",
        "schedule_interval_minutes": 60,
        "cooldown_minutes": 120,
    },
    {
        "name": "VIP Customer Alert",
        "kind": "custom",
        "trigger": "Customer total spend > KES 50,000",
        "action": "Tag as VIP + notify admin",
        "description": "Tags the customer as VIP and notifies the owner.",
        "trigger_config": {"min_total_spend": 50000},
        "action_config": {"tag": "vip"},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Creator Commission Due",
        "kind": "custom",
        "trigger": "Creator sales logged",
        "action": "Notify finance team",
        "description": "Notifies finance when a creator's commission crosses the payout threshold.",
        "trigger_config": {"min_commission": 1000},
        "action_config": {},
        "status": "Draft",
        "is_enabled": False,
        "schedule_kind": "manual",
    },
    {
        "name": "Daily Sales Summary",
        "kind": "sales_summary",
        "trigger": "Daily sales summary",
        "action": "Send summary to owner",
        "description": "Emails / WhatsApps the owner a daily revenue summary.",
        "trigger_config": {"hour": 20},
        "action_config": {"to_wa_id": ""},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "daily",
        "schedule_cron": "0 20 * * *",
    },
    {
        "name": "Newsletter Performance",
        "kind": "newsletter_perf",
        "trigger": "Newsletter sent",
        "action": "Report open + click rate",
        "description": "Sends an open/click report 24h after a newsletter goes out.",
        "trigger_config": {"delay_hours": 24},
        "action_config": {"to_wa_id": ""},
        "status": "Paused",
        "is_enabled": False,
        "schedule_kind": "event",
    },
    {
        "name": "Unusual Sales Spike",
        "kind": "unusual_change",
        "trigger": "Sales > 3x 7-day average",
        "action": "Notify admin team",
        "description": "Alerts when daily sales exceed 3× the 7-day average.",
        "trigger_config": {"multiplier": 3, "window_days": 7},
        "action_config": {"to_wa_id": ""},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "daily",
    },
    {
        "name": "Failed Payment Follow-up",
        "kind": "failed_payment",
        "trigger": "Payment failed",
        "action": "Notify customer + admin",
        "description": "Reaches out after a payment fails, and pings the admin team.",
        "trigger_config": {},
        "action_config": {"template": "Your payment didn't go through. Please try again: {retry_url}"},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Return Request Notification",
        "kind": "return_refund",
        "trigger": "Return requested",
        "action": "Notify customer + admin",
        "description": "Notifies both customer and admin when a return is opened.",
        "trigger_config": {},
        "action_config": {},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Return Rejected",
        "kind": "return_refund",
        "trigger": "Return rejected",
        "action": "Notify customer",
        "description": "Informs the customer when a return request is rejected.",
        "trigger_config": {},
        "action_config": {},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Low-Rated Review Alert",
        "kind": "review_alert",
        "trigger": "Review with rating ≤ 3",
        "action": "Notify admin team",
        "description": "Pings the admin team when a review lands at 3 stars or below.",
        "trigger_config": {"max_rating": 3},
        "action_config": {"to_wa_id": ""},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "Churn Win-Back",
        "kind": "churn_win_back",
        "trigger": "Customer inactive for 90 days",
        "action": "Send WhatsApp win-back offer",
        "description": "Sends a win-back offer to customers who haven't ordered in 90 days.",
        "trigger_config": {"idle_days": 90},
        "action_config": {"template": "Hi {name}, we miss you! Here's 10% off your next order — use code WELCOME10 at checkout."},
        "status": "Paused",
        "is_enabled": False,
        "schedule_kind": "daily",
    },
    {
        "name": "New Signup Welcome",
        "kind": "custom",
        "trigger": "Customer signed up",
        "action": "Send WhatsApp welcome",
        "description": "Welcomes new customers and links to the catalogue.",
        "trigger_config": {},
        "action_config": {"template": "Welcome, {name}! Explore our store and enjoy fast delivery."},
        "status": "Active",
        "is_enabled": True,
        "schedule_kind": "event",
    },
    {
        "name": "TikTok Order Alert",
        "kind": "custom",
        "trigger": "TikTok order received",
        "action": "Notify admin team",
        "description": "Notifies the team when a TikTok Shop order comes in.",
        "trigger_config": {},
        "action_config": {"to_wa_id": ""},
        "status": "Draft",
        "is_enabled": False,
        "schedule_kind": "event",
    },
    {
        "name": "Settings Drift Alert",
        "kind": "custom",
        "trigger": "Settings changed",
        "action": "Notify admin team",
        "description": "Warns the owner when a store setting is changed by staff.",
        "trigger_config": {},
        "action_config": {"to_wa_id": ""},
        "status": "Draft",
        "is_enabled": False,
        "schedule_kind": "event",
    },
]


DEFAULT_ALERTS = [
    {
        "severity": "high",
        "category": "inventory",
        "source": "system",
        "title": "Some products are out of stock",
        "description": "Open Inventory to see which products need restocking.",
        "href": "/admin/inventory",
        "action_label": "Open Inventory",
        "count": 1,
    },
    {
        "severity": "medium",
        "category": "orders",
        "source": "system",
        "title": "Orders awaiting payment",
        "description": "Review unpaid orders that need a reminder.",
        "href": "/admin/orders",
        "action_label": "Review Orders",
        "count": 1,
    },
    {
        "severity": "medium",
        "category": "returns",
        "source": "system",
        "title": "Return requests pending",
        "description": "Some returns are awaiting approval.",
        "href": "/admin/returnsrefunds",
        "action_label": "Review Returns",
        "count": 1,
    },
    {
        "severity": "high",
        "category": "payments",
        "source": "system",
        "title": "Failed payments detected",
        "description": "Some payments have failed recently and may need a retry.",
        "href": "/admin/payments",
        "action_label": "Review Payments",
        "count": 1,
    },
    {
        "severity": "medium",
        "category": "messages",
        "source": "system",
        "title": "Unread WhatsApp conversations",
        "description": "There are customer chats awaiting a reply.",
        "href": "/admin/whatsapp",
        "action_label": "Open Inbox",
        "count": 1,
    },
    {
        "severity": "low",
        "category": "customers",
        "source": "system",
        "title": "Churn-risk customers",
        "description": "Some customers haven't ordered in over 90 days.",
        "href": "/admin/customers",
        "action_label": "Review Customers",
        "count": 1,
    },
]


DEFAULT_INSIGHTS = [
    {
        "category": "sales",
        "priority": "medium",
        "text": "Revenue is trending upward. Review channel performance to double down on the best channel.",
        "action_label": "Open Analytics",
        "href": "/admin/analytics",
    },
    {
        "category": "inventory",
        "priority": "high",
        "text": "A handful of products are close to stockout. Consider reordering the top sellers this week.",
        "action_label": "Open Inventory",
        "href": "/admin/inventory",
    },
    {
        "category": "customer",
        "priority": "low",
        "text": "Repeat customers are your highest-value segment this month — consider a VIP loyalty nudge.",
        "action_label": "Open Customers",
        "href": "/admin/customers",
    },
    {
        "category": "channel",
        "priority": "medium",
        "text": "WhatsApp is outperforming other channels this week. Consider scaling broadcasts to similar segments.",
        "action_label": "Open WhatsApp",
        "href": "/admin/whatsapp",
    },
    {
        "category": "sales",
        "priority": "high",
        "text": "Payment failure rate has risen recently. Review failed payments to prevent lost revenue.",
        "action_label": "Review Payments",
        "href": "/admin/payments",
    },
]


class Command(BaseCommand):
    help = "Seed default AI settings, automations, alerts, and insights."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing automations/alerts/insights and re-seed.",
        )
        parser.add_argument(
            "--with-alerts",
            action="store_true",
            help="Also seed default alerts (skipped if any exist).",
        )
        parser.add_argument(
            "--with-insights",
            action="store_true",
            help="Also seed default insights (skipped if any exist).",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Shortcut for --with-alerts --with-insights.",
        )

    def handle(self, *args, **options):
        reset = bool(options.get("reset"))
        with_alerts = bool(options.get("with_alerts") or options.get("all"))
        with_insights = bool(options.get("with_insights") or options.get("all"))

        try:
            with transaction.atomic():
                self._seed_settings()
                self._seed_automations(reset=reset)
                if with_alerts:
                    self._seed_alerts(reset=reset)
                if with_insights:
                    self._seed_insights(reset=reset)
        except Exception as exc:  # noqa: BLE001
            self.stderr.write(self.style.ERROR(f"Seeding failed: {exc}"))
            raise

        self.stdout.write(self.style.SUCCESS("AI defaults seeded."))

    def _seed_settings(self) -> None:
        cfg = AISettings.get_solo()
        changed: list[str] = []

        if not cfg.model:
            cfg.model = "llama-3.3-70b-versatile"
            changed.append("model")

        if not cfg.provider:
            cfg.provider = "groq"
            changed.append("provider")

        if cfg.masking is None:
            cfg.masking = True
            changed.append("masking")

        if cfg.audit_retention_days in (None, 0):
            cfg.audit_retention_days = 30
            changed.append("audit_retention_days")

        if cfg.conversation_retention_days in (None, 0):
            cfg.conversation_retention_days = 90
            changed.append("conversation_retention_days")

        if cfg.temperature is None:
            cfg.temperature = 0.3
            changed.append("temperature")

        if not cfg.max_output_tokens:
            cfg.max_output_tokens = 1024
            changed.append("max_output_tokens")

        if cfg.monthly_budget_kes in (None, 0):
            cfg.monthly_budget_kes = 1000
            changed.append("monthly_budget_kes")

        if changed:
            cfg.save(update_fields=changed + ["updated_at"])
            self.stdout.write(f"  · settings updated: {', '.join(changed)}")
        else:
            self.stdout.write("  · settings already initialised")

    def _seed_automations(self, *, reset: bool) -> None:
        if reset:
            deleted, _ = AIAutomation.objects.all().delete()
            self.stdout.write(f"  · cleared {deleted} existing automation row(s)")

        created = 0
        updated = 0

        for spec in DEFAULT_AUTOMATIONS:
            name = spec["name"]
            defaults = {k: v for k, v in spec.items() if k != "name"}

            defaults.setdefault("timezone", "Africa/Nairobi")
            defaults.setdefault("cooldown_minutes", 0)
            defaults.setdefault("max_runs_per_day", 0)
            defaults.setdefault("requires_approval", False)

            auto, was_created = AIAutomation.objects.get_or_create(
                name=name,
                defaults=defaults,
            )
            if was_created:
                created += 1
                continue

            dirty = []
            for field in (
                "kind",
                "description",
                "trigger",
                "action",
                "trigger_config",
                "action_config",
                "schedule_kind",
                "schedule_interval_minutes",
                "schedule_cron",
                "timezone",
                "cooldown_minutes",
                "max_runs_per_day",
                "requires_approval",
            ):
                if field in defaults and getattr(auto, field, None) in (None, "", {}, []):
                    setattr(auto, field, defaults[field])
                    dirty.append(field)

            if dirty:
                auto.save(update_fields=dirty + ["updated_at"])
                updated += 1

        self.stdout.write(
            f"  · automations: {created} created, {updated} updated, "
            f"{AIAutomation.objects.count()} total"
        )

    def _seed_alerts(self, *, reset: bool) -> None:
        if reset:
            deleted, _ = AIAlert.objects.all().delete()
            self.stdout.write(f"  · cleared {deleted} existing alert row(s)")

        if AIAlert.objects.exists():
            self.stdout.write("  · alerts already exist — skipped")
            return

        now = timezone.now()
        created = 0
        for spec in DEFAULT_ALERTS:
            AIAlert.objects.create(**spec)
            created += 1

        AIAlert.objects.filter(
            created_at__gte=now - timedelta(seconds=10)
        ).update(expires_at=now + timedelta(days=7))

        self.stdout.write(f"  · alerts: {created} created")

    def _seed_insights(self, *, reset: bool) -> None:
        if reset:
            deleted, _ = AIInsight.objects.all().delete()
            self.stdout.write(f"  · cleared {deleted} existing insight row(s)")

        if AIInsight.objects.exists():
            self.stdout.write("  · insights already exist — skipped")
            return

        now = timezone.now()
        created = 0
        for spec in DEFAULT_INSIGHTS:
            AIInsight.objects.create(**spec)
            created += 1

        AIInsight.objects.filter(
            created_at__gte=now - timedelta(seconds=10)
        ).update(expires_at=now + timedelta(days=14))

        self.stdout.write(f"  · insights: {created} created")