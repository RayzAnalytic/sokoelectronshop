import logging
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings as dj_settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    WhatsAppAccount,
    WhatsAppAlert,
    WhatsAppAttributionEvent,
    WhatsAppAuditEntry,
    WhatsAppAutomation,
    WhatsAppBotFlow,
    WhatsAppBotNode,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppConsentLog,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppIntegrationError,
    WhatsAppInvoice,
    WhatsAppMessage,
    WhatsAppMessageLog,
    WhatsAppMessagingCost,
    WhatsAppNotification,
    WhatsAppNotificationConfig,
    WhatsAppOrder,
    WhatsAppProductShare,
    WhatsAppQuickReply,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTeamMember,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
    WhatsAppWorkflowRun,
)
from .serializers import (
    AccountSerializer,
    AlertItemSerializer,
    AuditEntrySerializer,
    AutomationSerializer,
    BotFlowSerializer,
    BotFlowWriteSerializer,
    BroadcastSerializer,
    CampaignSerializer,
    CatalogItemSerializer,
    CatalogSerializer,
    CatalogueInfoSerializer,
    CommerceProductSerializer,
    ConnectionSerializer,
    ConnectionSummarySerializer,
    ContactSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    HealthInfoSerializer,
    InboxConversationContextSerializer,
    InboxConversationSerializer,
    InboxCustomerDetailSerializer,
    InboxCustomerOrderSerializer,
    InboxMessageSerializer,
    InboxRecentConversationSerializer,
    InvoiceSerializer,
    MessageLogSerializer,
    MessageSerializer,
    MessageTemplateSerializer,
    NotificationConfigSerializer,
    NotificationSerializer,
    OrderSerializer,
    ProductSearchResultSerializer,
    ProductShareSerializer,
    QuickReplySerializer,
    SegmentSerializer,
    SettingsSerializer,
    TeamMemberSerializer,
    TemplateSerializer,
    WebhookEventSerializer,
    WorkflowSerializer,
)
from .services import (
    log_webhook_event,
    meta_client,
    refresh_account_status,
    send_broadcast,
    submit_template,
    sync_catalog,
    sync_templates,
)

logger = logging.getLogger("whatsapp")

DecimalZero = Decimal("0.00")

_dev_no_auth_raw = getattr(dj_settings, "WHATSAPP_DEV_NO_AUTH", None)
if _dev_no_auth_raw is not None:
    _dev_no_auth = bool(_dev_no_auth_raw)
else:
    _dev_no_auth = bool(dj_settings.DEBUG)

DEV_PERMS = [AllowAny] if _dev_no_auth else [IsAuthenticated]
logger.info(
    "WhatsApp views permission mode: %s (DEBUG=%s WHATSAPP_DEV_NO_AUTH=%s)",
    "AllowAny" if _dev_no_auth else "IsAuthenticated",
    dj_settings.DEBUG,
    _dev_no_auth_raw,
)


def public_media_url(image_field) -> str:
    if not image_field:
        return ""
    base = getattr(dj_settings, "PUBLIC_BASE_URL", "").rstrip("/")
    return f"{base}{image_field.url}"


class WhatsAppBaseView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []


class WhatsAppListAPIView(ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None


def _audit(request, action, target="", payload=None):
    actor = getattr(request, "user", None)
    WhatsAppAuditEntry.objects.create(
        actor=actor if actor and actor.is_authenticated else None,
        actor_name=(actor.get_username() if actor and actor.is_authenticated else "system"),
        action=action,
        target=target,
        payload=payload or {},
    )


def _metric(value, previous=None, available=True):
    return {
        "value": value if available else None,
        "previous": previous if available else None,
        "available": available,
    }


def _resolve_period_bounds(period: str, from_str: str = "", to_str: str = ""):
    now = timezone.now()
    today = now.date()

    if period == "today":
        start_date = today
        end_date = today
    elif period == "7d":
        end_date = today
        start_date = today - timedelta(days=6)
    elif period == "90d":
        end_date = today
        start_date = today - timedelta(days=89)
    elif period == "custom":
        parsed_from = parse_date(from_str) if from_str else None
        parsed_to = parse_date(to_str) if to_str else None
        start_date = parsed_from or (today - timedelta(days=29))
        end_date = parsed_to or today
        if start_date > end_date:
            start_date, end_date = end_date, start_date
    else:  # default 30d
        end_date = today
        start_date = today - timedelta(days=29)

    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime.combine(start_date, time.min), tz)
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min), tz)

    span_days = max(1, (end_date - start_date).days + 1)
    prev_end_dt = start_dt
    prev_start_dt = start_dt - timedelta(days=span_days)
    return start_dt, end_dt, prev_start_dt, prev_end_dt, start_date, end_date


DEFAULT_NOTIFICATION_CONFIGS = [
    ("order_created", "Order created", "Sent when a customer places a new order.", False, True),
    ("payment_confirmed", "Payment confirmed", "Sent once payment is verified by the Payments system.", False, True),
    ("payment_failed", "Payment failed", "Sent when a payment attempt fails or times out.", False, True),
    ("order_processing", "Order processing", "Sent when an order moves into fulfillment.", False, True),
    ("order_dispatched", "Order dispatched", "Sent when delivery is handed over to a rider or courier.", False, True),
    ("order_delivered", "Order delivered", "Sent upon confirmed delivery to the customer.", False, True),
    ("order_cancelled", "Order cancelled", "Sent if an order is cancelled before fulfillment.", False, True),
    ("refund_processed", "Refund processed", "Sent when a refund has been completed.", False, True),
]


def _ensure_notification_configs():
    if not WhatsAppNotificationConfig.objects.exists():
        for event, label, desc, req_consent, req_verified in DEFAULT_NOTIFICATION_CONFIGS:
            WhatsAppNotificationConfig.objects.get_or_create(
                event=event,
                defaults={
                    "label": label,
                    "description": desc,
                    "requires_consent": req_consent,
                    "requires_verified_state": req_verified,
                },
            )


# ---------------------------------------------------------------------------
# 1. Topbar, Connection & Health Views
# ---------------------------------------------------------------------------

class ConnectionView(WhatsAppBaseView):
    """GET /api/whatsapp/connection"""

    def get(self, request):
        account = WhatsAppAccount.get_solo()
        if getattr(settings, 'WHATSAPP_DRY_RUN', False):
            account.connection_state = 'connected'
        return Response(ConnectionSerializer(account).data)


class ConnectionConnectView(WhatsAppBaseView):
    """POST /api/whatsapp/connection/connect"""

    def post(self, request):
        
        account.connection_state = "connecting"
        account.save(update_fields=["connection_state", "updated_at"])
        _audit(request, "connection.connect", f"account:{account.pk}")

        app_id = getattr(dj_settings, "META_APP_ID", "")
        config_id = getattr(dj_settings, "META_WA_EMBEDDED_SIGNUP_CONFIG_ID", "")
        redirect_uri = getattr(
            dj_settings,
            "META_WA_OAUTH_REDIRECT_URI",
            f"{getattr(dj_settings, 'PUBLIC_BASE_URL', '').rstrip('/')}/whatsapp/analytics?tab=connection",
        )
        if app_id and config_id:
            onboarding_url = (
                f"https://www.facebook.com/v20.0/dialog/oauth"
                f"?client_id={app_id}&config_id={config_id}"
                f"&response_type=code&redirect_uri={redirect_uri}"
            )
        else:
            onboarding_url = "/whatsapp/analytics?tab=connection"
        return Response({"onboardingUrl": onboarding_url})


class ConnectionReauthView(WhatsAppBaseView):
    """POST /api/whatsapp/connection/reauth"""

    def post(self, request):
        
        _audit(request, "connection.reauth", f"account:{account.pk}")
        return ConnectionConnectView().post(request)


class ConnectionDisconnectView(WhatsAppBaseView):
    """POST /api/whatsapp/connection/disconnect"""

    def post(self, request):
        
        account.is_active = False
        account.connection_state = "disconnected"
        account.access_token = ""
        account.save(
            update_fields=["is_active", "connection_state", "access_token", "updated_at"]
        )
        _audit(request, "connection.disconnect", f"account:{account.pk}")
        return Response(ConnectionSerializer(account).data)


class HealthView(WhatsAppBaseView):
    """GET /api/whatsapp/health"""

    def get(self, request):
        
        since_24h = timezone.now() - timedelta(hours=24)
        failed_24h = WhatsAppIntegrationError.objects.filter(
            kind="api", created_at__gte=since_24h
        ).count()
        recent_errors = WhatsAppIntegrationError.objects.filter(resolved=False)[:20]

        payload = {
            "api": {
                "status": account.api_status or "ok",
                "lastRequestAt": account.last_api_request_at,
                "failedRequests24h": failed_24h,
            },
            "webhook": {
                "status": account.webhook_status or "ok",
                "lastEventAt": account.last_webhook_event_at,
                "verified": bool(account.webhook_verified),
            },
            "token": {
                "status": account.token_status,
                "expiresAt": account.token_expires_at,
            },
            "errors": recent_errors,
        }
        return Response(HealthInfoSerializer(payload).data)


# ---------------------------------------------------------------------------
# 2. Overview Page View
# ---------------------------------------------------------------------------

class OverviewView(WhatsAppBaseView):
    """GET /api/whatsapp/overview?period=7d|30d|90d"""

    def get(self, request):
        period = request.query_params.get("period", "30d")
        if period not in ("7d", "30d", "90d"):
            period = "30d"

        start_dt, end_dt, prev_start_dt, prev_end_dt, start_date, end_date = (
            _resolve_period_bounds(period)
        )
        
        connected = account.connection_state == "connected"

        if not connected:
            return Response(
                {
                    "connection": ConnectionSummarySerializer(account).data,
                    "period": period,
                    "messaging": None,
                    "customerCommerce": None,
                    "chart": [],
                    "conversations": [],
                    "products": None,
                    "automation": None,
                    "alerts": [],
                }
            )

        # Messaging KPIs
        cur_msgs = WhatsAppMessage.objects.filter(
            timestamp__gte=start_dt, timestamp__lt=end_dt, is_internal_note=False
        )
        prev_msgs = WhatsAppMessage.objects.filter(
            timestamp__gte=prev_start_dt, timestamp__lt=prev_end_dt, is_internal_note=False
        )

        cur_out = cur_msgs.filter(direction="OUT")
        prev_out = prev_msgs.filter(direction="OUT")

        cur_active_conv = WhatsAppConversation.objects.filter(status__in=["OPEN", "PENDING"]).count()
        cur_unanswered = WhatsAppConversation.objects.filter(
            status__in=["OPEN", "PENDING"], unread_count__gt=0
        ).count()

        messaging_data = {
            "sent": _metric(cur_out.count(), prev_out.count()),
            "delivered": _metric(
                cur_out.filter(status__in=["DELIVERED", "READ"]).count(),
                prev_out.filter(status__in=["DELIVERED", "READ"]).count(),
            ),
            "read": _metric(
                cur_out.filter(status="READ").count(),
                prev_out.filter(status="READ").count(),
            ),
            "failed": _metric(
                cur_out.filter(status="FAILED").count(),
                prev_out.filter(status="FAILED").count(),
            ),
            "incoming": _metric(
                cur_msgs.filter(direction="IN").count(),
                prev_msgs.filter(direction="IN").count(),
            ),
            "outgoing": _metric(cur_out.count(), prev_out.count()),
            "activeConversations": _metric(cur_active_conv, None),
            "unansweredConversations": _metric(cur_unanswered, None),
        }

        # Customer & Commerce KPIs
        cur_new_contacts = WhatsAppContact.objects.filter(
            created_at__gte=start_dt, created_at__lt=end_dt
        ).count()
        prev_new_contacts = WhatsAppContact.objects.filter(
            created_at__gte=prev_start_dt, created_at__lt=prev_end_dt
        ).count()

        cur_returning = WhatsAppContact.objects.filter(
            last_inbound_at__gte=start_dt, last_inbound_at__lt=end_dt, order_count__gte=1
        ).count()
        prev_returning = WhatsAppContact.objects.filter(
            last_inbound_at__gte=prev_start_dt, last_inbound_at__lt=prev_end_dt, order_count__gte=1
        ).count()

        cur_attr = WhatsAppAttributionEvent.objects.filter(
            occurred_at__gte=start_dt, occurred_at__lt=end_dt
        )
        prev_attr = WhatsAppAttributionEvent.objects.filter(
            occurred_at__gte=prev_start_dt, occurred_at__lt=prev_end_dt
        )

        cur_enquiries = cur_attr.filter(event_type="enquiry").count()
        prev_enquiries = prev_attr.filter(event_type="enquiry").count()
        cur_visits = cur_attr.filter(event_type="referred_visit").count()
        prev_visits = prev_attr.filter(event_type="referred_visit").count()
        cur_orders_attr = cur_attr.filter(event_type="attributed_order")
        prev_orders_attr = prev_attr.filter(event_type="attributed_order")

        cur_wa_orders = WhatsAppOrder.objects.filter(
            created_at__gte=start_dt, created_at__lt=end_dt
        )
        prev_wa_orders = WhatsAppOrder.objects.filter(
            created_at__gte=prev_start_dt, created_at__lt=prev_end_dt
        )

        attr_orders_count = cur_orders_attr.count() or cur_wa_orders.count()
        prev_orders_count = prev_orders_attr.count() or prev_wa_orders.count()
        attr_revenue = float(
            (cur_orders_attr.aggregate(t=Sum("revenue"))["t"] or DecimalZero)
            or (cur_wa_orders.aggregate(t=Sum("total"))["t"] or DecimalZero)
        )
        prev_revenue = float(
            (prev_orders_attr.aggregate(t=Sum("revenue"))["t"] or DecimalZero)
            or (prev_wa_orders.aggregate(t=Sum("total"))["t"] or DecimalZero)
        )

        customer_commerce_data = {
            "newContacts": _metric(cur_new_contacts, prev_new_contacts),
            "returningCustomers": _metric(cur_returning, prev_returning),
            "enquiries": _metric(cur_enquiries, prev_enquiries),
            "referredVisits": _metric(cur_visits, prev_visits),
            "attributedOrders": _metric(attr_orders_count, prev_orders_count),
            "attributedRevenue": _metric(attr_revenue, prev_revenue),
        }

        # Chart series
        daily_rows = (
            cur_msgs.annotate(day=TruncDate("timestamp"))
            .values("day")
            .annotate(
                sent=Count("id", filter=Q(direction="OUT")),
                delivered=Count("id", filter=Q(direction="OUT", status__in=["DELIVERED", "READ"])),
                read=Count("id", filter=Q(direction="OUT", status="READ")),
                failed=Count("id", filter=Q(direction="OUT", status="FAILED")),
                incoming=Count("id", filter=Q(direction="IN")),
            )
            .order_by("day")
        )
        by_day = {r["day"]: r for r in daily_rows if r["day"]}
        chart = []
        cursor = start_date
        while cursor <= end_date:
            row = by_day.get(cursor, {})
            chart.append(
                {
                    "date": cursor.strftime("%b %d"),
                    "sent": row.get("sent", 0),
                    "delivered": row.get("delivered", 0),
                    "read": row.get("read", 0),
                    "failed": row.get("failed", 0),
                    "incoming": row.get("incoming", 0),
                }
            )
            cursor += timedelta(days=1)

        # Recent conversations
        recent_convs = WhatsAppConversation.objects.select_related(
            "contact", "contact__user", "assigned_to"
        ).order_by("-last_message_at", "-id")[:5]

        # Product & Sales activity
        recent_shares = WhatsAppProductShare.objects.all()[:5]
        recent_order_logs = WhatsAppMessageLog.objects.filter(
            order__isnull=False
        ).order_by("-sent_at")[:5]
        sync_issues = WhatsAppCatalogItem.objects.filter(
            sync_status__in=["failed", "pending"]
        ).count()

        products_data = {
            "recentlyShared": [
                {
                    "productId": str(s.store_product_id or s.catalog_item_id or s.pk),
                    "name": s.product_name,
                    "sharedAt": s.shared_at.isoformat(),
                }
                for s in recent_shares
            ],
            "productEnquiries": cur_enquiries,
            "syncIssues": sync_issues,
            "whatsappOrders": attr_orders_count,
            "recentNotifications": [
                {
                    "orderId": str(log.order_id),
                    "reference": log.order_reference or f"#{log.order_id}",
                    "status": log.status,
                    "at": log.sent_at.isoformat(),
                }
                for log in recent_order_logs
            ],
        }

        # Automation & Campaigns
        runs_qs = WhatsAppWorkflowRun.objects.filter(
            executed_at__gte=start_dt, executed_at__lt=end_dt
        )
        tpl_alerts = WhatsAppTemplate.objects.filter(
            status__in=["APPROVED", "REJECTED", "PENDING"]
        ).order_by("-updated_at")[:5]

        automation_data = {
            "activeAutomations": WhatsAppAutomation.objects.filter(status="ACTIVE").count(),
            "successfulRuns": runs_qs.filter(result="success").count(),
            "failedRuns": runs_qs.filter(result="failed").count(),
            "scheduledCampaigns": WhatsAppBroadcast.objects.filter(status="SCHEDULED").count(),
            "campaignsNeedingAttention": WhatsAppBroadcast.objects.filter(
                status="FAILED"
            ).count(),
            "templateAlerts": [
                {
                    "templateId": str(t.pk),
                    "name": t.name,
                    "status": t.status.lower() if t.status in ("APPROVED", "REJECTED", "PENDING") else "pending",
                    "at": t.updated_at.isoformat(),
                }
                for t in tpl_alerts
            ],
        }

        alerts = AlertItemSerializer(
            WhatsAppAlert.objects.filter(is_active=True)[:10], many=True
        ).data

        return Response(
            {
                "connection": ConnectionSummarySerializer(account).data,
                "period": period,
                "messaging": messaging_data,
                "customerCommerce": customer_commerce_data,
                "chart": chart,
                "conversations": InboxRecentConversationSerializer(recent_convs, many=True).data,
                "products": products_data,
                "automation": automation_data,
                "alerts": alerts,
            }
        )


# ---------------------------------------------------------------------------
# 3. Account, Settings, Team, Audit & Notifications (Existing + Compatible)
# ---------------------------------------------------------------------------

class AccountView(WhatsAppBaseView):
    def get(self, request):
        return Response(AccountSerializer(WhatsAppAccount.get_solo()).data)


class AccountRefreshView(WhatsAppBaseView):
    def post(self, request):
        
        refresh_account_status(account)
        _audit(request, "account.refresh", f"account:{account.pk}")
        account.refresh_from_db()
        return Response(AccountSerializer(account).data)


class AccountSetActiveView(WhatsAppBaseView):
    def post(self, request):
        
        account.is_active = bool(request.data.get("is_active", not account.is_active))
        account.connection_state = "connected" if account.is_active else "disconnected"
        account.save(update_fields=["is_active", "connection_state"])
        _audit(request, "account.set_active", payload={"is_active": account.is_active})
        return Response(AccountSerializer(account).data)


class SettingsView(WhatsAppBaseView):
    def get(self, request):
        return Response(SettingsSerializer(WhatsAppSettings.get_solo()).data)

    def patch(self, request):
        instance = WhatsAppSettings.get_solo()
        serializer = SettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        _audit(request, "settings.update")
        return Response(SettingsSerializer(instance).data)


class TeamListView(WhatsAppBaseView):
    def get(self, request):
        return Response(TeamMemberSerializer(WhatsAppTeamMember.objects.all(), many=True).data)


class StaffListView(WhatsAppBaseView):
    """GET /api/staff?role=whatsapp_agent — used by Inbox assign dropdown"""

    def get(self, request):
        members = WhatsAppTeamMember.objects.select_related("user").filter(active=True)
        return Response(
            [
                {
                    "id": str(m.user_id),
                    "name": m.user.get_full_name() or m.user.get_username(),
                }
                for m in members
            ]
        )


class AuditListView(WhatsAppBaseView):
    def get(self, request):
        qs = WhatsAppAuditEntry.objects.all()[:200]
        return Response(AuditEntrySerializer(qs, many=True).data)


class NotificationsView(WhatsAppBaseView):
    def get(self, request):
        qs = WhatsAppNotification.objects.all()[:50]
        return Response(NotificationSerializer(qs, many=True).data)


class NotificationsMarkAllReadView(WhatsAppBaseView):
    def post(self, request):
        WhatsAppNotification.objects.filter(read=False).update(read=True)
        return Response({"ok": True})


class NotificationMarkReadView(WhatsAppBaseView):
    def post(self, request, pk):
        WhatsAppNotification.objects.filter(pk=pk).update(read=True)
        return Response({"ok": True})


# ---------------------------------------------------------------------------
# 4. Commerce & Campaigns Views
# ---------------------------------------------------------------------------

class CommerceCatalogueView(WhatsAppBaseView):
    """GET /api/whatsapp/commerce/catalogue"""

    def get(self, request):
        catalog = WhatsAppCatalog.get_solo()
        return Response(CatalogueInfoSerializer(catalog).data)


class CommerceProductListView(WhatsAppBaseView):
    """GET /api/whatsapp/commerce/products?q=...&status=...&sync=..."""

    def get(self, request):
        catalog = WhatsAppCatalog.get_solo()
        qs = catalog.items.all()

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(sku__icontains=q)
                | Q(retailer_id__icontains=q)
            )

        product_status = request.query_params.get("status")
        if product_status and product_status != "all":
            qs = qs.filter(product_status=product_status)

        sync_status = request.query_params.get("sync")
        if sync_status and sync_status != "all":
            qs = qs.filter(sync_status=sync_status)

        return Response(CommerceProductSerializer(qs, many=True).data)


class CommerceProductSyncView(WhatsAppBaseView):
    """POST /api/whatsapp/commerce/products/<pk>/sync"""

    def post(self, request, pk):
        item = WhatsAppCatalogItem.objects.filter(pk=pk).first()
        if not item:
            return Response({"detail": "Not found"}, status=404)

        item.sync_status = "syncing"
        item.save(update_fields=["sync_status", "updated_at"])

        try:
            sync_catalog(item.catalog)
            item.refresh_from_db()
            if item.sync_status == "syncing":
                item.sync_status = "synced"
                item.last_synced_at = timezone.now()
                item.last_error = ""
                item.save(update_fields=["sync_status", "last_synced_at", "last_error", "updated_at"])
        except Exception as exc:
            logger.exception("Product sync failed for item %s: %s", pk, exc)
            item.sync_status = "failed"
            item.last_error = str(exc)
            item.save(update_fields=["sync_status", "last_error", "updated_at"])

        _audit(request, "commerce.product.sync", f"item:{item.pk}")
        return Response(CommerceProductSerializer(item).data)


class ProductSharePrepareView(WhatsAppBaseView):
    """POST /api/whatsapp/products/share"""

    def post(self, request):
        product_id = request.data.get("product_id")
        mode = request.data.get("mode", "native")
        if mode not in ("native", "link"):
            mode = "native"
        if not product_id:
            return Response({"detail": "product_id required"}, status=400)

        item = WhatsAppCatalogItem.objects.filter(pk=product_id).first()
        if not item:
            return Response({"detail": "Product not found"}, status=404)

        if mode == "native" and not item.meta_product_id:
            return Response(
                {"detail": "Native product messaging requires product to be synced to Meta catalogue."},
                status=400,
            )

        user = request.user if request.user and request.user.is_authenticated else None
        share = WhatsAppProductShare.objects.create(
            catalog_item=item,
            store_product=item.store_product,
            product_name=item.name,
            shared_by=user,
            mode=mode,
            status="prepared",
        )
        _audit(request, "commerce.product.share", f"item:{item.pk}", {"mode": mode})
        return Response(ProductShareSerializer(share).data, status=201)


class ProductSearchView(WhatsAppBaseView):
    """GET /api/products/search?q=...&limit=8 — used by Inbox ProductPicker"""

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        try:
            limit = min(int(request.query_params.get("limit", 8)), 50)
        except (TypeError, ValueError):
            limit = 8

        qs = WhatsAppCatalogItem.objects.filter(product_status="active")
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(sku__icontains=q)
                | Q(retailer_id__icontains=q)
            )
        return Response(ProductSearchResultSerializer(qs[:limit], many=True).data)


class CampaignListView(WhatsAppBaseView):
    """GET /api/whatsapp/campaigns"""

    def get(self, request):
        qs = WhatsAppBroadcast.objects.select_related("template", "segment").prefetch_related(
            "products"
        )
        return Response(CampaignSerializer(qs, many=True).data)


class CatalogView(WhatsAppBaseView):
    def get(self, request):
        return Response(CatalogSerializer(WhatsAppCatalog.get_solo()).data)


class CatalogSyncView(WhatsAppBaseView):
    def post(self, request):
        catalog = WhatsAppCatalog.get_solo()
        sync_catalog(catalog)
        _audit(request, "catalog.sync", f"catalog:{catalog.pk}")
        return Response(CatalogSerializer(catalog).data)


class CatalogItemListView(WhatsAppBaseView):
    def get(self, request):
        catalog = WhatsAppCatalog.get_solo()
        qs = catalog.items.all()
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(retailer_id__icontains=search))
        sync_status = request.query_params.get("syncStatus")
        if sync_status:
            qs = qs.filter(sync_status=sync_status)
        return Response(CatalogItemSerializer(qs, many=True).data)


class CatalogItemDetailView(WhatsAppBaseView):
    def patch(self, request, pk):
        item = WhatsAppCatalogItem.objects.filter(pk=pk).first()
        if not item:
            return Response({"detail": "Not found"}, status=404)
        fields = []
        if "eligible" in request.data:
            item.eligible = bool(request.data["eligible"])
            fields.append("eligible")
        if "hidePrice" in request.data:
            item.hide_price = bool(request.data["hidePrice"])
            fields.append("hide_price")
        if "customTitle" in request.data:
            item.custom_title = request.data["customTitle"] or ""
            fields.append("custom_title")
        if fields:
            item.save(update_fields=fields + ["updated_at"])
        return Response(CatalogItemSerializer(item).data)


class CatalogItemBulkView(WhatsAppBaseView):
    def post(self, request):
        ids = request.data.get("ids") or []
        patch = request.data.get("patch") or {}
        if not ids:
            return Response({"detail": "ids required"}, status=400)
        qs = WhatsAppCatalogItem.objects.filter(pk__in=ids)
        updates = {}
        if "eligible" in patch:
            updates["eligible"] = bool(patch["eligible"])
        if updates:
            qs.update(**updates)
        return Response({"ok": True, "updated": qs.count()})


# ---------------------------------------------------------------------------
# 5. Inbox Views
# ---------------------------------------------------------------------------

class ConversationListView(WhatsAppListAPIView):
    def get_serializer_class(self):
        if "filter" in self.request.query_params or "q" in self.request.query_params:
            return InboxConversationSerializer
        return InboxConversationSerializer

    def get_queryset(self):
        qs = WhatsAppConversation.objects.select_related(
            "contact", "contact__user", "assigned_to"
        )
        search = (
            self.request.query_params.get("q")
            or self.request.query_params.get("search")
            or ""
        ).strip()
        if search:
            qs = qs.filter(
                Q(contact__profile_name__icontains=search)
                | Q(contact__wa_id__icontains=search)
                | Q(last_message_preview__icontains=search)
                | Q(orders__order_number__icontains=search)
            ).distinct()

        flt = self.request.query_params.get("filter") or self.request.query_params.get("tab")
        if flt == "unread":
            qs = qs.filter(unread_count__gt=0)
        elif flt in ("assigned_me", "mine"):
            user = self.request.user
            if user and user.is_authenticated:
                qs = qs.filter(assigned_to=user)
            else:
                qs = qs.none()
        elif flt == "unassigned":
            qs = qs.filter(assigned_to__isnull=True)
        elif flt == "open":
            qs = qs.filter(status="OPEN")
        elif flt == "pending":
            qs = qs.filter(status="PENDING")
        elif flt == "resolved":
            qs = qs.filter(status="RESOLVED")
        elif flt == "archived":
            qs = qs.filter(status="ARCHIVED")

        return qs


class ConversationDetailView(WhatsAppBaseView):
    def get(self, request, pk):
        conv = (
            WhatsAppConversation.objects.select_related("contact", "contact__user", "assigned_to")
            .prefetch_related("messages__attachments", "messages__author", "messages__template")
            .filter(pk=pk)
            .first()
        )
        if not conv:
            return Response({"detail": "Not found"}, status=404)
        if conv.unread_count:
            conv.unread_count = 0
            conv.save(update_fields=["unread_count"])

        is_open = conv.window_open
        expires_at = conv.service_window_expires_at
        customer_identified = bool(conv.contact.user_id or conv.contact.is_verified)

        payload = {
            "conversation": conv,
            "messages": conv.messages.all(),
            "customer": conv.contact if customer_identified else None,
            "window": {
                "isOpen": is_open,
                "expiresAt": expires_at.isoformat() if expires_at else None,
                "canSendFreeform": is_open,
                "requiresTemplate": not is_open,
            },
        }
        return Response(InboxConversationContextSerializer(payload).data)

    def patch(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)
        fields = []
        if "starred" in request.data:
            conv.starred = bool(request.data["starred"])
            fields.append("starred")
        if "status" in request.data:
            normalized = str(request.data["status"]).upper()
            if normalized in dict(WhatsAppConversation.STATUS_CHOICES):
                conv.status = normalized
                fields.append("status")
        if fields:
            conv.save(update_fields=fields + ["updated_at"])
        return Response(InboxConversationSerializer(conv).data)


class ConversationMessagesView(WhatsAppBaseView):
    def post(self, request, pk):
        conv = WhatsAppConversation.objects.select_related("contact").filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)

        body = (request.data.get("body") or "").strip()
        is_note = bool(
            request.data.get("is_internal_note") or request.data.get("isNote")
        )
        template_id = request.data.get("template_id")
        if not body:
            return Response({"detail": "body required"}, status=400)

        template = None
        if template_id:
            template = WhatsAppTemplate.objects.filter(pk=template_id).first()

        if not is_note and not conv.window_open and not template:
            return Response(
                {"detail": "Outside 24-hour customer-service window. Template required."},
                status=400,
            )

        author = request.user if request.user and request.user.is_authenticated else None
        send_status = "SENT"
        wa_id = ""
        error_msg = ""

        if not is_note:
            try:
                if template:
                    result = meta_client.send_template(
                        to=conv.contact.wa_id,
                        template_name=template.name,
                        language_code=template.language or "en",
                    )
                else:
                    result = meta_client.send_text(to=conv.contact.wa_id, body=body)
                wa_id = result.get("messages", [{}])[0].get("id", "")
            except Exception as exc:
                logger.exception("send message failed: %s", exc)
                send_status = "FAILED"
                error_msg = str(exc)

        now = timezone.now()
        msg = WhatsAppMessage.objects.create(
            conversation=conv,
            direction="OUT",
            type="note" if is_note else ("template" if template else "text"),
            body=body,
            status=send_status,
            error_message=error_msg,
            wa_message_id=wa_id,
            timestamp=now,
            template=template,
            template_name=template.name if template else "",
            author=author,
            is_internal_note=is_note,
        )

        if not is_note:
            WhatsAppMessageLog.objects.create(
                message=msg,
                wa_message_id=wa_id,
                contact=conv.contact,
                recipient=conv.contact.wa_id,
                customer_name=conv.contact.profile_name or "",
                template=template,
                template_name=template.name if template else "",
                category=(template.category.lower() if template else "utility"),
                status="failed" if send_status == "FAILED" else "sent",
                failure_reason=error_msg,
                sent_at=now,
            )

        conv.last_message_preview = body[:255]
        conv.last_message_at = now
        update_fields = ["last_message_preview", "last_message_at", "updated_at"]
        if not is_note and conv.first_response_at is None:
            conv.first_response_at = now
            update_fields.append("first_response_at")
        conv.save(update_fields=update_fields)

        _audit(request, "message.send", f"conversation:{conv.pk}", {"isNote": is_note})
        return Response(InboxMessageSerializer(msg).data, status=201)


class ConversationShareProductView(WhatsAppBaseView):
    """POST /api/whatsapp/conversations/<pk>/share-product"""

    def post(self, request, pk):
        conv = WhatsAppConversation.objects.select_related("contact").filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)

        product_id = request.data.get("product_id") or request.data.get("productId")
        if not product_id:
            return Response({"detail": "product_id required"}, status=400)

        item = WhatsAppCatalogItem.objects.filter(pk=product_id).first()
        if not item:
            item = WhatsAppCatalogItem.objects.filter(store_product_id=product_id).first()
        if not item:
            return Response({"detail": "Product not found"}, status=404)

        price_val = item.effective_price
        caption = f"{item.name}\n{item.currency} {price_val:,.2f}"
        if item.product_url:
            caption += f"\n{item.product_url}"

        image_url = item.display_image_url
        wa_id = ""
        send_status = "SENT"
        error_msg = ""

        try:
            if image_url:
                result = meta_client.send_image(
                    to=conv.contact.wa_id, link=image_url, caption=caption
                )
            else:
                result = meta_client.send_text(to=conv.contact.wa_id, body=caption)
            wa_id = result.get("messages", [{}])[0].get("id", "")
        except Exception as exc:
            logger.exception("share-product failed: %s", exc)
            send_status = "FAILED"
            error_msg = str(exc)

        now = timezone.now()
        author = request.user if request.user and request.user.is_authenticated else None
        msg = WhatsAppMessage.objects.create(
            conversation=conv,
            direction="OUT",
            type="image" if image_url else "text",
            status=send_status,
            error_message=error_msg,
            wa_message_id=wa_id,
            timestamp=now,
            body=caption,
            media_url=image_url or "",
            product_refs=[item.retailer_id],
            author=author,
        )
        WhatsAppProductShare.objects.create(
            catalog_item=item,
            store_product=item.store_product,
            product_name=item.name,
            conversation=conv,
            contact=conv.contact,
            shared_by=author,
            mode="native" if item.meta_product_id else "link",
            status="failed" if send_status == "FAILED" else "sent",
            shared_at=now,
        )
        conv.last_message_preview = caption[:255]
        conv.last_message_at = now
        conv.save(update_fields=["last_message_preview", "last_message_at", "updated_at"])
        _audit(request, "message.share_product", f"conversation:{conv.pk}", {"item_id": item.pk})
        return Response(InboxMessageSerializer(msg).data, status=201)


class ConversationStatusView(WhatsAppBaseView):
    """POST /api/whatsapp/conversations/<pk>/status"""

    def post(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)

        next_status = str(request.data.get("status") or "").upper()
        if next_status not in dict(WhatsAppConversation.STATUS_CHOICES):
            return Response({"detail": "Invalid status"}, status=400)

        conv.status = next_status
        fields = ["status", "updated_at"]
        if next_status == "RESOLVED":
            conv.resolved_at = timezone.now()
            fields.append("resolved_at")
        conv.save(update_fields=fields)
        _audit(request, "conversation.status", f"conversation:{conv.pk}", {"status": next_status})
        return Response(InboxConversationSerializer(conv).data)


class ConversationAssignView(WhatsAppBaseView):
    """POST /api/whatsapp/conversations/<pk>/assign"""

    def post(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)

        staff_id = request.data.get("staff_id")
        conv.assigned_to_id = int(staff_id) if staff_id else None
        conv.save(update_fields=["assigned_to", "updated_at"])
        _audit(request, "conversation.assign", f"conversation:{conv.pk}", {"staff_id": staff_id})
        return Response(InboxConversationSerializer(conv).data)


class CustomerOrdersView(WhatsAppBaseView):
    """GET /api/customers/<pk>/orders?limit=10 — used by Inbox CustomerPanel"""

    def get(self, request, pk):
        try:
            limit = min(int(request.query_params.get("limit", 10)), 50)
        except (TypeError, ValueError):
            limit = 10

        qs = WhatsAppOrder.objects.filter(
            Q(contact_id=pk) | Q(contact__user_id=pk)
        ).order_by("-created_at")[:limit]
        return Response(InboxCustomerOrderSerializer(qs, many=True).data)


class ConversationSendMediaView(WhatsAppBaseView):
    def post(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)

        kind = request.data.get("kind") or "image"
        if kind != "image":
            return Response({"detail": "only image supported here"}, status=400)

        caption = request.data.get("caption", "")
        url = (request.data.get("url") or "").strip()
        file = request.FILES.get("file")

        if url and not file:
            if not url.startswith(("http://", "https://")):
                return Response({"detail": "url must be absolute"}, status=400)
            try:
                result = meta_client.send_image(
                    to=conv.contact.wa_id,
                    link=url,
                    caption=caption,
                )
                wa_id = result.get("messages", [{}])[0].get("id", "")
                send_status = "SENT"
            except Exception as exc:
                logger.exception("send_image(url) failed: %s", exc)
                wa_id = ""
                send_status = "FAILED"
            msg = WhatsAppMessage.objects.create(
                conversation=conv,
                direction="OUT",
                type="image",
                status=send_status,
                wa_message_id=wa_id,
                timestamp=timezone.now(),
                body=caption,
                media_url=url,
            )
            conv.last_message_preview = (caption or "[image]")[:255]
            conv.last_message_at = timezone.now()
            conv.save(update_fields=["last_message_preview", "last_message_at", "updated_at"])
            return Response(MessageSerializer(msg).data, status=201)

        if not file:
            return Response({"detail": "file or url required"}, status=400)

        saved_name = default_storage.save(f"whatsapp/out/{file.name}", file)
        saved_url = default_storage.url(saved_name)
        public_url = f"{dj_settings.PUBLIC_BASE_URL.rstrip('/')}{saved_url}"
        author = request.user if request.user and request.user.is_authenticated else None

        try:
            result = meta_client.send_image(
                to=conv.contact.wa_id,
                link=public_url,
                caption=caption,
            )
            wa_id = result.get("messages", [{}])[0].get("id", "")
            send_status = "SENT"
        except Exception as exc:
            logger.exception("send_image(file) failed: %s", exc)
            wa_id = ""
            send_status = "FAILED"

        msg = WhatsAppMessage.objects.create(
            conversation=conv,
            direction="OUT",
            type="image",
            status=send_status,
            wa_message_id=wa_id,
            timestamp=timezone.now(),
            body=caption,
            media_url=public_url,
            filename=file.name,
            mime_type=file.content_type or "",
            author=author,
        )
        conv.last_message_preview = f"[image] {file.name}"[:255]
        conv.last_message_at = timezone.now()
        conv.save(update_fields=["last_message_preview", "last_message_at", "updated_at"])
        return Response(MessageSerializer(msg).data, status=201)


class ConversationSendProductView(WhatsAppBaseView):
    def post(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)
        product_id = request.data.get("productId")
        if not product_id:
            return Response({"detail": "productId required"}, status=400)
        from catalog.models import Product
        product = Product.objects.filter(id=product_id).first()
        if not product:
            return Response({"detail": "Product not found"}, status=404)
        img = product.images.filter(is_primary=True).first() or product.images.first()
        if not img or not img.image:
            return Response({"detail": "Product has no image"}, status=400)
        public_url = public_media_url(img.image)
        caption = f"{product.name}\nKES {product.price:,.0f}"
        if product.compare_at_price and product.compare_at_price > product.price:
            caption += f" (was KES {product.compare_at_price:,.0f})"
        try:
            result = meta_client.send_image(
                to=conv.contact.wa_id,
                link=public_url,
                caption=caption,
            )
            wa_id = result.get("messages", [{}])[0].get("id", "")
            send_status = "SENT"
        except Exception as exc:
            logger.exception("send_product image failed: %s", exc)
            wa_id = ""
            send_status = "FAILED"
        msg = WhatsAppMessage.objects.create(
            conversation=conv,
            direction="OUT",
            type="image",
            status=send_status,
            wa_message_id=wa_id,
            timestamp=timezone.now(),
            body=caption,
            media_url=public_url,
        )
        conv.last_message_preview = caption[:255]
        conv.last_message_at = timezone.now()
        conv.save(update_fields=["last_message_preview", "last_message_at", "updated_at"])
        _audit(
            request,
            "message.send_product",
            f"conversation:{conv.pk}",
            {"product_id": product.id, "image_url": public_url, "status": send_status},
        )
        return Response(MessageSerializer(msg).data, status=201)


class ConversationResolveView(WhatsAppBaseView):
    def post(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)
        conv.status = "RESOLVED"
        conv.resolved_at = timezone.now()
        conv.save(update_fields=["status", "resolved_at", "updated_at"])
        return Response(ConversationListSerializer(conv).data)


class OrderListView(WhatsAppListAPIView):
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = WhatsAppOrder.objects.select_related("contact")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


# ---------------------------------------------------------------------------
# 6. Messages & Automation Views (Templates, Notifications, Workflows, Logs)
# ---------------------------------------------------------------------------

class TemplateListView(WhatsAppListAPIView):
    serializer_class = MessageTemplateSerializer

    def get_queryset(self):
        qs = WhatsAppTemplate.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category.upper())
        tpl_status = self.request.query_params.get("status")
        if tpl_status:
            qs = qs.filter(status=tpl_status.upper())
        return qs


class TemplateDetailView(WhatsAppBaseView):
    """GET /api/whatsapp/templates/<pk>"""

    def get(self, request, pk):
        tpl = WhatsAppTemplate.objects.filter(pk=pk).first()
        if not tpl:
            return Response({"detail": "Not found"}, status=404)
        return Response(MessageTemplateSerializer(tpl).data)


class TemplateSyncSingleView(WhatsAppBaseView):
    """POST /api/whatsapp/templates/<pk>/sync"""

    def post(self, request, pk):
        tpl = WhatsAppTemplate.objects.filter(pk=pk).first()
        if not tpl:
            return Response({"detail": "Not found"}, status=404)
        sync_templates()
        tpl.refresh_from_db()
        _audit(request, "template.sync", f"template:{tpl.pk}")
        return Response(MessageTemplateSerializer(tpl).data)


class TemplateDisableView(WhatsAppBaseView):
    """POST /api/whatsapp/templates/<pk>/disable"""

    def post(self, request, pk):
        tpl = WhatsAppTemplate.objects.filter(pk=pk).first()
        if not tpl:
            return Response({"detail": "Not found"}, status=404)
        tpl.status = "DISABLED"
        tpl.is_paused = True
        tpl.save(update_fields=["status", "is_paused", "updated_at"])
        _audit(request, "template.disable", f"template:{tpl.pk}")
        return Response(MessageTemplateSerializer(tpl).data)


class TemplateSyncView(WhatsAppBaseView):
    def post(self, request):
        sync_templates()
        _audit(request, "templates.sync")
        return Response({"ok": True})


class TemplateSubmitView(WhatsAppBaseView):
    def post(self, request, pk):
        tpl = WhatsAppTemplate.objects.filter(pk=pk).first()
        if not tpl:
            return Response({"detail": "Not found"}, status=404)
        submit_template(tpl)
        _audit(request, "template.submit", f"template:{tpl.pk}")
        return Response(TemplateSerializer(tpl).data)


class TemplatePauseView(WhatsAppBaseView):
    def post(self, request, pk):
        tpl = WhatsAppTemplate.objects.filter(pk=pk).first()
        if not tpl:
            return Response({"detail": "Not found"}, status=404)
        tpl.is_paused = not tpl.is_paused
        tpl.status = "PAUSED" if tpl.is_paused else "APPROVED"
        tpl.save(update_fields=["is_paused", "status", "updated_at"])
        return Response(TemplateSerializer(tpl).data)


class NotificationConfigListView(WhatsAppBaseView):
    """GET /api/whatsapp/notifications/config"""

    def get(self, request):
        _ensure_notification_configs()
        qs = WhatsAppNotificationConfig.objects.select_related("template").all()
        return Response(NotificationConfigSerializer(qs, many=True).data)


class NotificationConfigDetailView(WhatsAppBaseView):
    """PATCH /api/whatsapp/notifications/config/<pk>"""

    def patch(self, request, pk):
        cfg = WhatsAppNotificationConfig.objects.filter(pk=pk).first()
        if not cfg:
            return Response({"detail": "Not found"}, status=404)

        fields = []
        if "template_id" in request.data:
            tid = request.data.get("template_id")
            if tid:
                tpl = WhatsAppTemplate.objects.filter(pk=tid).first()
                if not tpl:
                    return Response({"detail": "Template not found"}, status=404)
                cfg.template = tpl
            else:
                cfg.template = None
                cfg.enabled = False
                fields.append("enabled")
            fields.append("template")

        if "enabled" in request.data:
            want_enabled = bool(request.data.get("enabled"))
            if want_enabled and not cfg.template_id:
                return Response(
                    {"detail": "Select an approved template before enabling."},
                    status=400,
                )
            cfg.enabled = want_enabled
            fields.append("enabled")

        if fields:
            cfg.save(update_fields=list(set(fields)) + ["updated_at"])
        _audit(request, "notification_config.update", f"config:{cfg.pk}")
        return Response(NotificationConfigSerializer(cfg).data)


class WorkflowListView(WhatsAppListAPIView):
    """GET /api/whatsapp/workflows"""

    serializer_class = WorkflowSerializer

    def get_queryset(self):
        return WhatsAppAutomation.objects.select_related("template").all()


class WorkflowDetailView(WhatsAppBaseView):
    """PATCH /api/whatsapp/workflows/<pk>"""

    def patch(self, request, pk):
        wf = WhatsAppAutomation.objects.select_related("template").filter(pk=pk).first()
        if not wf:
            return Response({"detail": "Not found"}, status=404)
        if "enabled" in request.data:
            wf.status = "ACTIVE" if bool(request.data["enabled"]) else "PAUSED"
            wf.save(update_fields=["status", "updated_at"])
        _audit(request, "workflow.update", f"workflow:{wf.pk}", {"status": wf.status})
        return Response(WorkflowSerializer(wf).data)


class MessageLogListView(WhatsAppBaseView):
    """GET /api/whatsapp/messages/logs?q=...&status=...&category=...&from=...&to=..."""

    def get(self, request):
        qs = WhatsAppMessageLog.objects.select_related("contact", "template").all()

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(recipient__icontains=q)
                | Q(customer_name__icontains=q)
                | Q(order_reference__icontains=q)
                | Q(template_name__icontains=q)
            )

        log_status = request.query_params.get("status")
        if log_status and log_status != "all":
            qs = qs.filter(status=log_status)

        category = request.query_params.get("category")
        if category and category != "all":
            qs = qs.filter(category=category)

        from_str = request.query_params.get("from")
        if from_str:
            d_from = parse_date(from_str)
            if d_from:
                qs = qs.filter(sent_at__date__gte=d_from)

        to_str = request.query_params.get("to")
        if to_str:
            d_to = parse_date(to_str)
            if d_to:
                qs = qs.filter(sent_at__date__lte=d_to)

        return Response(MessageLogSerializer(qs[:200], many=True).data)


class AutomationListView(WhatsAppListAPIView):
    serializer_class = AutomationSerializer

    def get_queryset(self):
        return WhatsAppAutomation.objects.all()


class AutomationToggleView(WhatsAppBaseView):
    def post(self, request, pk):
        auto = WhatsAppAutomation.objects.filter(pk=pk).first()
        if not auto:
            return Response({"detail": "Not found"}, status=404)
        auto.status = "PAUSED" if auto.status == "ACTIVE" else "ACTIVE"
        auto.save(update_fields=["status", "updated_at"])
        return Response(AutomationSerializer(auto).data)


class BroadcastListView(WhatsAppListAPIView):
    serializer_class = BroadcastSerializer

    def get_queryset(self):
        return WhatsAppBroadcast.objects.select_related("template").all()


class BroadcastSendView(WhatsAppBaseView):
    def post(self, request, pk):
        bcast = WhatsAppBroadcast.objects.filter(pk=pk).first()
        if not bcast:
            return Response({"detail": "Not found"}, status=404)
        send_broadcast(bcast)
        _audit(request, "broadcast.send", f"broadcast:{bcast.pk}")
        return Response(BroadcastSerializer(bcast).data)


class BroadcastPauseView(WhatsAppBaseView):
    def post(self, request, pk):
        bcast = WhatsAppBroadcast.objects.filter(pk=pk).first()
        if not bcast:
            return Response({"detail": "Not found"}, status=404)
        bcast.status = "PAUSED"
        bcast.save(update_fields=["status", "updated_at"])
        return Response(BroadcastSerializer(bcast).data)


class ContactListView(WhatsAppListAPIView):
    serializer_class = ContactSerializer

    def get_queryset(self):
        qs = WhatsAppContact.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(profile_name__icontains=search) | Q(wa_id__icontains=search)
            )
        return qs


class ContactUnsubscribeView(WhatsAppBaseView):
    def post(self, request, pk):
        contact = WhatsAppContact.objects.filter(pk=pk).first()
        if not contact:
            return Response({"detail": "Not found"}, status=404)
        now = timezone.now()
        contact.opt_in_status = "UNSUBSCRIBED"
        contact.opt_out_at = now
        contact.save(update_fields=["opt_in_status", "opt_out_at", "updated_at"])
        WhatsAppConsentLog.objects.create(
            contact=contact, action="opt_out", source="admin", recorded_at=now
        )
        return Response(ContactSerializer(contact).data)


class SegmentListView(WhatsAppListAPIView):
    serializer_class = SegmentSerializer

    def get_queryset(self):
        return WhatsAppSegment.objects.all()


class QuickReplyListView(WhatsAppListAPIView):
    serializer_class = QuickReplySerializer

    def get_queryset(self):
        return WhatsAppQuickReply.objects.all()


# ---------------------------------------------------------------------------
# 7. Full Analytics Page View + Legacy Analytics Views
# ---------------------------------------------------------------------------

class AnalyticsView(WhatsAppBaseView):
    """GET /api/whatsapp/analytics?period=today|7d|30d|90d|custom&from=...&to=..."""

    def get(self, request):
        period = request.query_params.get("period", "30d")
        from_str = request.query_params.get("from", "")
        to_str = request.query_params.get("to", "")

        start_dt, end_dt, prev_start_dt, prev_end_dt, start_date, end_date = (
            _resolve_period_bounds(period, from_str, to_str)
        )

        cur_msgs = WhatsAppMessage.objects.filter(
            timestamp__gte=start_dt, timestamp__lt=end_dt, is_internal_note=False
        )
        prev_msgs = WhatsAppMessage.objects.filter(
            timestamp__gte=prev_start_dt, timestamp__lt=prev_end_dt, is_internal_note=False
        )

        cur_out = cur_msgs.filter(direction="OUT")
        prev_out = prev_msgs.filter(direction="OUT")
        cur_in = cur_msgs.filter(direction="IN")
        prev_in = prev_msgs.filter(direction="IN")

        cur_sent = cur_out.count()
        prev_sent = prev_out.count()
        cur_deliv = cur_out.filter(status__in=["DELIVERED", "READ"]).count()
        prev_deliv = prev_out.filter(status__in=["DELIVERED", "READ"]).count()
        cur_read = cur_out.filter(status="READ").count()
        prev_read = prev_out.filter(status="READ").count()
        cur_failed = cur_out.filter(status="FAILED").count()
        prev_failed = prev_out.filter(status="FAILED").count()
        cur_incoming = cur_in.count()
        prev_incoming = prev_in.count()

        cur_new_contacts = WhatsAppContact.objects.filter(
            created_at__gte=start_dt, created_at__lt=end_dt
        ).count()
        prev_new_contacts = WhatsAppContact.objects.filter(
            created_at__gte=prev_start_dt, created_at__lt=prev_end_dt
        ).count()

        # Avg first response time (in seconds)
        def _avg_response_seconds(s_dt, e_dt):
            convs = WhatsAppConversation.objects.filter(
                first_message_at__gte=s_dt,
                first_message_at__lt=e_dt,
                first_response_at__isnull=False,
            ).only("first_message_at", "first_response_at")
            diffs = [
                max(0.0, (c.first_response_at - c.first_message_at).total_seconds())
                for c in convs
                if c.first_response_at >= c.first_message_at
            ]
            return (sum(diffs) / len(diffs)) if diffs else None

        cur_resp = _avg_response_seconds(start_dt, end_dt)
        prev_resp = _avg_response_seconds(prev_start_dt, prev_end_dt)

        active_convs = WhatsAppConversation.objects.filter(
            status__in=["OPEN", "PENDING"]
        ).count()
        unanswered_convs = WhatsAppConversation.objects.filter(
            status__in=["OPEN", "PENDING"], unread_count__gt=0
        ).count()

        overview = {
            "sent": _metric(cur_sent, prev_sent),
            "delivered": _metric(cur_deliv, prev_deliv),
            "read": _metric(cur_read, prev_read),
            "failed": _metric(cur_failed, prev_failed),
            "incoming": _metric(cur_incoming, prev_incoming),
            "outgoing": _metric(cur_sent, prev_sent),
            "activeConversations": _metric(active_convs, None),
            "newContacts": _metric(cur_new_contacts, prev_new_contacts),
            "avgResponseTimeSeconds": _metric(
                cur_resp, prev_resp, available=cur_resp is not None
            ),
            "unanswered": _metric(unanswered_convs, None),
        }

        # Messaging series
        daily_rows = (
            cur_msgs.annotate(day=TruncDate("timestamp"))
            .values("day")
            .annotate(
                sent=Count("id", filter=Q(direction="OUT")),
                delivered=Count("id", filter=Q(direction="OUT", status__in=["DELIVERED", "READ"])),
                read=Count("id", filter=Q(direction="OUT", status="READ")),
                failed=Count("id", filter=Q(direction="OUT", status="FAILED")),
                incoming=Count("id", filter=Q(direction="IN")),
                outgoing=Count("id", filter=Q(direction="OUT")),
            )
            .order_by("day")
        )
        by_day = {r["day"]: r for r in daily_rows if r["day"]}
        series = []
        cursor = start_date
        while cursor <= end_date:
            row = by_day.get(cursor, {})
            series.append(
                {
                    "date": cursor.strftime("%b %d"),
                    "sent": row.get("sent", 0),
                    "delivered": row.get("delivered", 0),
                    "read": row.get("read", 0),
                    "failed": row.get("failed", 0),
                    "incoming": row.get("incoming", 0),
                    "outgoing": row.get("outgoing", 0),
                }
            )
            cursor += timedelta(days=1)

        # Breakdown by template
        cur_logs = WhatsAppMessageLog.objects.filter(
            sent_at__gte=start_dt, sent_at__lt=end_dt
        )
        tpl_rows = (
            cur_logs.exclude(template_name="")
            .values("template_name", "category")
            .annotate(
                sent=Count("id"),
                delivered=Count("id", filter=Q(status__in=["delivered", "read"])),
                read=Count("id", filter=Q(status="read")),
                failed=Count("id", filter=Q(status="failed")),
            )
            .order_by("-sent")[:15]
        )
        by_template = [
            {
                "templateName": r["template_name"],
                "category": r["category"],
                "sent": r["sent"],
                "delivered": r["delivered"],
                "read": r["read"],
                "failed": r["failed"],
            }
            for r in tpl_rows
        ]

        # Failure reasons
        failure_rows = (
            cur_logs.filter(status="failed")
            .exclude(failure_reason="")
            .values("failure_reason")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )
        failures = [
            {"reason": r["failure_reason"], "count": r["count"]} for r in failure_rows
        ]

        # Customers
        cur_returning = WhatsAppContact.objects.filter(
            last_inbound_at__gte=start_dt, last_inbound_at__lt=end_dt, order_count__gte=1
        ).count()
        prev_returning = WhatsAppContact.objects.filter(
            last_inbound_at__gte=prev_start_dt, prev_inbound_at__lt=prev_end_dt, order_count__gte=1
        ).count() if False else WhatsAppContact.objects.filter(
            last_inbound_at__gte=prev_start_dt, last_inbound_at__lt=prev_end_dt, order_count__gte=1
        ).count()

        cur_started = WhatsAppConversation.objects.filter(
            created_at__gte=start_dt, created_at__lt=end_dt
        ).count()
        prev_started = WhatsAppConversation.objects.filter(
            created_at__gte=prev_start_dt, created_at__lt=prev_end_dt
        ).count()

        cur_attr = WhatsAppAttributionEvent.objects.filter(
            occurred_at__gte=start_dt, occurred_at__lt=end_dt
        )
        prev_attr = WhatsAppAttributionEvent.objects.filter(
            occurred_at__gte=prev_start_dt, occurred_at__lt=prev_end_dt
        )
        cur_enquiries = cur_attr.filter(event_type="enquiry").count()
        prev_enquiries = prev_attr.filter(event_type="enquiry").count()

        cur_opt_ins = WhatsAppConsentLog.objects.filter(
            action="opt_in", recorded_at__gte=start_dt, recorded_at__lt=end_dt
        ).count()
        prev_opt_ins = WhatsAppConsentLog.objects.filter(
            action="opt_in", recorded_at__gte=prev_start_dt, recorded_at__lt=prev_end_dt
        ).count()
        cur_opt_outs = WhatsAppConsentLog.objects.filter(
            action="opt_out", recorded_at__gte=start_dt, recorded_at__lt=end_dt
        ).count()
        prev_opt_outs = WhatsAppConsentLog.objects.filter(
            action="opt_out", recorded_at__gte=prev_start_dt, recorded_at__lt=prev_end_dt
        ).count()

        resp_rate = (cur_incoming / cur_sent * 100.0) if cur_sent else 0.0
        prev_resp_rate = (prev_incoming / prev_sent * 100.0) if prev_sent else 0.0
        repeat_purchases = WhatsAppContact.objects.filter(
            last_inbound_at__gte=start_dt, last_inbound_at__lt=end_dt, order_count__gte=2
        ).count()

        customers = {
            "newContacts": _metric(cur_new_contacts, prev_new_contacts),
            "returningCustomers": _metric(cur_returning, prev_returning),
            "startedConversations": _metric(cur_started, prev_started),
            "enquiries": _metric(cur_enquiries, prev_enquiries),
            "optIns": _metric(cur_opt_ins, prev_opt_ins),
            "optOuts": _metric(cur_opt_outs, prev_opt_outs),
            "responseRate": _metric(round(resp_rate, 1), round(prev_resp_rate, 1)),
            "repeatPurchases": _metric(repeat_purchases, None),
        }

        # Commerce & attribution
        cur_ref_visits = cur_attr.filter(event_type="referred_visit").count()
        prev_ref_visits = prev_attr.filter(event_type="referred_visit").count()
        cur_prod_visits = cur_attr.filter(event_type="product_page_visit").count()
        prev_prod_visits = prev_attr.filter(event_type="product_page_visit").count()
        cur_orders_attr = cur_attr.filter(event_type="attributed_order")
        prev_orders_attr = prev_attr.filter(event_type="attributed_order")

        attr_orders_cnt = cur_orders_attr.count()
        prev_orders_cnt = prev_orders_attr.count()
        attr_rev = float(cur_orders_attr.aggregate(t=Sum("revenue"))["t"] or DecimalZero)
        prev_attr_rev = float(prev_orders_attr.aggregate(t=Sum("revenue"))["t"] or DecimalZero)

        conv_rate = (attr_orders_cnt / cur_ref_visits * 100.0) if cur_ref_visits else 0.0
        prev_conv_rate = (prev_orders_cnt / prev_ref_visits * 100.0) if prev_ref_visits else 0.0
        aov = (attr_rev / attr_orders_cnt) if attr_orders_cnt else 0.0
        prev_aov = (prev_attr_rev / prev_orders_cnt) if prev_orders_cnt else 0.0

        commerce = {
            "referredVisits": _metric(cur_ref_visits, prev_ref_visits),
            "productPageVisits": _metric(cur_prod_visits, prev_prod_visits),
            "enquiries": _metric(cur_enquiries, prev_enquiries),
            "attributedOrders": _metric(attr_orders_cnt, prev_orders_cnt),
            "attributedRevenue": _metric(attr_rev, prev_attr_rev),
            "conversionRate": _metric(round(conv_rate, 1), round(prev_conv_rate, 1)),
            "averageOrderValue": _metric(round(aov, 2), round(prev_aov, 2)),
        }

        # Campaigns table
        campaigns_qs = WhatsAppBroadcast.objects.select_related("template").filter(
            Q(created_at__gte=start_dt, created_at__lt=end_dt)
            | Q(start_at__gte=start_dt, start_at__lt=end_dt)
        )[:20]
        campaigns_data = [
            {
                "id": str(c.pk),
                "name": c.campaign_name,
                "category": c.template.category.lower() if c.template else "marketing",
                "submitted": c.submitted or c.recipients,
                "delivered": c.delivered,
                "read": c.read,
                "failed": c.failed,
                "clicks": c.clicks,
                "visits": c.visits,
                "orders": c.orders_count,
                "revenue": float(c.revenue or 0),
                "cost": float(c.actual_cost_kes or c.estimated_cost_kes or 0),
                "currency": c.currency or "KES",
            }
            for c in campaigns_qs
        ]

        # Messaging costs
        cost_qs = WhatsAppMessagingCost.objects.filter(
            date__gte=start_date, date__lte=end_date
        )
        if cost_qs.exists():
            total_cost = float(cost_qs.aggregate(t=Sum("cost"))["t"] or 0)
            camp_cost = float(
                cost_qs.filter(campaign__isnull=False).aggregate(t=Sum("cost"))["t"] or 0
            )
            cat_rows = (
                cost_qs.values("category")
                .annotate(cost=Sum("cost"))
                .order_by("category")
            )
            currency = cost_qs.values_list("currency", flat=True).first() or "KES"
            costs_data = {
                "available": True,
                "total": round(total_cost, 2),
                "currency": currency,
                "byCategory": [
                    {"category": r["category"].title(), "cost": round(float(r["cost"] or 0), 2)}
                    for r in cat_rows
                ],
                "campaignCost": round(camp_cost, 2),
                "note": None,
            }
        else:
            costs_data = {
                "available": False,
                "total": None,
                "currency": "KES",
                "byCategory": None,
                "campaignCost": None,
                "note": "Messaging cost data is not available yet.",
            }

        return Response(
            {
                "overview": overview,
                "messaging": {
                    "series": series,
                    "byTemplate": by_template,
                    "failures": failures,
                },
                "customers": customers,
                "commerce": commerce,
                "campaigns": campaigns_data,
                "costs": costs_data,
            }
        )


class AnalyticsSummaryView(WhatsAppBaseView):
    def get(self, request):
        msgs = WhatsAppMessage.objects.all()
        sent = msgs.filter(direction="OUT").count()
        delivered = msgs.filter(direction="OUT", status__in=["DELIVERED", "READ"]).count()
        read = msgs.filter(direction="OUT", status="READ").count()
        replied = msgs.filter(direction="IN").count()
        delivery_rate = (delivered / sent * 100) if sent else 0
        read_rate = (read / sent * 100) if sent else 0
        response_rate = (replied / sent * 100) if sent else 0
        return Response(
            {
                "sent": sent,
                "delivered": delivered,
                "read": read,
                "replied": replied,
                "totalCostKes": "0.00",
                "deliveryRate": round(delivery_rate, 1),
                "readRate": round(read_rate, 1),
                "responseRate": round(response_rate, 1),
            }
        )


class AnalyticsSeriesView(WhatsAppBaseView):
    def get(self, request):
        days = []
        today = timezone.now().date()
        for offset in range(13, -1, -1):
            d = today - timedelta(days=offset)
            start = timezone.make_aware(
                timezone.datetime.combine(d, timezone.datetime.min.time())
            )
            end = start + timedelta(days=1)
            qs = WhatsAppMessage.objects.filter(timestamp__gte=start, timestamp__lt=end)
            days.append(
                {
                    "day": d.strftime("%b %d"),
                    "sent": qs.filter(direction="OUT").count(),
                    "delivered": qs.filter(
                        direction="OUT", status__in=["DELIVERED", "READ"]
                    ).count(),
                    "read": qs.filter(status="READ").count(),
                    "replies": qs.filter(direction="IN").count(),
                }
            )
        return Response({"days": days})


class AnalyticsCostView(WhatsAppBaseView):
    def get(self, request):
        return Response(
            {
                "total": "0.00",
                "currency": "KES",
                "buckets": [
                    {"name": "Utility", "value": 0, "color": "#172554"},
                    {"name": "Marketing", "value": 0, "color": "#3b82f6"},
                    {"name": "Authentication", "value": 0, "color": "#93c5fd"},
                    {"name": "Service", "value": 0, "color": "#cbd5e1"},
                ],
            }
        )


class AnalyticsFunnelView(WhatsAppBaseView):
    def get(self, request):
        return Response(
            [
                {"stage": "Delivered", "count": 0},
                {"stage": "Viewed", "count": 0},
                {"stage": "Added to cart", "count": 0},
                {"stage": "Checkout", "count": 0},
                {"stage": "Order", "count": 0},
            ]
        )


class AnalyticsAgentsView(WhatsAppBaseView):
    def get(self, request):
        members = WhatsAppTeamMember.objects.select_related("user").all()
        result = []
        for m in members:
            msgs = WhatsAppMessage.objects.filter(author=m.user).count()
            result.append(
                {
                    "id": m.pk,
                    "userId": m.user_id,
                    "name": m.user.get_full_name() or m.user.get_username(),
                    "messages": msgs,
                    "avgResponseMin": 0,
                    "csat": 0,
                    "slaRate": 0,
                    "resolved": WhatsAppConversation.objects.filter(
                        assigned_to=m.user, status="RESOLVED"
                    ).count(),
                }
            )
        return Response(result)


class AnalyticsCommerceView(WhatsAppBaseView):
    def get(self, request):
        today = timezone.now().date()
        start = timezone.make_aware(
            timezone.datetime.combine(today, timezone.datetime.min.time())
        )
        messages_today = WhatsAppMessage.objects.filter(
            direction="OUT", timestamp__gte=start
        ).count()
        orders_qs = WhatsAppOrder.objects.all()
        revenue = orders_qs.aggregate(total=Sum("total"))["total"] or DecimalZero
        return Response(
            {
                "messagesSentToday": messages_today,
                "abandonedCartsRecovered": 0,
                "ordersFromWhatsApp": orders_qs.count(),
                "ordersRevenueKes": float(revenue),
                "averageResponseMin": 0,
                "productViews": WhatsAppCatalogItem.objects.aggregate(
                    total=Sum("view_count")
                )["total"]
                or 0,
                "addToCartRate": 0,
                "topProducts": [],
                "recoveryByProduct": [],
            }
        )


# ---------------------------------------------------------------------------
# 8. Billing, Webhooks, Bot Flows (Existing)
# ---------------------------------------------------------------------------

class BillingSummaryView(WhatsAppBaseView):
    def get(self, request):
        return Response(
            {
                "month": timezone.now().strftime("%B %Y"),
                "totalKes": "0.00",
                "utilityKes": "0.00",
                "marketingKes": "0.00",
                "authKes": "0.00",
                "serviceKes": "0.00",
                "utilityCount": 0,
                "marketingCount": 0,
                "authCount": 0,
                "serviceCount": 0,
                "freeServiceUsed": 0,
                "freeServiceLimit": getattr(
                    dj_settings, "WHATSAPP_FREE_SERVICE_CONVERSATIONS", 1000
                ),
                "lastSyncedAt": timezone.now().isoformat(),
            }
        )


class BillingInvoicesView(WhatsAppListAPIView):
    serializer_class = InvoiceSerializer
    queryset = WhatsAppInvoice.objects.all()


class WebhookEventListView(WhatsAppListAPIView):
    serializer_class = WebhookEventSerializer
    queryset = WhatsAppWebhookEvent.objects.all()


class WebhookEventReplayView(WhatsAppBaseView):
    def post(self, request, pk):
        event = WhatsAppWebhookEvent.objects.filter(pk=pk).first()
        if not event:
            return Response({"detail": "Not found"}, status=404)
        event.status = "RETRYING"
        event.attempts += 1
        event.save(update_fields=["status", "attempts"])
        _audit(request, "webhook.replay", f"event:{event.pk}")
        return Response(WebhookEventSerializer(event).data)


class BotFlowView(WhatsAppBaseView):
    def get(self, request):
        flow = WhatsAppBotFlow.get_solo()
        return Response(BotFlowSerializer(flow).data)

    def put(self, request):
        flow = WhatsAppBotFlow.get_solo()
        serializer = BotFlowWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if "name" in serializer.validated_data:
                flow.name = serializer.validated_data["name"]
            if "entry_node_key" in serializer.validated_data:
                flow.entry_node_key = serializer.validated_data["entry_node_key"]
            if "is_published" in serializer.validated_data:
                flow.is_published = serializer.validated_data["is_published"]
            flow.save()

            nodes = serializer.validated_data.get("nodes")
            if nodes is not None:
                keys = {n.get("key") for n in nodes if n.get("key")}
                flow.nodes.exclude(key__in=keys).delete()
                for idx, node in enumerate(nodes):
                    if not node.get("key"):
                        continue
                    WhatsAppBotNode.objects.update_or_create(
                        flow=flow,
                        key=node["key"],
                        defaults={
                            "kind": node.get("kind", "message"),
                            "title": node.get("title", ""),
                            "body": node.get("body", ""),
                            "options": node.get("options", []),
                            "config": node.get("config", {}),
                            "position": node.get("position", {}),
                            "order": idx,
                        },
                    )
        _audit(request, "bot.flow.save")
        return Response(BotFlowSerializer(flow).data)


class BotFlowPublishView(WhatsAppBaseView):
    def post(self, request):
        flow = WhatsAppBotFlow.get_solo()
        flow.is_published = True
        flow.save(update_fields=["is_published", "updated_at"])
        _audit(request, "bot.flow.publish")
        return Response(BotFlowSerializer(flow).data)


class WhatsAppWebhookReceiver(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        params = request.query_params
        mode = params.get("hub.mode")
        token = params.get("hub.verify_token")
        challenge = params.get("hub.challenge", "")
        expected = getattr(dj_settings, "WHATSAPP_VERIFY_TOKEN", "")
        if mode == "subscribe" and token and token == expected:
            return Response(challenge, content_type="text/plain")
        return Response({"detail": "Forbidden"}, status=403)

    def post(self, request):
        raw = request.body
        signature = request.META.get("HTTP_X_HUB_SIGNATURE_256", "")
        started = timezone.now()
        valid = meta_client.verify_webhook_signature(raw, signature)
        latency_ms = int((timezone.now() - started).total_seconds() * 1000)
        try:
            payload = request.data
        except Exception:
            payload = {}
        entries = (payload or {}).get("entry") or []
        field = "unknown"
        for entry in entries:
            for change in entry.get("changes") or []:
                field = change.get("field") or field
                break
        event = log_webhook_event(
            payload,
            kind=field,
            signature_valid=valid,
            latency_ms=latency_ms,
            error="" if valid else "Invalid signature",
        )
        
        account.last_webhook_event_at = timezone.now()
        account.webhook_verified = True
        account.save(update_fields=["last_webhook_event_at", "webhook_verified"])
        logger.info("Received webhook event id=%s field=%s", event.pk, field)
        return Response({"received": True, "event_id": event.pk})