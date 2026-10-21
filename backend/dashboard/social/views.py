from __future__ import annotations

import logging
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    DraftStatus,
    InboxItemStatus,
    InboxItemType,
    MediaType,
    NotificationType,
    PostStatus,
    ReportFormat,
    SocialAccount,
    SocialAuditLog,
    SocialBestTimePost,
    SocialDemographicSnapshot,
    SocialDraft,
    SocialDraftComment,
    SocialEngagementSnapshot,
    SocialEvergreenPost,
    SocialFollowerSnapshot,
    SocialInboxItem,
    SocialInboxReply,
    SocialLink,
    SocialMedia,
    SocialMediaFolder,
    SocialNotification,
    SocialPlatform,
    SocialPost,
    SocialPostTarget,
    SocialQueueSlot,
    SocialReport,
    SocialTeamMember,
    SocialTemplate,
    TargetStatus,
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
    BulkIdsSerializer,
    BulkRescheduleSerializer,
    ConnectResultSerializer,
    DisconnectResultSerializer,
    DraftCommentCreateSerializer,
    DraftCreateSerializer,
    EngagementPointSerializer,
    FollowerGrowthPointSerializer,
    InboxReplyCreateSerializer,
    MediaUploadSerializer,
    PostCreateSerializer,
    PostCreatedSerializer,
    PublishedPostSerializer,
    ScheduledPostSerializer,
    SocialAccountDetailSerializer,
    SocialAccountSerializer,
    SocialAuditLogSerializer,
    SocialBestTimePostSerializer,
    SocialDemographicSnapshotSerializer,
    SocialDraftCommentSerializer,
    SocialDraftSerializer,
    SocialEngagementSnapshot,
    SocialEvergreenPostSerializer,
    SocialInboxItemSerializer,
    SocialInboxReplySerializer,
    SocialLinkSerializer,
    SocialMediaFolderSerializer,
    SocialMediaSerializer,
    SocialNotificationSerializer,
    SocialPostSerializer,
    SocialQueueSlotSerializer,
    SocialReportSerializer,
    SocialTeamMemberSerializer,
    SocialTemplateSerializer,
    to_db,
    to_wire,
)
from .services.oauth import (
    build_state,
    parse_state,
    redirect_uri,
    upsert_account,
)
from .tasks import generate_report, publish_post, sync_inbox

logger = logging.getLogger("social.views")


def _platform_or_404(platform: str) -> str | None:
    code = to_db(platform)
    valid = {c for c, _ in SocialPlatform.choices}
    return code if code in valid else None


def _paginate(qs, request, default_size: int = 50, max_size: int = 500):
    try:
        size = max(1, min(max_size, int(request.query_params.get("page_size", default_size))))
    except (TypeError, ValueError):
        size = default_size
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    start = (page - 1) * size
    end = start + size
    total = qs.count()
    return qs[start:end], {
        "page": page,
        "page_size": size,
        "total": total,
        "has_more": end < total,
    }


class AccountListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        existing = {a.platform: a for a in SocialAccount.objects.all()}
        payload = []
        for code, _ in SocialPlatform.choices:
            account = existing.get(code)
            if account is None:
                account = SocialAccount(
                    platform=code,
                    display_name="",
                    handle="",
                    is_connected=False,
                )
            payload.append(
                SocialAccountSerializer(account, context={"request": request}).data
            )
        return Response(payload)


class AccountDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, platform: str):
        code = _platform_or_404(platform)
        if code is None:
            return Response({"detail": f"Unknown platform {platform!r}."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            account = SocialAccount.objects.get(platform=code)
        except SocialAccount.DoesNotExist:
            return Response({"detail": "Not connected."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SocialAccountDetailSerializer(account, context={"request": request}).data)


class AccountConnectView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request, platform: str):
        code = _platform_or_404(platform)
        if code is None:
            return Response({"detail": f"Unknown platform {platform!r}."}, status=status.HTTP_400_BAD_REQUEST)

        if getattr(settings, "SOCIAL_DRY_RUN", True):
            account, _ = SocialAccount.objects.get_or_create(platform=code)
            account.is_connected = True
            account.connected_at = timezone.now()
            account.last_synced_at = timezone.now()
            account.handle = account.handle or f"@{code.lower()}_dry"
            account.display_name = account.display_name or dict(SocialPlatform.choices).get(code, code)
            account.last_error = ""
            account.save()
            return Response(
                SocialAccountSerializer(account, context={"request": request}).data
            )

        try:
            state = build_state(code, request.user.pk)
        except Exception as exc:
            logger.exception("build_state failed for %s", code)
            return Response({"detail": f"Could not start OAuth: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        auth_url = _build_auth_url(code, state)
        if not auth_url:
            return Response({"detail": f"No OAuth URL configured for {code}."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({"authUrl": auth_url})


class AccountDisconnectView(APIView):
    permission_classes = [IsStaff, CanManageAccounts]

    def post(self, request, platform: str):
        code = _platform_or_404(platform)
        if code is None:
            return Response({"detail": f"Unknown platform {platform!r}."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = SocialAccount.objects.get(platform=code)
        except SocialAccount.DoesNotExist:
            placeholder = SocialAccount(platform=code, is_connected=False)
            return Response(SocialAccountSerializer(placeholder, context={"request": request}).data)

        account.is_connected = False
        account.handle = ""
        account.access_token = ""
        account.refresh_token = ""
        account.token_expires_at = None
        account.scopes = []
        account.avatar_url = ""
        account.last_error = ""
        account.save(update_fields=[
            "is_connected", "handle",
            "access_token", "refresh_token", "token_expires_at",
            "scopes", "avatar_url",
            "last_error", "updated_at",
        ])
        return Response(SocialAccountSerializer(account, context={"request": request}).data)


class PlatformCapabilitiesView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        from .services import platform_capabilities
        return Response(platform_capabilities())


class MediaUploadView(APIView):
    permission_classes = [IsStaff, CanManageMedia]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        ser = MediaUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        f = ser.validated_data["file"]

        ctype = (f.content_type or "").lower()
        if ctype.startswith("image/"):
            media_type = MediaType.IMAGE
        elif ctype.startswith("video/"):
            media_type = MediaType.VIDEO
        else:
            return Response({"detail": "Unsupported file type."}, status=status.HTTP_400_BAD_REQUEST)

        folder_id = request.data.get("folder_id") or None
        folder = None
        if folder_id:
            try:
                folder = SocialMediaFolder.objects.get(pk=int(folder_id))
            except (SocialMediaFolder.DoesNotExist, ValueError, TypeError):
                folder = None

        media = SocialMedia.objects.create(
            post=None,
            folder=folder,
            file=f,
            media_type=media_type,
            filename=getattr(f, "name", "") or "",
            size_bytes=f.size,
            title=str(request.data.get("title", ""))[:255],
            tags=list(request.data.getlist("tags")) if hasattr(request.data, "getlist") else [],
        )
        return Response(
            SocialMediaSerializer(media, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MediaLibraryListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialMedia.objects.select_related("folder").order_by("-created_at")
        folder_id = request.query_params.get("folder_id")
        if folder_id:
            qs = qs.filter(folder_id=folder_id)
        media_type = request.query_params.get("media_type")
        if media_type:
            qs = qs.filter(media_type=media_type.upper())
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(filename__icontains=search))

        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialMediaSerializer(page_qs, many=True, context={"request": request}).data,
            **meta,
        })


class MediaDetailView(APIView):
    permission_classes = [IsStaff, CanManageMedia]

    def patch(self, request, pk: int):
        try:
            media = SocialMedia.objects.get(pk=pk)
        except SocialMedia.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if "title" in request.data:
            media.title = str(request.data.get("title", ""))[:255]
        if "tags" in request.data:
            media.tags = list(request.data.get("tags") or [])
        if "folder_id" in request.data:
            folder_id = request.data.get("folder_id") or None
            media.folder = SocialMediaFolder.objects.filter(pk=folder_id).first() if folder_id else None
        media.save()
        return Response(SocialMediaSerializer(media, context={"request": request}).data)

    def delete(self, request, pk: int):
        try:
            media = SocialMedia.objects.get(pk=pk)
        except SocialMedia.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)
        try:
            media.file.delete(save=False)
        except Exception:
            logger.warning("Could not delete file for media %s", pk, exc_info=True)
        media.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaFolderListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialMediaFolder.objects.all().order_by("name")
        return Response(SocialMediaFolderSerializer(qs, many=True).data)

    def post(self, request):
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"detail": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils.text import slugify
        slug = slugify(name) or f"folder-{timezone.now().timestamp()}"
        folder = SocialMediaFolder.objects.create(name=name, slug=slug)
        return Response(SocialMediaFolderSerializer(folder).data, status=status.HTTP_201_CREATED)


class ScheduledPostListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = (
            SocialPost.objects
            .filter(status=PostStatus.SCHEDULED)
            .prefetch_related("targets", "media")
            .order_by("scheduled_for")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        platform_filter = request.query_params.get("platform")
        if platform_filter:
            qs = qs.filter(targets__platform=to_db(platform_filter))

        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": ScheduledPostSerializer(page_qs, many=True, context={"request": request}).data,
            **meta,
        })


class PublishedPostListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = (
            SocialPostTarget.objects
            .filter(status__in=[TargetStatus.PUBLISHED, TargetStatus.FAILED])
            .select_related("post")
            .order_by("-published_at")
        )
        platform_filter = request.query_params.get("platform")
        if platform_filter:
            qs = qs.filter(platform=to_db(platform_filter))
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(post__caption__icontains=search)

        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": PublishedPostSerializer(page_qs, many=True, context={"request": request}).data,
            **meta,
        })


class PublishedPostDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            target = SocialPostTarget.objects.select_related("post").get(pk=pk)
        except SocialPostTarget.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(PublishedPostSerializer(target, context={"request": request}).data)


class PostCreateView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request):
        ser = PostCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        schedule_at = data.get("schedule_at")
        platform_codes = data["platforms"]
        media_ids = data.get("media_ids") or []

        with transaction.atomic():
            post = SocialPost.objects.create(
                caption=data["caption"],
                first_comment=data.get("first_comment", "") or "",
                product_tag=data.get("product_tag", "") or "",
                campaign=data.get("campaign", "") or "",
                link_url=data.get("link_url", "") or "",
                link_utm=data.get("link_utm", {}) or {},
                scheduled_for=schedule_at,
                status=PostStatus.SCHEDULED if schedule_at else PostStatus.DRAFT,
                created_by=request.user if request.user.is_authenticated else None,
            )

            if media_ids:
                SocialMedia.objects.filter(id__in=media_ids, post__isnull=True).update(post=post)

            SocialPostTarget.objects.bulk_create([
                SocialPostTarget(post=post, platform=code)
                for code in platform_codes
            ])

            SocialAuditLog.objects.create(
                actor=request.user if request.user.is_authenticated else None,
                action="post.create",
                target_type="SocialPost",
                target_id=str(post.pk),
                details={"platforms": platform_codes, "scheduled": bool(schedule_at)},
            )

        if not schedule_at:
            try:
                publish_post.delay(post.pk)
            except Exception:
                logger.exception("publish_post.delay failed for post %s", post.pk)
            return Response(
                PostCreatedSerializer({"id": post.pk, "status": post.status}).data,
                status=status.HTTP_202_ACCEPTED,
            )

        post.refresh_from_db()
        return Response(
            ScheduledPostSerializer(post, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PostDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            post = SocialPost.objects.prefetch_related("targets", "media").get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SocialPostSerializer(post, context={"request": request}).data)

    def patch(self, request, pk: int):
        try:
            post = SocialPost.objects.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if post.status in (PostStatus.PUBLISHED, PostStatus.PARTIAL, PostStatus.PUBLISHING):
            return Response({"detail": "Cannot edit a post that is publishing or published."}, status=status.HTTP_400_BAD_REQUEST)

        if "caption" in request.data:
            post.caption = str(request.data["caption"])
        if "first_comment" in request.data or "firstComment" in request.data:
            post.first_comment = str(request.data.get("first_comment", request.data.get("firstComment", "")))
        if "product_tag" in request.data or "productTag" in request.data:
            post.product_tag = str(request.data.get("product_tag", request.data.get("productTag", "")))
        if "scheduled_for" in request.data or "scheduleAt" in request.data:
            raw = request.data.get("scheduled_for", request.data.get("scheduleAt"))
            if raw:
                from django.utils.dateparse import parse_datetime
                parsed = parse_datetime(str(raw))
                if parsed and parsed > timezone.now():
                    post.scheduled_for = parsed
                    post.status = PostStatus.SCHEDULED
        post.save()
        return Response(ScheduledPostSerializer(post, context={"request": request}).data)


class PostPublishNowView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            post = SocialPost.objects.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if post.status in (PostStatus.PUBLISHED, PostStatus.PARTIAL):
            return Response({"detail": f"Post is already {post.status.lower()}."}, status=status.HTTP_400_BAD_REQUEST)

        post.status = PostStatus.DRAFT
        post.scheduled_for = None
        post.save(update_fields=["status", "scheduled_for", "updated_at"])

        try:
            publish_post.delay(post.pk)
        except Exception:
            logger.exception("publish_post.delay failed for post %s", post.pk)

        return Response({"ok": True}, status=status.HTTP_202_ACCEPTED)


class PostDeleteView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def delete(self, request, pk: int):
        try:
            post = SocialPost.objects.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        for m in post.media.all():
            try:
                m.file.delete(save=False)
            except Exception:
                logger.warning("Could not delete file for media %s", m.pk, exc_info=True)

        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PostBulkDeleteView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request):
        ser = BulkIdsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ids = ser.validated_data["ids"]

        posts = SocialPost.objects.filter(pk__in=ids)
        for post in posts:
            for m in post.media.all():
                try:
                    m.file.delete(save=False)
                except Exception:
                    pass
        deleted, _ = posts.delete()
        return Response({"deleted": deleted})


class PostBulkRescheduleView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request):
        ser = BulkRescheduleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ids = ser.validated_data["ids"]
        schedule_at = ser.validated_data["scheduleAt"]

        updated = SocialPost.objects.filter(pk__in=ids).exclude(
            status__in=[PostStatus.PUBLISHED, PostStatus.PARTIAL, PostStatus.PUBLISHING]
        ).update(
            scheduled_for=schedule_at,
            status=PostStatus.SCHEDULED,
            updated_at=timezone.now(),
        )
        return Response({"updated": updated})


class PostNowFromScheduledView(PostPublishNowView):
    pass


class CalendarView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        start_param = request.query_params.get("start")
        end_param = request.query_params.get("end")
        from django.utils.dateparse import parse_date

        end = parse_date(end_param) if end_param else timezone.now().date() + timedelta(days=30)
        start = parse_date(start_param) if start_param else timezone.now().date() - timedelta(days=7)

        qs = (
            SocialPost.objects
            .filter(status=PostStatus.SCHEDULED, scheduled_for__date__gte=start, scheduled_for__date__lte=end)
            .prefetch_related("targets", "media")
            .order_by("scheduled_for")
        )
        platform_filter = request.query_params.get("platform")
        if platform_filter:
            qs = qs.filter(targets__platform=to_db(platform_filter))

        return Response(ScheduledPostSerializer(qs, many=True, context={"request": request}).data)


class QueueSlotListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialQueueSlot.objects.all().order_by("time_of_day")
        return Response(SocialQueueSlotSerializer(qs, many=True).data)

    def post(self, request):
        ser = SocialQueueSlotSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        slot = ser.save()
        return Response(SocialQueueSlotSerializer(slot).data, status=status.HTTP_201_CREATED)


class QueueSlotDetailView(APIView):
    permission_classes = [IsStaff, CanManageQueue]

    def patch(self, request, pk: int):
        try:
            slot = SocialQueueSlot.objects.get(pk=pk)
        except SocialQueueSlot.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
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
        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialEvergreenPostSerializer(page_qs, many=True).data,
            **meta,
        })

    def post(self, request):
        ser = SocialEvergreenPostSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        post = ser.save()
        return Response(SocialEvergreenPostSerializer(post).data, status=status.HTTP_201_CREATED)


class EvergreenDetailView(APIView):
    permission_classes = [IsStaff, CanManageQueue]

    def patch(self, request, pk: int):
        try:
            post = SocialEvergreenPost.objects.get(pk=pk)
        except SocialEvergreenPost.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SocialEvergreenPostSerializer(post, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk: int):
        SocialEvergreenPost.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DraftListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = (
            SocialDraft.objects
            .select_related("author", "reviewer", "source_post")
            .prefetch_related("comments")
            .order_by("-last_edited_at")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialDraftSerializer(page_qs, many=True).data,
            **meta,
        })

    def post(self, request):
        ser = DraftCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        draft = SocialDraft.objects.create(
            title=data.get("title", "") or "",
            caption=data.get("caption", "") or "",
            platforms=data.get("platforms") or [],
            fields=data.get("fields") or {},
            author=request.user if request.user.is_authenticated else None,
            status=DraftStatus.DRAFT,
        )
        return Response(SocialDraftSerializer(draft).data, status=status.HTTP_201_CREATED)


class DraftDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            draft = SocialDraft.objects.select_related("author", "reviewer").prefetch_related("comments").get(pk=pk)
        except SocialDraft.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SocialDraftSerializer(draft).data)

    def patch(self, request, pk: int):
        try:
            draft = SocialDraft.objects.get(pk=pk)
        except SocialDraft.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if draft.status in (DraftStatus.APPROVED, DraftStatus.SCHEDULED):
            return Response({"detail": "Approved drafts are locked."}, status=status.HTTP_400_BAD_REQUEST)

        if "title" in request.data:
            draft.title = str(request.data["title"])[:255]
        if "caption" in request.data:
            draft.caption = str(request.data["caption"])
        if "platforms" in request.data:
            draft.platforms = list(request.data["platforms"] or [])
        if "fields" in request.data:
            draft.fields = dict(request.data["fields"] or {})
        draft.save()
        return Response(SocialDraftSerializer(draft).data)

    def delete(self, request, pk: int):
        SocialDraft.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DraftCommentListView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk: int):
        try:
            draft = SocialDraft.objects.get(pk=pk)
        except SocialDraft.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        ser = DraftCommentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        comment = SocialDraftComment.objects.create(
            draft=draft,
            author=request.user if request.user.is_authenticated else None,
            body=data["body"],
            decision=data.get("decision", "") or "",
        )

        decision = data.get("decision")
        if decision == "APPROVED":
            draft.status = DraftStatus.APPROVED
            draft.reviewer = request.user if request.user.is_authenticated else None
            draft.save(update_fields=["status", "reviewer", "last_edited_at"])
        elif decision == "REJECTED":
            draft.status = DraftStatus.REJECTED
            draft.reviewer = request.user if request.user.is_authenticated else None
            draft.save(update_fields=["status", "reviewer", "last_edited_at"])
        elif decision == "CHANGES":
            draft.status = DraftStatus.PENDING
            draft.reviewer = request.user if request.user.is_authenticated else None
            draft.save(update_fields=["status", "reviewer", "last_edited_at"])

        return Response(SocialDraftCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class DraftApproveView(APIView):
    permission_classes = [IsStaff, CanApprove]

    def post(self, request, pk: int):
        try:
            draft = SocialDraft.objects.get(pk=pk)
        except SocialDraft.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        draft.status = DraftStatus.APPROVED
        draft.reviewer = request.user if request.user.is_authenticated else None
        draft.save(update_fields=["status", "reviewer", "last_edited_at"])
        return Response(SocialDraftSerializer(draft).data)


class DraftRejectView(APIView):
    permission_classes = [IsStaff, CanApprove]

    def post(self, request, pk: int):
        try:
            draft = SocialDraft.objects.get(pk=pk)
        except SocialDraft.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        draft.status = DraftStatus.REJECTED
        draft.reviewer = request.user if request.user.is_authenticated else None
        draft.save(update_fields=["status", "reviewer", "last_edited_at"])
        return Response(SocialDraftSerializer(draft).data)


class InboxListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = (
            SocialInboxItem.objects
            .select_related("account", "target", "assigned_to")
            .prefetch_related("replies")
            .order_by("-received_at")
        )
        item_type = request.query_params.get("item_type") or request.query_params.get("type")
        if item_type:
            qs = qs.filter(item_type=item_type.upper())
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        platform_filter = request.query_params.get("platform")
        if platform_filter:
            qs = qs.filter(platform=to_db(platform_filter))
        sentiment_filter = request.query_params.get("sentiment")
        if sentiment_filter:
            qs = qs.filter(sentiment=sentiment_filter.upper())
        assigned = request.query_params.get("assigned_to")
        if assigned == "me":
            qs = qs.filter(assigned_to=request.user)
        elif assigned == "unassigned":
            qs = qs.filter(assigned_to__isnull=True)
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(Q(body__icontains=search) | Q(author_name__icontains=search) | Q(author_handle__icontains=search))

        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialInboxItemSerializer(page_qs, many=True).data,
            **meta,
        })


class InboxDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            item = SocialInboxItem.objects.select_related("account", "target", "assigned_to").prefetch_related("replies").get(pk=pk)
        except SocialInboxItem.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SocialInboxItemSerializer(item).data)


class InboxReplyView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        try:
            item = SocialInboxItem.objects.select_related("account").get(pk=pk)
        except SocialInboxItem.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        ser = InboxReplyCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        body = ser.validated_data["body"]

        if not item.account:
            return Response({"detail": "Item has no linked account."}, status=status.HTTP_400_BAD_REQUEST)

        from .services import get_client
        from .services.base import PlatformError, UnsupportedOperationError

        try:
            client = get_client(item.account)
            if item.item_type == InboxItemType.COMMENT:
                client.reply_to_comment(item.platform_item_id, body)
            elif item.item_type == InboxItemType.DM:
                client.reply_to_direct_message(item.platform_item_id, body)
            else:
                return Response({"detail": "Cannot reply to mentions."}, status=status.HTTP_400_BAD_REQUEST)
        except UnsupportedOperationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except PlatformError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        reply = SocialInboxReply.objects.create(
            item=item,
            author=request.user if request.user.is_authenticated else None,
            body=body,
            is_outbound=True,
        )
        return Response(SocialInboxReplySerializer(reply).data, status=status.HTTP_201_CREATED)


class InboxStatusView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        try:
            item = SocialInboxItem.objects.get(pk=pk)
        except SocialInboxItem.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = str(request.data.get("status", "")).upper()
        if new_status not in {c for c, _ in InboxItemStatus.choices}:
            return Response({"detail": "Unknown status."}, status=status.HTTP_400_BAD_REQUEST)

        item.status = new_status
        if new_status == InboxItemStatus.RESOLVED:
            item.resolved_at = timezone.now()
        if new_status == InboxItemStatus.SNOOZED:
            snooze_until = request.data.get("snoozed_until")
            if snooze_until:
                from django.utils.dateparse import parse_datetime
                item.snoozed_until = parse_datetime(str(snooze_until))
        item.save()
        return Response(SocialInboxItemSerializer(item).data)


class InboxAssignView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request, pk: int):
        try:
            item = SocialInboxItem.objects.get(pk=pk)
        except SocialInboxItem.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user_id = request.data.get("user_id")
        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                item.assigned_to = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            item.assigned_to = None
        item.save(update_fields=["assigned_to", "updated_at"])
        return Response(SocialInboxItemSerializer(item).data)


class InboxSyncView(APIView):
    permission_classes = [IsStaff, CanManageInbox]

    def post(self, request):
        try:
            sync_inbox.delay()
        except Exception:
            logger.exception("sync_inbox.delay failed")
        return Response({"ok": True}, status=status.HTTP_202_ACCEPTED)


class TemplateListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialTemplate.objects.all().order_by("name")
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialTemplateSerializer(page_qs, many=True).data,
            **meta,
        })

    def post(self, request):
        ser = SocialTemplateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        tpl = ser.save(created_by=request.user if request.user.is_authenticated else None)
        return Response(SocialTemplateSerializer(tpl).data, status=status.HTTP_201_CREATED)


class TemplateDetailView(APIView):
    permission_classes = [IsStaff, CanManageTemplates]

    def patch(self, request, pk: int):
        try:
            tpl = SocialTemplate.objects.get(pk=pk)
        except SocialTemplate.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SocialTemplateSerializer(tpl, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk: int):
        SocialTemplate.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LinkListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialLink.objects.all().order_by("-created_at")
        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialLinkSerializer(page_qs, many=True).data,
            **meta,
        })

    def post(self, request):
        destination = str(request.data.get("destination", "")).strip()
        if not destination:
            return Response({"detail": "Destination is required."}, status=status.HTTP_400_BAD_REQUEST)
        import secrets as _secrets
        short_code = _secrets.token_urlsafe(6)[:8]
        link = SocialLink.objects.create(
            short_code=short_code,
            destination=destination,
            utm=dict(request.data.get("utm") or {}),
            created_by=request.user if request.user.is_authenticated else None,
        )
        return Response(SocialLinkSerializer(link).data, status=status.HTTP_201_CREATED)


class LinkDetailView(APIView):
    permission_classes = [IsStaff, CanManageLinks]

    def delete(self, request, pk: int):
        SocialLink.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialNotification.objects.all().order_by("-created_at")
        if request.query_params.get("unread") == "1":
            qs = qs.filter(is_read=False)
        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialNotificationSerializer(page_qs, many=True).data,
            "unread_count": SocialNotification.objects.filter(is_read=False).count(),
            **meta,
        })


class NotificationReadView(APIView):
    permission_classes = [IsStaff]

    def post(self, request, pk: int):
        SocialNotification.objects.filter(pk=pk).update(is_read=True)
        return Response({"ok": True})


class NotificationReadAllView(APIView):
    permission_classes = [IsStaff]

    def post(self, request):
        count = SocialNotification.objects.filter(is_read=False).update(is_read=True)
        return Response({"marked_read": count})


class TeamListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialTeamMember.objects.select_related("user").order_by("role")
        return Response(SocialTeamMemberSerializer(qs, many=True).data)

    def post(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        email = str(request.data.get("email", "")).strip().lower()
        role = str(request.data.get("role", TeamRole.EDITOR)).upper()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if role not in {c for c, _ in TeamRole.choices}:
            return Response({"detail": "Unknown role."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
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
        return Response(SocialTeamMemberSerializer(member).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class TeamMemberDetailView(APIView):
    permission_classes = [IsStaff, CanManageTeam]

    def patch(self, request, pk: int):
        try:
            member = SocialTeamMember.objects.get(pk=pk)
        except SocialTeamMember.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if "role" in request.data:
            role = str(request.data["role"]).upper()
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


class AuditLogListView(APIView):
    permission_classes = [IsStaff, CanViewAuditLog]

    def get(self, request):
        qs = SocialAuditLog.objects.select_related("actor").order_by("-created_at")
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        actor = request.query_params.get("actor")
        if actor:
            qs = qs.filter(actor_id=actor)
        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialAuditLogSerializer(page_qs, many=True).data,
            **meta,
        })


class ReportListView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        qs = SocialReport.objects.select_related("created_by").order_by("-created_at")
        page_qs, meta = _paginate(qs, request)
        return Response({
            "results": SocialReportSerializer(page_qs, many=True, context={"request": request}).data,
            **meta,
        })

    def post(self, request):
        name = str(request.data.get("name", "")).strip()
        date_from = request.data.get("date_from") or request.data.get("dateFrom")
        date_to = request.data.get("date_to") or request.data.get("dateTo")
        fmt = str(request.data.get("format", "PDF")).upper()

        if not name or not date_from or not date_to:
            return Response({"detail": "name, date_from, date_to are required."}, status=status.HTTP_400_BAD_REQUEST)
        if fmt not in {c for c, _ in ReportFormat.choices}:
            return Response({"detail": "Unknown format."}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils.dateparse import parse_date
        report = SocialReport.objects.create(
            name=name[:255],
            date_from=parse_date(str(date_from)),
            date_to=parse_date(str(date_to)),
            platforms=list(request.data.get("platforms") or []),
            metrics=list(request.data.get("metrics") or []),
            branding=dict(request.data.get("branding") or {}),
            format=fmt,
            created_by=request.user if request.user.is_authenticated else None,
        )

        try:
            generate_report.delay(report.pk)
        except Exception:
            logger.exception("generate_report.delay failed for report %s", report.pk)

        return Response(SocialReportSerializer(report, context={"request": request}).data, status=status.HTTP_202_ACCEPTED)


class ReportDetailView(APIView):
    permission_classes = [IsStaff]

    def get(self, request, pk: int):
        try:
            report = SocialReport.objects.get(pk=pk)
        except SocialReport.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SocialReportSerializer(report, context={"request": request}).data)

    def delete(self, request, pk: int):
        try:
            report = SocialReport.objects.get(pk=pk)
        except SocialReport.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)
        try:
            report.file.delete(save=False)
        except Exception:
            pass
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OverviewView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        now = timezone.now()
        period_start = now - timedelta(days=30)

        total_followers = SocialAccount.objects.filter(is_connected=True).aggregate(total=Sum("followers"))["total"] or 0

        reach_total = SocialPostTarget.objects.filter(
            status=TargetStatus.PUBLISHED, published_at__gte=period_start,
        ).aggregate(total=Sum("reach"))["total"] or 0

        likes = SocialPostTarget.objects.filter(
            status=TargetStatus.PUBLISHED, published_at__gte=period_start,
        ).aggregate(total=Sum("likes"))["total"] or 0
        comments = SocialPostTarget.objects.filter(
            status=TargetStatus.PUBLISHED, published_at__gte=period_start,
        ).aggregate(total=Sum("comments"))["total"] or 0
        shares = SocialPostTarget.objects.filter(
            status=TargetStatus.PUBLISHED, published_at__gte=period_start,
        ).aggregate(total=Sum("shares"))["total"] or 0
        engagement = likes + comments + shares
        engagement_rate = round((engagement / reach_total) * 100, 2) if reach_total else 0.0

        published_count = SocialPostTarget.objects.filter(
            status=TargetStatus.PUBLISHED, published_at__gte=period_start,
        ).count()

        unread_inbox = SocialInboxItem.objects.filter(status=InboxItemStatus.OPEN).count()
        scheduled_week = SocialPost.objects.filter(
            status=PostStatus.SCHEDULED,
            scheduled_for__gte=now,
            scheduled_for__lte=now + timedelta(days=7),
        ).count()
        failed_count = SocialPostTarget.objects.filter(status=TargetStatus.FAILED).count()

        expiring_tokens = []
        for account in SocialAccount.objects.filter(is_connected=True, token_expires_at__isnull=False):
            if account.is_token_expiring_soon:
                expiring_tokens.append({
                    "platform": to_wire(account.platform),
                    "expires_at": account.token_expires_at.isoformat() if account.token_expires_at else None,
                })

        recent_activity = SocialAuditLog.objects.select_related("actor").order_by("-created_at")[:10]
        upcoming = SocialPost.objects.filter(
            status=PostStatus.SCHEDULED, scheduled_for__gte=now,
        ).order_by("scheduled_for")[:5]

        top_posts = (
            SocialPostTarget.objects
            .filter(status=TargetStatus.PUBLISHED, published_at__gte=period_start)
            .order_by("-reach")[:5]
        )

        return Response({
            "kpis": {
                "total_followers": total_followers,
                "reach": reach_total,
                "engagement_rate": engagement_rate,
                "posts_published": published_count,
                "unread_inbox": unread_inbox,
                "scheduled_this_week": scheduled_week,
                "failed_posts": failed_count,
            },
            "expiring_tokens": expiring_tokens,
            "upcoming": ScheduledPostSerializer(upcoming, many=True, context={"request": request}).data,
            "recent_activity": SocialAuditLogSerializer(recent_activity, many=True).data,
            "top_posts": PublishedPostSerializer(top_posts, many=True, context={"request": request}).data,
        })


class FollowerAnalyticsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        try:
            months_back = max(1, min(24, int(request.query_params.get("months", 5))))
        except (TypeError, ValueError):
            months_back = 5

        since = timezone.now().date() - timedelta(days=months_back * 31)
        snaps = (
            SocialFollowerSnapshot.objects
            .filter(date__gte=since)
            .order_by("date")
            .values("platform", "date", "followers")
        )

        buckets: dict[str, dict] = {}
        for row in snaps:
            key = row["date"].strftime("%b")
            bucket = buckets.setdefault(
                key,
                {
                    "month": key,
                    **{to_wire(c): 0 for c, _ in SocialPlatform.choices},
                },
            )
            bucket[to_wire(row["platform"])] = row["followers"]

        ordered = sorted(buckets.values(), key=lambda b: _month_index(b["month"]))
        return Response(ordered)


def _month_index(short: str) -> int:
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    try:
        return months.index(short)
    except ValueError:
        return 0


class EngagementAnalyticsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        snaps = {s.platform: s for s in SocialEngagementSnapshot.objects.all()}

        out = []
        for code, _ in SocialPlatform.choices:
            snap = snaps.get(code)
            if snap is not None:
                out.append({
                    "platform": to_wire(code),
                    "Reach": snap.reach,
                    "Engagement": snap.engagement,
                })
                continue

            qs = SocialPostTarget.objects.filter(platform=code, status=TargetStatus.PUBLISHED)
            reach = qs.aggregate(total=Sum("reach"))["total"] or 0
            likes = qs.aggregate(total=Sum("likes"))["total"] or 0
            comments = qs.aggregate(total=Sum("comments"))["total"] or 0
            shares = qs.aggregate(total=Sum("shares"))["total"] or 0
            out.append({
                "platform": to_wire(code),
                "Reach": reach,
                "Engagement": likes + comments + shares,
            })

        return Response(out)


class DemographicAnalyticsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        platform_filter = request.query_params.get("platform")
        qs = SocialDemographicSnapshot.objects.all()
        if platform_filter:
            qs = qs.filter(platform=to_db(platform_filter))

        latest_by_platform: dict[str, SocialDemographicSnapshot] = {}
        for row in qs.order_by("platform", "-date"):
            latest_by_platform.setdefault(row.platform, row)

        return Response([
            SocialDemographicSnapshotSerializer(row).data
            for row in latest_by_platform.values()
        ])


class BestTimeAnalyticsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        platform_filter = request.query_params.get("platform")
        qs = SocialBestTimePost.objects.all()
        if platform_filter:
            qs = qs.filter(platform=to_db(platform_filter))
        return Response(SocialBestTimePostSerializer(qs.order_by("platform", "day_of_week", "hour"), many=True).data)


class KpiAnalyticsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        now = timezone.now()
        period_days = int(request.query_params.get("days", 30))
        current_start = now - timedelta(days=period_days)
        previous_start = current_start - timedelta(days=period_days)

        def _sums(start, end):
            qs = SocialPostTarget.objects.filter(status=TargetStatus.PUBLISHED, published_at__gte=start, published_at__lt=end)
            return {
                "reach": qs.aggregate(total=Sum("reach"))["total"] or 0,
                "impressions": qs.aggregate(total=Sum("impressions"))["total"] or 0,
                "likes": qs.aggregate(total=Sum("likes"))["total"] or 0,
                "comments": qs.aggregate(total=Sum("comments"))["total"] or 0,
                "shares": qs.aggregate(total=Sum("shares"))["total"] or 0,
                "link_clicks": qs.aggregate(total=Sum("link_clicks"))["total"] or 0,
                "posts": qs.count(),
            }

        current = _sums(current_start, now)
        previous = _sums(previous_start, current_start)

        current["engagement"] = current["likes"] + current["comments"] + current["shares"]
        current["engagement_rate"] = round((current["engagement"] / current["reach"]) * 100, 2) if current["reach"] else 0.0
        previous["engagement"] = previous["likes"] + previous["comments"] + previous["shares"]
        previous["engagement_rate"] = round((previous["engagement"] / previous["reach"]) * 100, 2) if previous["reach"] else 0.0

        def _delta(cur, prev):
            if not prev:
                return 0.0
            return round(((cur - prev) / prev) * 100, 2)

        return Response({
            "current": current,
            "previous": previous,
            "deltas": {
                "reach": _delta(current["reach"], previous["reach"]),
                "engagement": _delta(current["engagement"], previous["engagement"]),
                "engagement_rate": round(current["engagement_rate"] - previous["engagement_rate"], 2),
                "link_clicks": _delta(current["link_clicks"], previous["link_clicks"]),
                "posts": _delta(current["posts"], previous["posts"]),
            },
        })


class TopPostsAnalyticsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        metric = request.query_params.get("metric", "reach")
        if metric not in {"reach", "likes", "comments", "shares", "link_clicks", "video_views"}:
            metric = "reach"
        try:
            limit = max(1, min(50, int(request.query_params.get("limit", 10))))
        except (TypeError, ValueError):
            limit = 10

        platform_filter = request.query_params.get("platform")
        qs = SocialPostTarget.objects.filter(status=TargetStatus.PUBLISHED).select_related("post")
        if platform_filter:
            qs = qs.filter(platform=to_db(platform_filter))

        qs = qs.order_by(f"-{metric}")[:limit]
        return Response(PublishedPostSerializer(qs, many=True, context={"request": request}).data)


class PostBoostView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            target = SocialPostTarget.objects.select_related("post").get(pk=pk)
        except SocialPostTarget.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if target.status != TargetStatus.PUBLISHED:
            return Response({"detail": "Only published posts can be boosted."}, status=status.HTTP_400_BAD_REQUEST)

        budget_cents = int(request.data.get("budget_cents", 5000))
        duration_days = int(request.data.get("duration_days", 7))

        account = SocialAccount.objects.filter(platform=target.platform, is_connected=True).first()
        if not account:
            return Response({"detail": "Account not connected."}, status=status.HTTP_400_BAD_REQUEST)

        from .services import get_client
        from .services.base import PlatformError, UnsupportedOperationError

        try:
            client = get_client(account)
            result = client.boost_post(target.platform_post_id, budget_cents, duration_days, request.data.get("audience") or {})
        except UnsupportedOperationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except PlatformError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        SocialAuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            action="post.boost",
            target_type="SocialPostTarget",
            target_id=str(pk),
            details={"budget_cents": budget_cents, "duration_days": duration_days, "boost_id": result.platform_boost_id},
        )

        return Response({
            "boost_id": result.platform_boost_id,
            "status": result.status,
            "estimated_reach": result.estimated_reach,
        })


class PostDeleteFromPlatformView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            target = SocialPostTarget.objects.get(pk=pk)
        except SocialPostTarget.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        account = SocialAccount.objects.filter(platform=target.platform, is_connected=True).first()
        if not account:
            return Response({"detail": "Account not connected."}, status=status.HTTP_400_BAD_REQUEST)

        from .services import get_client
        from .services.base import PlatformError, UnsupportedOperationError

        try:
            client = get_client(account)
            client.delete_post(target.platform_post_id)
        except UnsupportedOperationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except PlatformError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        target.status = TargetStatus.FAILED
        target.error_message = "Deleted from platform by admin."
        target.save(update_fields=["status", "error_message"])

        SocialAuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            action="post.delete_from_platform",
            target_type="SocialPostTarget",
            target_id=str(pk),
        )
        return Response({"ok": True})


class PostEditCaptionView(APIView):
    permission_classes = [IsStaff, CanEdit]

    def post(self, request, pk: int):
        try:
            target = SocialPostTarget.objects.get(pk=pk)
        except SocialPostTarget.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        caption = str(request.data.get("caption", "")).strip()
        if not caption:
            return Response({"detail": "caption is required."}, status=status.HTTP_400_BAD_REQUEST)

        account = SocialAccount.objects.filter(platform=target.platform, is_connected=True).first()
        if not account:
            return Response({"detail": "Account not connected."}, status=status.HTTP_400_BAD_REQUEST)

        from .services import get_client
        from .services.base import PlatformError, UnsupportedOperationError

        try:
            client = get_client(account)
            client.edit_caption(target.platform_post_id, caption)
        except UnsupportedOperationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except PlatformError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        target.post.caption = caption
        target.post.save(update_fields=["caption", "updated_at"])

        SocialAuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            action="post.edit_caption",
            target_type="SocialPostTarget",
            target_id=str(pk),
        )
        return Response({"ok": True})


def _build_auth_url(platform: str, state: str) -> str:
    if platform in ("FACEBOOK", "INSTAGRAM"):
        params = {
            "client_id": settings.META_APP_ID,
            "redirect_uri": redirect_uri(platform),
            "state": state,
            "scope": ",".join(getattr(settings, "META_SOCIAL_SCOPES", [])),
            "response_type": "code",
        }
        return f"https://www.facebook.com/v21.0/dialog/oauth?{urlencode(params)}"

    if platform == "TIKTOK":
        params = {
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "redirect_uri": redirect_uri(platform),
            "state": state,
            "scope": ",".join(getattr(settings, "TIKTOK_SCOPES", [])),
            "response_type": "code",
        }
        return f"https://www.tiktok.com/v2/auth/authorize/?{urlencode(params)}"

    if platform == "YOUTUBE":
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
            "state": state,
            "scope": " ".join(getattr(settings, "YOUTUBE_SCOPES", [])),
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    return ""


class OAuthCallbackView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, platform: str):
        code = _platform_or_404(platform)
        admin_ui = getattr(settings, "SOCIAL_ADMIN_UI_URL", "http://localhost:3000").rstrip("/")
        error_url = f"{admin_ui}/admin/social?error=oauth&platform={platform}"

        if code is None:
            return redirect(error_url)

        auth_code = request.query_params.get("code", "")
        raw_state = request.query_params.get("state", "")
        if not auth_code:
            logger.warning("OAuth callback for %s: missing code", code)
            return redirect(error_url)

        try:
            state = parse_state(raw_state)
        except Exception:
            logger.warning("OAuth callback: bad state for %s", code)
            return redirect(error_url)

        if state.get("platform") != code:
            logger.warning("OAuth state/platform mismatch: %s != %s", state.get("platform"), code)
            return redirect(error_url)

        try:
            if code in ("FACEBOOK", "INSTAGRAM"):
                _handle_meta(code, auth_code)
            elif code == "TIKTOK":
                _handle_tiktok(auth_code)
            elif code == "YOUTUBE":
                _handle_youtube(auth_code)
            else:
                return redirect(error_url)
        except Exception as exc:
            logger.exception("OAuth callback for %s failed: %s", code, exc)
            return redirect(error_url)

        return redirect(f"{admin_ui}/admin/social?connected={code.lower()}")


def _handle_meta(platform: str, code: str):
    import requests

    token_url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/oauth/access_token"
    resp = requests.get(token_url, params={
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "redirect_uri": redirect_uri(platform),
        "code": code,
    }, timeout=30)
    resp.raise_for_status()
    short_token = resp.json()["access_token"]

    ext = requests.get(token_url, params={
        "grant_type": "fb_exchange_token",
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "fb_exchange_token": short_token,
    }, timeout=30)
    ext.raise_for_status()
    body = ext.json()
    long_token = body["access_token"]
    expires_in = body.get("expires_in")
    expires_at = (
        timezone.now() + timedelta(seconds=int(expires_in))
        if expires_in else None
    )

    meta: dict = {}
    handle = ""
    display_name = ""
    platform_user_id = ""

    pages = requests.get(
        f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/me/accounts",
        params={"access_token": long_token},
        timeout=30,
    ).json().get("data", [])
    if pages:
        page = pages[0]
        meta["page_id"] = page["id"]
        handle = page.get("name", "")
        display_name = page.get("name", "")
        platform_user_id = page["id"]

        if platform == "INSTAGRAM":
            ig = requests.get(
                f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/{page['id']}",
                params={"fields": "instagram_business_account", "access_token": long_token},
                timeout=30,
            ).json().get("instagram_business_account", {})
            if ig:
                meta["ig_user_id"] = ig["id"]
                platform_user_id = ig["id"]

    upsert_account(
        platform,
        handle=handle,
        display_name=display_name,
        platform_user_id=platform_user_id,
        access_token=long_token,
        expires_at=expires_at,
        scopes=getattr(settings, "META_SOCIAL_SCOPES", []),
        metadata=meta,
    )


def _handle_tiktok(code: str):
    import requests

    resp = requests.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        data={
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "client_secret": settings.TIKTOK_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri("TIKTOK"),
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    expires_at = timezone.now() + timedelta(seconds=int(data.get("expires_in", 86400)))

    upsert_account(
        "TIKTOK",
        platform_user_id=data.get("open_id", ""),
        access_token=data.get("access_token", ""),
        refresh_token=data.get("refresh_token", ""),
        expires_at=expires_at,
        scopes=getattr(settings, "TIKTOK_SCOPES", []),
    )


def _handle_youtube(code: str):
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.YOUTUBE_REDIRECT_URI],
            }
        },
        scopes=settings.YOUTUBE_SCOPES,
        redirect_uri=settings.YOUTUBE_REDIRECT_URI,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials

    from googleapiclient.discovery import build
    yt = build("youtube", "v3", credentials=creds, cache_discovery=False)
    channels = yt.channels().list(part="snippet", mine=True).execute()
    items = channels.get("items") or []
    if not items:
        raise RuntimeError("No YouTube channel associated with this Google account.")

    ch = items[0]
    upsert_account(
        "YOUTUBE",
        handle=ch["snippet"].get("customUrl", ""),
        display_name=ch["snippet"].get("title", ""),
        platform_user_id=ch["id"],
        access_token=creds.token or "",
        refresh_token=creds.refresh_token or "",
        expires_at=creds.expiry,
        scopes=settings.YOUTUBE_SCOPES,
        metadata={"channel_id": ch["id"]},
    )