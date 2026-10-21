import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings as dj_settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    WhatsAppAccount,
    WhatsAppAuditEntry,
    WhatsAppAutomation,
    WhatsAppBotFlow,
    WhatsAppBotNode,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppInvoice,
    WhatsAppMessage,
    WhatsAppNotification,
    WhatsAppOrder,
    WhatsAppQuickReply,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTeamMember,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)
from .serializers import (
    AccountSerializer,
    AuditEntrySerializer,
    AutomationSerializer,
    BotFlowSerializer,
    BotFlowWriteSerializer,
    BroadcastSerializer,
    CatalogItemSerializer,
    CatalogSerializer,
    ContactSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    InvoiceSerializer,
    MessageSerializer,
    NotificationSerializer,
    OrderSerializer,
    QuickReplySerializer,
    SegmentSerializer,
    SettingsSerializer,
    TeamMemberSerializer,
    TemplateSerializer,
    WebhookEventSerializer,
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


class AccountView(WhatsAppBaseView):
    def get(self, request):
        return Response(AccountSerializer(WhatsAppAccount.get_solo()).data)


class AccountRefreshView(WhatsAppBaseView):
    def post(self, request):
        account = WhatsAppAccount.get_solo()
        refresh_account_status(account)
        _audit(request, "account.refresh", f"account:{account.pk}")
        account.refresh_from_db()
        return Response(AccountSerializer(account).data)


class AccountSetActiveView(WhatsAppBaseView):
    def post(self, request):
        account = WhatsAppAccount.get_solo()
        account.is_active = bool(request.data.get("is_active", not account.is_active))
        account.save(update_fields=["is_active"])
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


class ConversationListView(WhatsAppListAPIView):
    serializer_class = ConversationListSerializer

    def get_queryset(self):
        qs = WhatsAppConversation.objects.select_related("contact", "assigned_to")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(contact__profile_name__icontains=search)
                | Q(contact__wa_id__icontains=search)
            )
        tab = self.request.query_params.get("tab")
        if tab == "unassigned":
            qs = qs.filter(assigned_to__isnull=True)
        elif tab == "mine":
            user = self.request.user
            if user and user.is_authenticated:
                qs = qs.filter(assigned_to=user)
            else:
                qs = qs.none()
        elif tab == "open":
            qs = qs.filter(status="OPEN")
        elif tab == "resolved":
            qs = qs.filter(status="RESOLVED")
        return qs


class ConversationDetailView(WhatsAppBaseView):
    def get(self, request, pk):
        conv = WhatsAppConversation.objects.select_related("contact").filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)
        if conv.unread_count:
            conv.unread_count = 0
            conv.save(update_fields=["unread_count"])
        return Response(ConversationDetailSerializer(conv).data)

    def patch(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)
        fields = []
        if "starred" in request.data:
            conv.starred = bool(request.data["starred"])
            fields.append("starred")
        if "status" in request.data and request.data["status"] in dict(
            WhatsAppConversation.STATUS_CHOICES
        ):
            conv.status = request.data["status"]
            fields.append("status")
        if fields:
            conv.save(update_fields=fields + ["updated_at"])
        return Response(ConversationListSerializer(conv).data)


class ConversationMessagesView(WhatsAppBaseView):
    def post(self, request, pk):
        conv = WhatsAppConversation.objects.filter(pk=pk).first()
        if not conv:
            return Response({"detail": "Not found"}, status=404)
        body = (request.data.get("body") or "").strip()
        is_note = bool(request.data.get("isNote"))
        if not body:
            return Response({"detail": "body required"}, status=400)
        author = request.user if request.user and request.user.is_authenticated else None
        send_status = "SENT"
        wa_id = ""
        if not is_note:
            try:
                result = meta_client.send_text(to=conv.contact.wa_id, body=body)
                wa_id = result.get("messages", [{}])[0].get("id", "")
            except Exception as exc:
                logger.exception("send_text failed: %s", exc)
                send_status = "FAILED"
        msg = WhatsAppMessage.objects.create(
            conversation=conv,
            direction="OUT",
            type="note" if is_note else "text",
            body=body,
            status=send_status,
            wa_message_id=wa_id,
            timestamp=timezone.now(),
            author=author,
            is_internal_note=is_note,
        )
        conv.last_message_preview = body[:255]
        conv.last_message_at = timezone.now()
        conv.save(update_fields=["last_message_preview", "last_message_at", "updated_at"])
        _audit(request, "message.send", f"conversation:{conv.pk}", {"isNote": is_note})
        return Response(MessageSerializer(msg).data, status=201)


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


class TemplateListView(WhatsAppListAPIView):
    serializer_class = TemplateSerializer

    def get_queryset(self):
        qs = WhatsAppTemplate.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs


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
        contact.opt_in_status = "UNSUBSCRIBED"
        contact.save(update_fields=["opt_in_status", "updated_at"])
        return Response(ContactSerializer(contact).data)


class SegmentListView(WhatsAppListAPIView):
    serializer_class = SegmentSerializer

    def get_queryset(self):
        return WhatsAppSegment.objects.all()


class QuickReplyListView(WhatsAppListAPIView):
    serializer_class = QuickReplySerializer

    def get_queryset(self):
        return WhatsAppQuickReply.objects.all()


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
        logger.info("Received webhook event id=%s field=%s", event.pk, field)
        return Response({"received": True, "event_id": event.pk})