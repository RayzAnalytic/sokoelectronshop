from __future__ import annotations

import logging
import secrets
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AccountConnectionStatus,
    ContentStatus,
    PublishStatus,
    ReportFormat,
    SocialAccount,
    SocialAnalyticsConfig,
    SocialAttributionEvent,
    SocialAuditLog,
    SocialBestTimePost,
    SocialCampaign,
    SocialContent,
    SocialContentCategory,
    SocialDemographicSnapshot,
    SocialEvergreenPost,
    SocialInboxConversation,
    SocialInboxTemplate,
    SocialLink,
    SocialMedia,
    SocialMediaFolder,
    SocialNotification,
    SocialPlatform,
    SocialQueueSlot,
    SocialReport,
    SocialScheduledPost,
    SocialScheduledPostHistory,
    SocialTeamMember,
    TeamRole,
)
from .permissions import (
    CanApprove,
    CanEdit,
    CanManageAccounts,
    CanManageInbox,
    CanManageLinks,
    CanManageMedia,
    CanManageQueue,
    CanManageReports,
    CanManageSettings,
    CanManageTeam,
    CanManageTemplates,
    CanViewAuditLog,
    IsStaff,
)
from .serializers import (
    AnalyticsPayloadSerializer,
    BulkIdsSerializer,
    BulkRescheduleSerializer,
    CalendarAccountCapabilitySerializer,
    CampaignCreateUpdateSerializer,
    CampaignKPISerializer,
    CampaignSerializer,
    ContentApprovalActionSerializer,
    ContentDraftSaveSerializer,
    ContentDraftSerializer,
    ContentRefSerializer,
    ContentScheduleActionSerializer,
    ContentSuggestRequestSerializer,
    ConversationSerializer,
    InboxAssignSerializer,
    InboxLinkCustomerSerializer,
    InboxLinkProductSerializer,
    InboxMetricsSerializer,
    InboxNoteCreateSerializer,
    InboxReactSerializer,
    InboxReplyCreateSerializer,
    MediaAssetSerializer,
    MediaUploadSerializer,
    OverviewPayloadSerializer,
    ScheduledPostCancelSerializer,
    ScheduledPostCreateSerializer,
    ScheduledPostDuplicateSerializer,
    ScheduledPostHistorySerializer,
    ScheduledPostRescheduleSerializer,
    ScheduledPostSerializer,
    SocialAccountListPayloadSerializer,
    SocialAccountSerializer,
    SocialAccountShareWriteSerializer,
    SocialAccountStartConnectSerializer,
    SocialAccountUpdateSerializer,
    SocialAnalyticsConfigSerializer,
    SocialAttributionEventSerializer,
    SocialAuditLogSerializer,
    SocialBestTimePostSerializer,
    SocialContentCategorySerializer,
    SocialDemographicSnapshotSerializer,
    SocialEvergreenPostSerializer,
    SocialInboxTemplateSerializer,
    SocialLinkSerializer,
    SocialMediaFolderSerializer,
    SocialNotificationSerializer,
    SocialQueueSlotSerializer,
    SocialReportCreateSerializer,
    SocialReportSerializer,
    SocialTeamMemberSerializer,
)
from .services import (
    PLATFORM_ORDER,
    SocialServiceError,
    add_internal_note,
    approve_content,
    assign_conversation,
    build_analytics_report,
    build_social_overview,
    cancel_scheduled_post,
    complete_oauth_callback,
    confirm_oauth_selection,
    get_oauth_selection,
    create_campaign,
    delete_content,
    delete_social_account,
    disconnect_social_account,
    duplicate_content,
    duplicate_scheduled_post,
    get_analytics_config,
    get_campaign_detail,
    get_campaign_kpis,
    get_content_detail,
    get_inbox_capabilities,
    get_inbox_conversation,
    get_inbox_metrics,
    link_conversation_customer,
    link_conversation_product,
    list_campaigns,
    list_content,
    list_inbox_conversations,
    list_media_library,
    list_scheduled_posts,
    list_social_accounts,
    perform_conversation_action,
    publish_content_now_from_studio,
    publish_scheduled_post_now,
    reject_content,
    reply_to_conversation,
    request_content_changes,
    reschedule_scheduled_post,
    save_content,
    schedule_content_from_studio,
    schedule_post,
    start_oauth_connect,
    submit_content_for_approval,
    suggest_content_copy,
    sync_social_account,
    transition_campaign_status,
    update_account_share,
    update_social_account,
    upload_media_asset,
)

logger = logging.getLogger("social.views")
User = get_user_model()


def _error_response(exc: SocialServiceError) -> Response:
    return Response({"detail": exc.message}, status=exc.status_code)


def _load_external_map(resolver_setting: str, ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    fn = getattr(settings, resolver_setting, None)
    if callable(fn):
        try:
            res = fn(ids)
            return res if isinstance(res, dict) else {}
        except Exception:
            logger.warning("External resolver %s failed", resolver_setting, exc_info=True)
    return {}


def _campaign_context(request, campaigns: list[SocialCampaign]) -> dict:
    product_ids: list[str] = []
    discount_ids: list[str] = []
    for c in campaigns:
        if c.discount_id:
            discount_ids.append(str(c.discount_id))
        for cp in c.campaign_products.all():
            product_ids.append(str(cp.product_id))
    return {
        "request": request,
        "product_map": _load_external_map("SOCIAL_PRODUCT_RESOLVER", list(dict.fromkeys(product_ids))),
        "discount_map": _load_external_map("SOCIAL_DISCOUNT_RESOLVER", list(dict.fromkeys(discount_ids))),
    }


def _content_context(request, items: list[SocialContent]) -> dict:
    product_ids: list[str] = []
    for item in items:
        for lp in item.linked_products.all():
            product_ids.append(str(lp.product_id))
    return {
        "request": request,
        "product_map": _load_external_map("SOCIAL_PRODUCT_RESOLVER", list(dict.fromkeys(product_ids))),
    }


def _inbox_context(request, conversations: list[SocialInboxConversation]) -> dict:
    product_ids = [str(c.linked_product_id) for c in conversations if c.linked_product_id]
    customer_ids = [str(c.linked_customer_id) for c in conversations if c.linked_customer_id]
    return {
        "request": request,
        "product_map": _load_external_map("SOCIAL_PRODUCT_RESOLVER", list(dict.fromkeys(product_ids))),
        "customer_map": _load_external_map("SOCIAL_CUSTOMER_RESOLVER", list(dict.fromkeys(customer_ids))),
    }


class SocialOverviewView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        range_key = request.query_params.get("range", "7d")
        platform = request.query_params.get("platform", "all")
        custom_from = request.query_params.get("from")
        custom_to = request.query_params.get("to")

        store_fn = getattr(settings, "SOCIAL_STORE_REVENUE_RESOLVER", None)
        store_summary = None
        if callable(store_fn):
            try:
                store_summary = store_fn(range_key, custom_from, custom_to)
            except Exception:
                logger.warning("Store revenue resolver failed", exc_info=True)

        payload = build_social_overview(
            range_key=range_key,
            platform_filter=platform,
            custom_from=custom_from,
            custom_to=custom_to,
            store_revenue_summary=store_summary,
        )
        return Response(OverviewPayloadSerializer(payload).data)


class SocialAnalyticsReportView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        filters = {
            "range": request.query_params.get("range", "last_30_days"),
            "start": request.query_params.get("start"),
            "end": request.query_params.get("end"),
            "platform": request.query_params.get("platform"),
            "account": request.query_params.get("account"),
            "campaign": request.query_params.get("campaign"),
            "content_type": request.query_params.get("content_type"),
            "compare": request.query_params.get("compare", "true"),
        }
        prod_ids = list(
            SocialAttributionEvent.objects.exclude(product_id="")
            .values_list("product_id", flat=True)
            .distinct()
        )
        product_map = _load_external_map("SOCIAL_PRODUCT_RESOLVER", [str(x) for x in prod_ids])
        payload = build_analytics_report(filters, product_map=product_map)
        return Response(AnalyticsPayloadSerializer(payload).data)


class SocialAnalyticsConfigView(APIView):
    permission_classes = [IsStaff, CanManageSettings]

    def get(self, request):
        return Response(SocialAnalyticsConfigSerializer(get_analytics_config()).data)

    def patch(self, request):
        cfg = get_analytics_config()
        ser = SocialAnalyticsConfigSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class SocialAttributionEventCreateView(APIView):
    permission_classes = [IsStaff]

    def post(self, request):
        ser = SocialAttributionEventSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ev = ser.save()
        return Response(SocialAttributionEventSerializer(ev).data, status=status.HTTP_201_CREATED)


class SocialReportListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialReport.objects.order_by("-created_at")
        return Response(SocialReportSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        ser = SocialReportCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        report = SocialReport.objects.create(
            report_type=data.get("report_type", ""),
            name=data["name"],
            date_from=data["date_from"],
            date_to=data["date_to"],
            platforms=data.get("platforms", []),
            metrics=data.get("metrics", []),
            branding=data.get("branding", {}),
            format=data.get("format", ReportFormat.CSV),
            created_by=request.user if request.user.is_authenticated else None,
            generated_at=timezone.now(),
        )
        return Response(
            SocialReportSerializer(report, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class SocialReportDetailView(APIView):
    permission_classes = [IsStaff, CanManageReports]

    def get(self, request, pk: int):
        report = SocialReport.objects.filter(pk=pk).first()
        if not report:
            return Response({"detail": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SocialReportSerializer(report, context={"request": request}).data)

    def delete(self, request, pk: int):
        report = SocialReport.objects.filter(pk=pk).first()
        if not report:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if report.file:
            report.file.delete(save=False)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SocialDemographicSnapshotView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        platform = request.query_params.get("platform")
        qs = SocialDemographicSnapshot.objects.all()
        if platform and platform != "all":
            qs = qs.filter(platform=platform)
        latest: dict[str, SocialDemographicSnapshot] = {}
        for row in qs.order_by("platform", "-date"):
            latest.setdefault(row.platform, row)
        return Response(SocialDemographicSnapshotSerializer(latest.values(), many=True).data)


class SocialBestTimePostView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        platform = request.query_params.get("platform")
        qs = SocialBestTimePost.objects.all()
        if platform and platform != "all":
            qs = qs.filter(platform=platform)
        return Response(
            SocialBestTimePostSerializer(qs.order_by("platform", "day_of_week", "hour"), many=True).data
        )


class SocialAccountListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        accounts = list_social_accounts()
        connected_platforms = {
            a.platform for a in accounts if a.status == AccountConnectionStatus.CONNECTED
        }
        payload = SocialAccountListPayloadSerializer({"accounts": accounts}).data
        payload["platforms"] = [
            {"platform": p, "connected": p in connected_platforms}
            for p in PLATFORM_ORDER
        ]
        return Response(payload)


class SocialAccountCapabilitiesView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        accounts = list_social_accounts()
        return Response(
            {"accounts": CalendarAccountCapabilitySerializer(accounts, many=True).data}
        )


class SocialAccountDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        account = SocialAccount.objects.prefetch_related("sync_logs", "shares__staff").filter(pk=pk).first()
        if not account:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SocialAccountSerializer(account).data)

    def patch(self, request, pk: int):
        if not CanManageAccounts().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        ser = SocialAccountUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            account = update_social_account(str(pk), ser.validated_data, actor=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(SocialAccountSerializer(account).data)

    def delete(self, request, pk: int):
        if not CanManageAccounts().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        try:
            delete_social_account(str(pk), actor=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"ok": True})


class SocialAccountStartConnectView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request):
        ser = SocialAccountStartConnectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        platform = ser.validated_data["platform"]
        callback = _resolve_oauth_callback(request, platform)
        try:
            authorize_url = start_oauth_connect(platform, request.user, redirect_uri=callback)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"authorize_url": authorize_url})


class SocialAccountReauthorizeView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request, pk: int):
        account = SocialAccount.objects.filter(pk=pk).first()
        if not account:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
        callback = _resolve_oauth_callback(request, account.platform)
        try:
            authorize_url = start_oauth_connect(
                account.platform,
                request.user,
                redirect_uri=callback,
                reauthorize_account_id=str(pk),
            )
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"authorize_url": authorize_url})


class SocialAccountSyncView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request, pk: int):
        try:
            account = sync_social_account(str(pk), actor=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"ok": True, "account": SocialAccountSerializer(account).data})


class SocialAccountDisconnectView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request, pk: int):
        try:
            disconnect_social_account(str(pk), actor=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"ok": True})


class SocialAccountShareView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request, pk: int):
        ser = SocialAccountShareWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            update_account_share(
                str(pk),
                ser.validated_data["staff_id"],
                ser.validated_data["permissions"],
                actor=request.user,
            )
            account = SocialAccount.objects.prefetch_related("sync_logs", "shares__staff").get(pk=pk)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(SocialAccountSerializer(account).data)


class SocialOAuthCallbackView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, platform: str):
        from .models import SocialOAuthSelection, SocialOAuthState

        admin_ui = (
            getattr(settings, "SOCIAL_ADMIN_UI_URL", "")
            or getattr(settings, "FRONTEND_URL", "")
            or "http://localhost:3000"
        ).rstrip("/")
        code = request.query_params.get("code", "")
        state = request.query_params.get("state", "")
        oauth_err = request.query_params.get("error", "")
        oauth_err_desc = request.query_params.get("error_description", "")

        if state and platform in ("meta", "facebook", "instagram"):
            st_plat = SocialOAuthState.objects.filter(state=state).values_list("platform", flat=True).first()
            if st_plat in ("facebook", "instagram"):
                platform = st_plat

        if oauth_err:
            if state:
                SocialOAuthState.objects.filter(state=state).delete()
            qs = urlencode({"error": oauth_err_desc or oauth_err, "platform": platform})
            return redirect(f"{admin_ui}/admin/social/accounts?{qs}")

        if not code or not state:
            qs = urlencode({"error": "oauth_missing_params", "platform": platform})
            return redirect(f"{admin_ui}/admin/social/accounts?{qs}")

        try:
            result = complete_oauth_callback(platform, code, state)
        except SocialServiceError as exc:
            qs = urlencode({"error": exc.message, "platform": platform})
            return redirect(f"{admin_ui}/admin/social/accounts?{qs}")

        if isinstance(result, SocialOAuthSelection):
            qs = urlencode({"selection": result.token, "platform": result.platform})
            return redirect(f"{admin_ui}/admin/social/accounts?{qs}")
        return redirect(f"{admin_ui}/admin/social/accounts?account={result.id}")


class SocialOAuthSelectionView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def get(self, request, token: str):
        try:
            sel = get_oauth_selection(token, request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"platform": sel.platform, "candidates": sel.candidates or []})


class SocialOAuthSelectionConfirmView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request, token: str):
        account_id = str(request.data.get("account_id") or "").strip()
        if not account_id:
            return Response({"detail": "account_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            account = confirm_oauth_selection(token, account_id, request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"ok": True, "account": SocialAccountSerializer(account).data})


def _resolve_oauth_callback(request, platform: str) -> str:
    import os
    if platform == "tiktok":
        env_cb = getattr(settings, "TIKTOK_REDIRECT_URI", None) or os.environ.get("TIKTOK_REDIRECT_URI")
    elif platform == "youtube":
        env_cb = getattr(settings, "YOUTUBE_REDIRECT_URI", None) or os.environ.get("YOUTUBE_REDIRECT_URI")
    elif platform in ("facebook", "instagram"):
        meta_cb = (getattr(settings, "META_REDIRECT_URI", None) or os.environ.get("META_REDIRECT_URI") or "").strip()
        if meta_cb and "admin.sokoflow.com" not in meta_cb:
            return meta_cb
        base = (getattr(settings, "SOCIAL_OAUTH_REDIRECT_BASE", "") or os.environ.get("SOCIAL_OAUTH_REDIRECT_BASE", "")).rstrip("/")
        if base and "admin.sokoflow.com" not in base:
            return f"{base}/api/v1/social/oauth/facebook/callback/"
        return request.build_absolute_uri("/api/v1/social/oauth/facebook/callback/")
    else:
        env_cb = None
    return env_cb or request.build_absolute_uri(f"/api/v1/social/oauth/{platform}/callback/")


def _parse_meta_signed_request(signed_request: str) -> dict | None:
    import base64
    import hashlib
    import hmac
    import json
    import os

    if not signed_request or "." not in signed_request:
        return None
    encoded_sig, payload = signed_request.split(".", 1)
    try:
        sig = base64.urlsafe_b64decode(encoded_sig + "=" * (-len(encoded_sig) % 4))
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)).decode("utf-8"))
    except Exception:
        return None
    secret = getattr(settings, "META_APP_SECRET", "") or os.environ.get("META_APP_SECRET", "")
    if not secret:
        return None
    expected = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        return None
    return data if isinstance(data, dict) else None


def _disconnect_meta_user_accounts(meta_user_id: str, clear_metadata: bool = False) -> int:
    count = 0
    for acc in SocialAccount.objects.filter(platform__in=["facebook", "instagram"]):
        meta = acc.metadata if isinstance(acc.metadata, dict) else {}
        if meta_user_id and str(acc.account_id) != meta_user_id and str(meta.get("meta_user_id", "")) != meta_user_id:
            continue
        acc.access_token = ""
        acc.refresh_token = ""
        acc.token_expires_at = None
        acc.status = AccountConnectionStatus.NOT_CONNECTED
        acc.enabled_for_distribution = False
        acc.error = "Deauthorized via Meta."
        if clear_metadata:
            acc.metadata = {}
        acc.save()
        count += 1
    return count


class MetaDeauthorizeView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"ok": True, "endpoint": "meta-deauthorize"})

    def post(self, request):
        signed_request = request.data.get("signed_request") or request.POST.get("signed_request") or ""
        data = _parse_meta_signed_request(signed_request)
        if data is None:
            return Response({"detail": "Invalid signed_request."}, status=status.HTTP_400_BAD_REQUEST)
        meta_user_id = str(data.get("user_id") or "")
        disconnected = _disconnect_meta_user_accounts(meta_user_id, clear_metadata=False) if meta_user_id else 0
        return Response({"ok": True, "disconnected": disconnected})


class MetaDataDeletionView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"ok": True, "endpoint": "meta-data-deletion"})

    def post(self, request):
        signed_request = request.data.get("signed_request") or request.POST.get("signed_request") or ""
        data = _parse_meta_signed_request(signed_request)
        if data is None:
            return Response({"detail": "Invalid signed_request."}, status=status.HTTP_400_BAD_REQUEST)
        meta_user_id = str(data.get("user_id") or "")
        if meta_user_id:
            _disconnect_meta_user_accounts(meta_user_id, clear_metadata=True)
        code = secrets.token_hex(8)
        admin_ui = getattr(settings, "SOCIAL_ADMIN_UI_URL", "http://localhost:3000").rstrip("/")
        return Response({"url": f"{admin_ui}/social/accounts?data_deletion={code}", "confirmation_code": code})


class CampaignListCreateView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        filters = {
            "status": request.query_params.get("status", "all"),
            "platform": request.query_params.get("platform", "all"),
            "type": request.query_params.get("type", "all"),
            "owner_id": request.query_params.get("owner_id", "all"),
            "date_from": request.query_params.get("date_from"),
            "date_to": request.query_params.get("date_to"),
            "q": request.query_params.get("q", ""),
        }
        campaigns = list_campaigns(filters)
        ctx = _campaign_context(request, campaigns)
        return Response(CampaignSerializer(campaigns, many=True, context=ctx).data)

    def post(self, request):
        if not CanEdit().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        ser = CampaignCreateUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            campaign = create_campaign(ser.validated_data, user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _campaign_context(request, [campaign])
        return Response(CampaignSerializer(campaign, context=ctx).data, status=status.HTTP_201_CREATED)


class CampaignOptionsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        rows = SocialCampaign.objects.order_by("-created_at").values("id", "name")
        return Response({"campaigns": [{"id": str(r["id"]), "name": r["name"]} for r in rows]})


class CampaignKpiView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        filters = {
            "status": request.query_params.get("status", "all"),
            "platform": request.query_params.get("platform", "all"),
            "type": request.query_params.get("type", "all"),
            "owner_id": request.query_params.get("owner_id", "all"),
            "date_from": request.query_params.get("date_from"),
            "date_to": request.query_params.get("date_to"),
            "q": request.query_params.get("q", ""),
        }
        kpis = get_campaign_kpis(filters)
        return Response(CampaignKPISerializer(kpis).data)


class CampaignDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            campaign = get_campaign_detail(str(pk))
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _campaign_context(request, [campaign])
        return Response(CampaignSerializer(campaign, context=ctx).data)

    def delete(self, request, pk: int):
        if not CanEdit().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        SocialCampaign.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignActionView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int, action: str):
        try:
            campaign = transition_campaign_status(str(pk), action, user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _campaign_context(request, [campaign])
        return Response(CampaignSerializer(campaign, context=ctx).data)


class ContentListCreateView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        filters = {
            "q": request.query_params.get("q", ""),
            "platform": request.query_params.get("platform", "all"),
            "content_type": request.query_params.get("content_type", "all"),
            "status": request.query_params.get("status", "all"),
            "campaign_id": request.query_params.get("campaign_id", "all"),
            "owner_id": request.query_params.get("owner_id", "all"),
        }
        items = list_content(filters)
        ctx = _content_context(request, items)
        return Response(
            {
                "items": ContentDraftSerializer(items, many=True, context=ctx).data,
                "total": len(items),
            }
        )

    def post(self, request):
        if not CanEdit().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        ser = ContentDraftSaveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            saved = save_content(ser.validated_data, user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [saved])
        status_code = status.HTTP_200_OK if ser.validated_data.get("id") else status.HTTP_201_CREATED
        return Response(ContentDraftSerializer(saved, context=ctx).data, status=status_code)


class ContentDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            item = get_content_detail(str(pk))
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [item])
        return Response(ContentDraftSerializer(item, context=ctx).data)

    def put(self, request, pk: int):
        return self._save(request, pk)

    def patch(self, request, pk: int):
        return self._save(request, pk)

    def _save(self, request, pk: int):
        if not CanEdit().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        payload = {**request.data, "id": str(pk)}
        ser = ContentDraftSaveSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        try:
            saved = save_content(ser.validated_data, user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [saved])
        return Response(ContentDraftSerializer(saved, context=ctx).data)

    def delete(self, request, pk: int):
        if not CanEdit().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        try:
            delete_content(str(pk), user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentSearchView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        try:
            limit = max(1, min(50, int(request.query_params.get("limit", 20))))
        except (TypeError, ValueError):
            limit = 20
        items = list_content({"q": q})[:limit]
        out = []
        for c in items:
            first_link = c.content_media_links.select_related("media").order_by("sort_order", "id").first()
            thumb = None
            if first_link:
                m = first_link.media
                thumb = m.thumbnail_url or m.url or (request.build_absolute_uri(m.file.url) if m.file else None)
            platforms = c.platforms or []
            out.append(
                {
                    "id": str(c.id),
                    "title": c.title or "Untitled",
                    "type": "video" if c.content_type in ("video", "reel", "short") else ("image" if c.content_type == "image" else ("draft" if c.status == ContentStatus.DRAFT else "post")),
                    "platform": platforms[0] if len(platforms) == 1 else "multi",
                    "status": c.status if c.status in ("draft", "scheduled", "published") else "draft",
                    "thumbnail_url": thumb,
                    "url": None,
                }
            )
        return Response(out)


class ContentSchedulingOptionsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        items = list_content({"q": q})
        return Response({"items": ContentRefSerializer(items, many=True).data})


class ContentDuplicateView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            dup = duplicate_content(str(pk), user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [dup])
        return Response(ContentDraftSerializer(dup, context=ctx).data, status=status.HTTP_201_CREATED)


class ContentSubmitApprovalView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            item = submit_content_for_approval(str(pk), user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [item])
        return Response(ContentDraftSerializer(item, context=ctx).data)


class ContentApproveView(APIView):
    permission_classes = [IsStaff, CanApprove]

    def post(self, request, pk: int):
        try:
            item = approve_content(str(pk), user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [item])
        return Response(ContentDraftSerializer(item, context=ctx).data)


class ContentRejectView(APIView):
    permission_classes = [IsStaff, CanApprove]

    def post(self, request, pk: int):
        ser = ContentApprovalActionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            item = reject_content(str(pk), ser.validated_data["reason"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [item])
        return Response(ContentDraftSerializer(item, context=ctx).data)


class ContentRequestChangesView(APIView):
    permission_classes = [IsStaff, CanApprove]

    def post(self, request, pk: int):
        ser = ContentApprovalActionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            item = request_content_changes(str(pk), ser.validated_data["reason"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [item])
        return Response(ContentDraftSerializer(item, context=ctx).data)


class ContentScheduleView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        ser = ContentScheduleActionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            item = schedule_content_from_studio(str(pk), ser.validated_data["scheduled_at"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [item])
        return Response(ContentDraftSerializer(item, context=ctx).data)


class ContentPublishNowView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            item = publish_content_now_from_studio(str(pk), user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _content_context(request, [item])
        return Response(ContentDraftSerializer(item, context=ctx).data)


class ContentSuggestView(APIView):
    permission_classes = [IsStaff]

    def post(self, request):
        ser = ContentSuggestRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            suggestions = suggest_content_copy(
                ser.validated_data["field"],
                ser.validated_data["context"],
                ser.validated_data.get("platform"),
            )
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response({"suggestions": suggestions})


class ContentCategoryListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        cats = SocialContentCategory.objects.all().order_by("name")
        return Response({"categories": SocialContentCategorySerializer(cats, many=True).data})

    def post(self, request):
        if not CanEdit().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"detail": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
        cat = SocialContentCategory.objects.create(
            name=name[:128],
            slug=slugify(name)[:120] or f"cat-{int(timezone.now().timestamp())}",
        )
        return Response(SocialContentCategorySerializer(cat).data, status=status.HTTP_201_CREATED)


class MediaLibraryListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        assets = list_media_library(
            q=request.query_params.get("q", ""),
            kind=request.query_params.get("kind", ""),
            folder_id=request.query_params.get("folder_id"),
        )
        return Response({"assets": MediaAssetSerializer(assets, many=True, context={"request": request}).data})


class MediaUploadView(APIView):
    permission_classes = [IsStaff, CanManageMedia]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        ser = MediaUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        asset = upload_media_asset(
            ser.validated_data["file"],
            folder_id=ser.validated_data.get("folder_id"),
            tags=ser.validated_data.get("tags"),
        )
        return Response(
            MediaAssetSerializer(asset, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MediaDetailView(APIView):
    permission_classes = [IsStaff, CanManageMedia]

    def delete(self, request, pk: int):
        asset = SocialMedia.objects.filter(pk=pk).first()
        if not asset:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if asset.file:
            asset.file.delete(save=False)
        if asset.thumbnail:
            asset.thumbnail.delete(save=False)
        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaFolderListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        folders = SocialMediaFolder.objects.all().order_by("name")
        return Response({"folders": SocialMediaFolderSerializer(folders, many=True).data})

    def post(self, request):
        if not CanManageMedia().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"detail": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
        folder = SocialMediaFolder.objects.create(
            name=name[:128],
            slug=slugify(name)[:120] or f"folder-{int(timezone.now().timestamp())}",
        )
        return Response(SocialMediaFolderSerializer(folder).data, status=status.HTTP_201_CREATED)


class InboxConversationListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        filters = {
            "folder": request.query_params.get("folder", "all"),
            "platform": request.query_params.get("platform", "all"),
            "q": request.query_params.get("q", ""),
        }
        conversations = list_inbox_conversations(filters, user=request.user)
        ctx = _inbox_context(request, conversations)
        return Response(ConversationSerializer(conversations, many=True, context=ctx).data)


class InboxCapabilitiesView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        return Response(get_inbox_capabilities())


class InboxMetricsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        return Response(InboxMetricsSerializer(get_inbox_metrics()).data)


class InboxConversationDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            conv = get_inbox_conversation(str(pk))
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _inbox_context(request, [conv])
        return Response(ConversationSerializer(conv, context=ctx).data)


class InboxConversationReplyView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        ser = InboxReplyCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            conv = reply_to_conversation(str(pk), ser.validated_data["body"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _inbox_context(request, [conv])
        return Response(ConversationSerializer(conv, context=ctx).data)


class InboxConversationNoteView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        ser = InboxNoteCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            conv = add_internal_note(str(pk), ser.validated_data["body"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _inbox_context(request, [conv])
        return Response(ConversationSerializer(conv, context=ctx).data)


class InboxConversationAssignView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        ser = InboxAssignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        staff_id = ser.validated_data.get("staff_id") or None
        try:
            conv = assign_conversation(str(pk), staff_id, user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _inbox_context(request, [conv])
        return Response(ConversationSerializer(conv, context=ctx).data)


class InboxConversationActionView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int, action: str):
        payload = request.data if isinstance(request.data, dict) else {}
        if action == "react":
            ser = InboxReactSerializer(data=payload)
            ser.is_valid(raise_exception=True)
            payload = ser.validated_data
        try:
            conv = perform_conversation_action(str(pk), action, payload, user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _inbox_context(request, [conv])
        return Response(ConversationSerializer(conv, context=ctx).data)


class InboxConversationLinkProductView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        ser = InboxLinkProductSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            conv = link_conversation_product(str(pk), ser.validated_data["product_id"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _inbox_context(request, [conv])
        return Response(ConversationSerializer(conv, context=ctx).data)


class InboxConversationLinkCustomerView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        ser = InboxLinkCustomerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            conv = link_conversation_customer(str(pk), ser.validated_data["customer_id"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        ctx = _inbox_context(request, [conv])
        return Response(ConversationSerializer(conv, context=ctx).data)


class InboxTemplateListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialInboxTemplate.objects.filter(is_active=True).order_by("label")
        return Response(SocialInboxTemplateSerializer(qs, many=True).data)

    def post(self, request):
        if not CanManageTemplates().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        ser = SocialInboxTemplateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        tpl = ser.save(created_by=request.user if request.user.is_authenticated else None)
        return Response(SocialInboxTemplateSerializer(tpl).data, status=status.HTTP_201_CREATED)


class InboxTemplateDetailView(APIView):
    permission_classes = [IsStaff, CanManageTemplates]

    def patch(self, request, pk: int):
        tpl = SocialInboxTemplate.objects.filter(pk=pk).first()
        if not tpl:
            return Response({"detail": "Template not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SocialInboxTemplateSerializer(tpl, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk: int):
        SocialInboxTemplate.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScheduledPostListCreateView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        filters = {
            "from": request.query_params.get("from"),
            "to": request.query_params.get("to"),
            "platform": request.query_params.get("platform", "all"),
            "status": request.query_params.get("status", "all"),
            "account_id": request.query_params.get("account_id", "all"),
            "campaign_id": request.query_params.get("campaign_id", "all"),
            "owner_id": request.query_params.get("owner_id", "all"),
            "q": request.query_params.get("q", ""),
        }
        posts, tz_name, server_now = list_scheduled_posts(filters)
        return Response(
            {
                "posts": ScheduledPostSerializer(posts, many=True).data,
                "time_zone": tz_name,
                "server_now": server_now,
            }
        )

    def post(self, request):
        if not CanEdit().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        ser = ScheduledPostCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            post = schedule_post(
                content_id=data["content_id"],
                platform=data["platform"],
                account_id=data["account_id"],
                scheduled_at=data["scheduled_at"],
                as_reminder=data.get("as_reminder", False),
                user=request.user,
            )
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(ScheduledPostSerializer(post).data, status=status.HTTP_201_CREATED)


class ScheduledPostDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        post = (
            SocialScheduledPost.objects.select_related("content", "account", "campaign", "owner", "approver")
            .prefetch_related("history")
            .filter(pk=pk)
            .first()
        )
        if not post:
            return Response({"detail": "Scheduled post not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ScheduledPostSerializer(post).data)


class ScheduledPostRescheduleView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        ser = ScheduledPostRescheduleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            post = reschedule_scheduled_post(str(pk), ser.validated_data["scheduled_at"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(ScheduledPostSerializer(post).data)


class ScheduledPostCancelView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        ser = ScheduledPostCancelSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            post = cancel_scheduled_post(str(pk), ser.validated_data.get("reason", ""), user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(ScheduledPostSerializer(post).data)


class ScheduledPostRetryView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            post = publish_scheduled_post_now(str(pk), user=request.user, is_retry=True)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(ScheduledPostSerializer(post).data)


class ScheduledPostPublishNowView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            post = publish_scheduled_post_now(str(pk), user=request.user, is_retry=False)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(ScheduledPostSerializer(post).data)


class ScheduledPostDuplicateView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        ser = ScheduledPostDuplicateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            dup = duplicate_scheduled_post(str(pk), ser.validated_data["scheduled_at"], user=request.user)
        except SocialServiceError as exc:
            return _error_response(exc)
        return Response(ScheduledPostSerializer(dup).data, status=status.HTTP_201_CREATED)


class ScheduledPostHistoryView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        post = SocialScheduledPost.objects.filter(pk=pk).first()
        if not post:
            return Response({"detail": "Scheduled post not found."}, status=status.HTTP_404_NOT_FOUND)
        rows = SocialScheduledPostHistory.objects.select_related("actor").filter(scheduled_post=post).order_by("-created_at")
        return Response({"history": ScheduledPostHistorySerializer(rows, many=True).data})


class ScheduledPostBulkDeleteView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request):
        ser = BulkIdsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        deleted, _ = SocialScheduledPost.objects.filter(pk__in=ser.validated_data["ids"]).exclude(
            status=PublishStatus.PUBLISHED
        ).delete()
        return Response({"deleted": deleted})


class ScheduledPostBulkRescheduleView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request):
        ser = BulkRescheduleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        updated = SocialScheduledPost.objects.filter(pk__in=ser.validated_data["ids"]).exclude(
            status__in=[PublishStatus.PUBLISHED, PublishStatus.PUBLISHING, PublishStatus.CANCELLED]
        ).update(
            scheduled_at=ser.validated_data["scheduled_at"],
            status=PublishStatus.SCHEDULED,
            updated_at=timezone.now(),
        )
        return Response({"updated": updated})


class QueueSlotListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialQueueSlot.objects.all().order_by("time_of_day")
        return Response(SocialQueueSlotSerializer(qs, many=True).data)

    def post(self, request):
        if not CanManageQueue().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        ser = SocialQueueSlotSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        slot = ser.save()
        return Response(SocialQueueSlotSerializer(slot).data, status=status.HTTP_201_CREATED)


class QueueSlotDetailView(APIView):
    permission_classes = [IsStaff, CanManageQueue]

    def patch(self, request, pk: int):
        slot = SocialQueueSlot.objects.filter(pk=pk).first()
        if not slot:
            return Response({"detail": "Queue slot not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SocialQueueSlotSerializer(slot, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk: int):
        SocialQueueSlot.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EvergreenListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialEvergreenPost.objects.all().order_by("last_used_at", "created_at")
        return Response(SocialEvergreenPostSerializer(qs, many=True).data)

    def post(self, request):
        if not CanManageQueue().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        ser = SocialEvergreenPostSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        post = ser.save()
        return Response(SocialEvergreenPostSerializer(post).data, status=status.HTTP_201_CREATED)


class EvergreenDetailView(APIView):
    permission_classes = [IsStaff, CanManageQueue]

    def patch(self, request, pk: int):
        post = SocialEvergreenPost.objects.filter(pk=pk).first()
        if not post:
            return Response({"detail": "Evergreen post not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SocialEvergreenPostSerializer(post, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk: int):
        SocialEvergreenPost.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SocialLinkListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialLink.objects.order_by("-created_at")
        return Response(SocialLinkSerializer(qs, many=True).data)

    def post(self, request):
        if not CanManageLinks().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        destination = str(request.data.get("destination", "")).strip()
        if not destination:
            return Response({"detail": "Destination is required."}, status=status.HTTP_400_BAD_REQUEST)
        link = SocialLink.objects.create(
            short_code=secrets.token_urlsafe(6)[:8],
            destination=destination,
            utm=dict(request.data.get("utm") or {}),
            campaign_id=request.data.get("campaign_id") or None,
            content_id=request.data.get("content_id") or None,
            created_by=request.user if request.user.is_authenticated else None,
        )
        return Response(SocialLinkSerializer(link).data, status=status.HTTP_201_CREATED)


class SocialLinkDetailView(APIView):
    permission_classes = [IsStaff, CanManageLinks]

    def delete(self, request, pk: int):
        SocialLink.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SocialNotificationListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialNotification.objects.order_by("-created_at")
        if request.query_params.get("unread") == "1":
            qs = qs.filter(is_read=False)
        return Response(
            {
                "results": SocialNotificationSerializer(qs[:50], many=True).data,
                "unread_count": SocialNotification.objects.filter(is_read=False).count(),
            }
        )


class SocialNotificationReadView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk: int):
        SocialNotification.objects.filter(pk=pk).update(is_read=True)
        return Response({"ok": True})


class SocialNotificationReadAllView(APIView):
    permission_classes = [IsStaff]

    def post(self, request):
        updated = SocialNotification.objects.filter(is_read=False).update(is_read=True)
        return Response({"marked_read": updated})


class SocialTeamListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        members = SocialTeamMember.objects.select_related("user").order_by("role", "id")
        return Response(SocialTeamMemberSerializer(members, many=True).data)

    def post(self, request):
        if not CanManageTeam().has_permission(request, self):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        email = str(request.data.get("email", "")).strip().lower()
        role = str(request.data.get("role", TeamRole.EDITOR)).lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if role not in {c for c, _ in TeamRole.choices}:
            return Response({"detail": "Unknown role."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "No user with that email."}, status=status.HTTP_404_NOT_FOUND)
        member, created = SocialTeamMember.objects.update_or_create(
            user=user,
            defaults={
                "role": role,
                "is_active": True,
                "invited_by": request.user if request.user.is_authenticated else None,
                "invited_at": timezone.now(),
            },
        )
        return Response(
            SocialTeamMemberSerializer(member).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SocialTeamMemberDetailView(APIView):
    permission_classes = [IsStaff, CanManageTeam]

    def patch(self, request, pk: int):
        member = SocialTeamMember.objects.filter(pk=pk).first()
        if not member:
            return Response({"detail": "Team member not found."}, status=status.HTTP_404_NOT_FOUND)
        if "role" in request.data:
            role = str(request.data["role"]).lower()
            if role not in {c for c, _ in TeamRole.choices}:
                return Response({"detail": "Unknown role."}, status=status.HTTP_400_BAD_REQUEST)
            member.role = role
        if "is_active" in request.data:
            member.is_active = bool(request.data["is_active"])
        member.save()
        return Response(SocialTeamMemberSerializer(member).data)

    def delete(self, request, pk: int):
        SocialTeamMember.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SocialAuditLogListView(APIView):
    permission_classes = [IsStaff, CanViewAuditLog]

    def get(self, request):
        qs = SocialAuditLog.objects.select_related("actor").order_by("-created_at")
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        actor = request.query_params.get("actor")
        if actor:
            qs = qs.filter(actor_id=actor)
        return Response(SocialAuditLogSerializer(qs[:200], many=True).data)