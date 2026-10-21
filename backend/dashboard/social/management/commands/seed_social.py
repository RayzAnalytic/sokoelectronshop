from __future__ import annotations

import random
from datetime import date, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from dashboard.social.models import (
    ApprovalDecision,
    DraftStatus,
    InboxItemStatus,
    InboxItemType,
    MediaType,
    NotificationType,
    PostStatus,
    QueueSlotKind,
    ReportFormat,
    Sentiment,
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


PLATFORMS = [
    SocialPlatform.FACEBOOK,
    SocialPlatform.INSTAGRAM,
    SocialPlatform.TIKTOK,
    SocialPlatform.YOUTUBE,
]

ACCOUNT_META: dict[str, dict] = {
    SocialPlatform.FACEBOOK: {
        "display_name": "SokoFlow Facebook",
        "handle":       "@sokoflow",
        "connected":    True,
        "followers":    14_320,
        "scopes":       ["pages_show_list", "pages_manage_posts", "read_insights"],
    },
    SocialPlatform.INSTAGRAM: {
        "display_name": "SokoFlow Instagram",
        "handle":       "@sokoflow.ke",
        "connected":    True,
        "followers":    24_780,
        "scopes":       ["instagram_basic", "instagram_content_publish", "instagram_manage_comments"],
    },
    SocialPlatform.TIKTOK: {
        "display_name": "SokoFlow TikTok",
        "handle":       "@sokoflow",
        "connected":    True,
        "followers":    11_450,
        "scopes":       ["user.info.basic", "video.publish", "video.list"],
    },
    SocialPlatform.YOUTUBE: {
        "display_name": "SokoFlow YouTube",
        "handle":       "@SokoFlowOfficial",
        "connected":    False,
        "followers":    6_120,
        "scopes":       [],
    },
}

CAPTIONS = [
    "🚀 Big news! SokoFlow Pro is live — automate your storefront in under 5 minutes. #SokoFlow #SaaS",
    "Unboxing the Smart Home Wi-Fi Router AX3000 📶 Setup was 90 seconds, no app needed.",
    "Behind the scenes: how our Nairobi team ships features every single week 🛠️",
    "This keyboard changed my life. Wireless, ergonomic, mechanical. Meet the AX3000 companion.",
    "Flash sale this weekend only — 40% off every accessory in our store. Link in bio.",
    "Meet the UltraWide 29\" Gaming Monitor 🎮 21:9 changes everything for streamers.",
    "One cable. Seven ports. The USB-C Multiport Hub that finally cleans up your desk. 🔌",
    "Customer spotlight: how Mama Njeri scaled her shop from 10 to 1,000 orders with SokoFlow.",
    "New tutorial is live — link in bio. Automate your inventory sync in 3 clicks.",
    "We hit 10,000 active merchants this month. Thank you for trusting us 🙏",
    "Weekend read: the anatomy of a high-converting product page.",
    "Real talk: most stores don't need 20 apps. They need one. Here's why.",
    "Our AI product tagging is now available to all merchants. Tag 1,000 SKUs in one go. ✨",
    "Live webinar this Friday: scaling from 100 to 10,000 orders without burning out.",
    "Three tips to double your average order value this quarter 📈",
    "Shipping now: WhatsApp receipts + M-Pesa reconciliation for every merchant.",
    "Coming soon: multi-currency checkout across East Africa 🌍",
    "SokoFlow turns 3 today 🎂 Here's what three years of building taught us.",
]

FIRST_COMMENTS = [
    "Full guide → link in bio 👆",
    "DM us 'PRO' to get started today.",
    "Tag a friend who needs to see this 🔥",
    "Limited stock — grab yours before midnight.",
    "Drop a 🙋 if you want the discount code.",
]

PRODUCT_TAGS = [
    None, None, None,
    "SokoFlow Pro Subscription",
    "Smart Home Wi-Fi Router AX3000",
    "Wireless Ergonomic Mechanical Keyboard",
    "UltraWide 29\" Gaming Monitor",
    "USB-C Multiport Hub 7-in-1",
]

CAMPAIGNS = [
    "", "", "",
    "Q4 Launch",
    "Summer Sale",
    "Black Friday",
    "Back to School",
    "Weekend Drops",
]

METRIC_PROFILES: dict[str, dict] = {
    SocialPlatform.FACEBOOK: {
        "reach_range":     (2_000, 45_000),
        "like_rate":       (0.02, 0.06),
        "comment_rate":    (0.001, 0.008),
        "share_rate":      (0.002, 0.010),
        "save_rate":       (0.001, 0.005),
        "click_rate":      (0.003, 0.020),
        "profile_rate":    (0.001, 0.006),
    },
    SocialPlatform.INSTAGRAM: {
        "reach_range":     (3_500, 90_000),
        "like_rate":       (0.04, 0.11),
        "comment_rate":    (0.002, 0.015),
        "share_rate":      (0.001, 0.006),
        "save_rate":       (0.004, 0.020),
        "click_rate":      (0.002, 0.010),
        "profile_rate":    (0.002, 0.012),
    },
    SocialPlatform.TIKTOK: {
        "reach_range":     (8_000, 250_000),
        "like_rate":       (0.06, 0.14),
        "comment_rate":    (0.003, 0.020),
        "share_rate":      (0.002, 0.012),
        "save_rate":       (0.002, 0.012),
        "click_rate":      (0.001, 0.006),
        "profile_rate":    (0.003, 0.015),
    },
    SocialPlatform.YOUTUBE: {
        "reach_range":     (1_500, 60_000),
        "like_rate":       (0.03, 0.08),
        "comment_rate":    (0.001, 0.006),
        "share_rate":      (0.0005, 0.003),
        "save_rate":       (0.0005, 0.002),
        "click_rate":      (0.002, 0.008),
        "profile_rate":    (0.001, 0.004),
    },
}

FOLLOWER_BASE: dict[str, int] = {
    SocialPlatform.FACEBOOK:  12_400,
    SocialPlatform.INSTAGRAM: 21_800,
    SocialPlatform.TIKTOK:     8_900,
    SocialPlatform.YOUTUBE:    5_200,
}

FOLLOWER_MONTHLY_GROWTH: dict[str, tuple[int, int]] = {
    SocialPlatform.FACEBOOK:  (300, 1_200),
    SocialPlatform.INSTAGRAM: (500, 2_100),
    SocialPlatform.TIKTOK:    (700, 3_500),
    SocialPlatform.YOUTUBE:   (150,   900),
}

DEMOGRAPHIC_AGES = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"]
DEMOGRAPHIC_GENDERS = ["female", "male"]
DEMOGRAPHIC_CITIES = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"]
DEMOGRAPHIC_COUNTRIES = [
    {"code": "KE", "name": "Kenya"},
    {"code": "UG", "name": "Uganda"},
    {"code": "TZ", "name": "Tanzania"},
    {"code": "RW", "name": "Rwanda"},
]

INBOX_AUTHORS = [
    ("Alice Wanjiru", "@alice_w"),
    ("Brian Otieno", "@b_otieno"),
    ("Cynthia Mwangi", "@cynthia.m"),
    ("David Kimani", "@dkimani"),
    ("Esther Njoroge", "@esther_n"),
    ("Felix Ochieng", "@felix.ochieng"),
    ("Grace Wambui", "@grace.w"),
    ("Hassan Ali", "@hassan_ali"),
]

COMMENT_BODIES = [
    "Love this! Just ordered one 🔥",
    "How much does the Pro plan cost per month?",
    "The Wi-Fi router completely changed my home setup. Thanks!",
    "Do you ship to Kisumu?",
    "This is exactly what my shop needed 👏",
    "Terrible experience — my order hasn't arrived after 2 weeks 😡",
    "Can I get a demo before buying?",
    "Tagging my co-founder — she needs to see this.",
    "Best keyboard I've ever used, no exaggeration.",
    "Refund request sent 3 days ago, still no response.",
]

DM_BODIES = [
    "Hi, I want to upgrade my plan. Which tier should I pick?",
    "Quick question about bulk pricing for 500+ SKUs.",
    "When does the multi-currency checkout launch?",
    "Can you help me reconnect my TikTok account?",
    "Loving the new dashboard — huge improvement!",
    "My M-Pesa receipts aren't syncing today, can you check?",
]

MENTION_BODIES = [
    "Just discovered @sokoflow and I'm blown away — check it out!",
    "Anyone using @sokoflow for their e-commerce store? Worth it?",
    "@sokoflow just made my week with that update.",
]

TEMPLATE_CATEGORIES = ["Promo", "Product launch", "Tips", "Testimonial", "Event", "Recurring"]

TEMPLATE_NAMES = [
    ("Monday Motivational", "Tips"),
    ("New Product Launch", "Product launch"),
    ("Flash Sale Announcement", "Promo"),
    ("Customer Testimonial Template", "Testimonial"),
    ("Weekly Webinar Invite", "Event"),
    ("Behind the Scenes Story", "Recurring"),
    ("Feature Friday", "Recurring"),
    ("Weekend Discount Blast", "Promo"),
]

EVERGREEN_CAPTIONS = [
    "Did you know SokoFlow integrates with every major M-Pesa provider?",
    "Pro tip: batch-tag your SKUs to save hours every week.",
    "Our mobile app is faster than ever. Update now.",
    "Reminder: our support team is online 24/7 for Pro merchants.",
    "Start your free trial today — no credit card needed.",
]

AUDIT_ACTIONS = [
    ("post.create", "SocialPost"),
    ("post.publish", "SocialPost"),
    ("post.delete", "SocialPost"),
    ("account.connect", "SocialAccount"),
    ("account.disconnect", "SocialAccount"),
    ("draft.approve", "SocialDraft"),
    ("draft.reject", "SocialDraft"),
    ("inbox.reply", "SocialInboxItem"),
    ("template.create", "SocialTemplate"),
    ("link.create", "SocialLink"),
    ("team.invite", "SocialTeamMember"),
    ("report.generate", "SocialReport"),
]


class Command(BaseCommand):
    help = "Seed the social app with realistic fake data."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")
        parser.add_argument("--posts", type=int, default=48)
        parser.add_argument("--scheduled", type=int, default=None)
        parser.add_argument("--months", type=int, default=6)
        parser.add_argument("--drafts", type=int, default=12)
        parser.add_argument("--inbox", type=int, default=40)
        parser.add_argument("--templates", type=int, default=8)
        parser.add_argument("--notifications", type=int, default=15)
        parser.add_argument("--reports", type=int, default=4)
        parser.add_argument("--seed", type=int, default=None)

    def handle(self, *args, **options):
        if options["seed"] is not None:
            random.seed(options["seed"])

        if options["reset"]:
            self._reset()

        total_posts = max(1, options["posts"])
        scheduled_count = options["scheduled"]
        if scheduled_count is None:
            scheduled_count = max(1, total_posts // 4)
        scheduled_count = min(scheduled_count, total_posts - 1)
        published_count = total_posts - scheduled_count

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding social app…"))

        with transaction.atomic():
            accounts = self._seed_accounts()
            team = self._seed_team()
            folders = self._seed_media_folders()
            self._seed_queue_slots()
            self._seed_evergreen()
            self._seed_scheduled(accounts, scheduled_count)
            self._seed_published(accounts, published_count, folders)
            self._seed_drafts(team, options["drafts"])
            self._seed_inbox(accounts, options["inbox"])
            self._seed_templates(team, options["templates"])
            self._seed_links(team)
            self._seed_reports(team, options["reports"])
            self._seed_followers(accounts, options["months"])
            self._seed_engagement(accounts)
            self._seed_demographics(accounts)
            self._seed_best_times(accounts)
            self._seed_notifications(team, options["notifications"])
            self._seed_audit(team)

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Done. {scheduled_count} scheduled + {published_count} published posts, "
            f"{options['drafts']} drafts, {options['inbox']} inbox items, "
            f"{options['months']} months of follower history, "
            f"{len(accounts)} accounts."
        ))

    def _reset(self):
        self.stdout.write(self.style.WARNING("Resetting existing social data…"))
        SocialInboxReply.objects.all().delete()
        SocialInboxItem.objects.all().delete()
        SocialDraftComment.objects.all().delete()
        SocialDraft.objects.all().delete()
        SocialPostTarget.objects.all().delete()
        SocialPost.objects.all().delete()
        SocialMedia.objects.all().delete()
        SocialMediaFolder.objects.all().delete()
        SocialFollowerSnapshot.objects.all().delete()
        SocialEngagementSnapshot.objects.all().delete()
        SocialDemographicSnapshot.objects.all().delete()
        SocialBestTimePost.objects.all().delete()
        SocialQueueSlot.objects.all().delete()
        SocialEvergreenPost.objects.all().delete()
        SocialTemplate.objects.all().delete()
        SocialLink.objects.all().delete()
        SocialNotification.objects.all().delete()
        SocialReport.objects.all().delete()
        SocialAuditLog.objects.all().delete()
        SocialAccount.objects.all().delete()

    def _seed_accounts(self) -> list[SocialAccount]:
        now = timezone.now()
        accounts: list[SocialAccount] = []

        for platform in PLATFORMS:
            meta = ACCOUNT_META[platform]
            account, created = SocialAccount.objects.update_or_create(
                platform=platform,
                defaults={
                    "display_name":     meta["display_name"],
                    "handle":           meta["handle"],
                    "is_connected":     meta["connected"],
                    "connected_at":     now if meta["connected"] else None,
                    "last_synced_at":   now if meta["connected"] else None,
                    "last_error":       "",
                    "access_token":     "seed-token" if meta["connected"] else "",
                    "refresh_token":    "seed-refresh" if meta["connected"] else "",
                    "token_expires_at": (now + timedelta(days=55)) if meta["connected"] else None,
                    "followers":        meta["followers"],
                    "scopes":           meta["scopes"],
                    "metadata":         self._account_metadata(platform),
                },
            )
            accounts.append(account)
            flag = "created" if created else "updated"
            status = "connected" if meta["connected"] else "disconnected"
            self.stdout.write(f"  → {account.get_platform_display():<10} {flag} ({status})")

        return accounts

    def _account_metadata(self, platform: str) -> dict:
        if platform == SocialPlatform.FACEBOOK:
            return {"page_id": "102938475610293"}
        if platform == SocialPlatform.INSTAGRAM:
            return {"page_id": "102938475610293", "ig_user_id": "17841400000000000"}
        if platform == SocialPlatform.TIKTOK:
            return {"open_id": "seed-open-id"}
        if platform == SocialPlatform.YOUTUBE:
            return {"channel_id": "UCseed0000000000000000", "category_id": "22"}
        return {}

    def _seed_team(self):
        User = get_user_model()
        members = []

        specs = [
            ("owner@sokoflow.test",    "Amara",  "Ochieng", TeamRole.OWNER,    True),
            ("admin@sokoflow.test",    "Peter",  "Mwangi",  TeamRole.ADMIN,    True),
            ("editor@sokoflow.test",   "Faith",  "Njeri",   TeamRole.EDITOR,   True),
            ("approver@sokoflow.test", "David",  "Kamau",   TeamRole.APPROVER, True),
            ("viewer@sokoflow.test",   "Sarah",  "Achieng", TeamRole.VIEWER,   True),
        ]

        for email, first, last, role, is_active in specs:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first,
                    "last_name":  last,
                    "is_staff":   True,
                    "is_active":  True,
                },
            )
            if created:
                user.set_unusable_password()
                user.save(update_fields=["password"])

            member, _ = SocialTeamMember.objects.update_or_create(
                user=user,
                defaults={
                    "role":       role,
                    "is_active":  is_active,
                    "invited_at": timezone.now(),
                    "joined_at":  timezone.now(),
                },
            )
            members.append(member)

        self.stdout.write(f"  → {len(members)} team members seeded")
        return members

    def _seed_media_folders(self) -> list[SocialMediaFolder]:
        names = ["Product Photos", "Reels & Shorts", "Promo Banners", "Customer Stories", "Raw Footage"]
        folders = []
        for name in names:
            folder, _ = SocialMediaFolder.objects.update_or_create(
                slug=slugify(name) or name.lower(),
                defaults={"name": name},
            )
            folders.append(folder)
        self.stdout.write(f"  → {len(folders)} media folders seeded")
        return folders

    def _seed_queue_slots(self):
        specs = [
            ("Morning Kick-off",  QueueSlotKind.STANDARD,  ["mon", "tue", "wed", "thu", "fri"], time(8, 30)),
            ("Lunch Pulse",       QueueSlotKind.STANDARD,  ["mon", "wed", "fri"],                time(12, 30)),
            ("Evening Peak",      QueueSlotKind.STANDARD,  ["tue", "thu", "sat"],                time(19, 0)),
            ("Evergreen Refill",  QueueSlotKind.EVERGREEN, ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], time(10, 0)),
        ]
        created = 0
        for name, kind, days, tod in specs:
            SocialQueueSlot.objects.update_or_create(
                name=name,
                defaults={
                    "kind":        kind,
                    "days":        days,
                    "time_of_day": tod,
                    "platforms":   ["FACEBOOK", "INSTAGRAM", "TIKTOK"],
                    "is_active":   True,
                },
            )
            created += 1
        self.stdout.write(f"  → {created} queue slots seeded")

    def _seed_evergreen(self):
        created = 0
        for caption in EVERGREEN_CAPTIONS:
            SocialEvergreenPost.objects.create(
                caption=caption,
                platforms=random.sample(["FACEBOOK", "INSTAGRAM", "TIKTOK"], k=random.randint(1, 3)),
                product_tag=random.choice(PRODUCT_TAGS) or "",
                is_active=True,
            )
            created += 1
        self.stdout.write(f"  → {created} evergreen posts seeded")

    def _seed_scheduled(self, accounts: list[SocialAccount], count: int):
        now = timezone.now()
        created = 0
        for i in range(count):
            hours = (i + 1) * 4 + random.randint(0, 3)
            when = now + timedelta(hours=hours)

            post = SocialPost.objects.create(
                status=PostStatus.SCHEDULED,
                caption=random.choice(CAPTIONS),
                first_comment=random.choice(FIRST_COMMENTS) if random.random() < 0.3 else "",
                product_tag=random.choice(PRODUCT_TAGS) or "",
                campaign=random.choice(CAMPAIGNS),
                link_url="https://sokoflow.example.com/product" if random.random() < 0.4 else "",
                link_utm={"source": "social", "medium": "post"} if random.random() < 0.4 else {},
                scheduled_for=when,
            )
            self._attach_targets(post, accounts, min_targets=1, max_targets=3)
            self._attach_media(post, allow_video=random.random() < 0.5)
            created += 1

        self.stdout.write(f"  → {created} scheduled posts created")

    def _seed_published(self, accounts: list[SocialAccount], count: int, folders: list[SocialMediaFolder]):
        now = timezone.now()
        created = 0
        folder_pool = folders or [None]

        for _ in range(count):
            days_ago = random.randint(0, 20)
            hours_ago = random.randint(0, 23)
            published_at = now - timedelta(days=days_ago, hours=hours_ago)

            post = SocialPost.objects.create(
                status=PostStatus.PUBLISHED,
                caption=random.choice(CAPTIONS),
                first_comment=random.choice(FIRST_COMMENTS) if random.random() < 0.25 else "",
                product_tag=random.choice(PRODUCT_TAGS) or "",
                campaign=random.choice(CAMPAIGNS),
                scheduled_for=published_at - timedelta(hours=6),
                published_at=published_at,
            )

            eligible = [a for a in accounts if a.is_connected] or accounts
            platform_account = random.choice(eligible)

            target = SocialPostTarget.objects.create(
                post=post,
                platform=platform_account.platform,
                status=TargetStatus.PUBLISHED,
                published_at=published_at,
                metrics_synced_at=now,
                platform_post_id=f"seed_{post.pk}_{platform_account.platform.lower()}",
                platform_url=f"https://example.com/p/{post.pk}",
            )
            self._apply_metrics(target)
            self._attach_media(
                post,
                allow_video=(
                    platform_account.platform in (SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE)
                    or random.random() < 0.3
                ),
                folder=random.choice(folder_pool),
            )
            created += 1

        self.stdout.write(f"  → {created} published posts created")

    def _seed_drafts(self, team: list, count: int):
        if not team:
            return

        statuses = [
            DraftStatus.DRAFT,
            DraftStatus.DRAFT,
            DraftStatus.PENDING,
            DraftStatus.PENDING,
            DraftStatus.APPROVED,
            DraftStatus.REJECTED,
        ]

        created = 0
        for i in range(count):
            author = random.choice(team).user
            reviewer = random.choice(team).user if random.random() < 0.5 else None
            status = random.choice(statuses)

            draft = SocialDraft.objects.create(
                title=f"Draft #{i + 1} — {random.choice(['Product spotlight', 'Feature Friday', 'Weekly tips', 'Customer story'])}",
                caption=random.choice(CAPTIONS),
                platforms=random.sample(["Facebook", "Instagram", "TikTok"], k=random.randint(1, 3)),
                fields={
                    "product_tag": random.choice(PRODUCT_TAGS) or "",
                    "first_comment": random.choice(FIRST_COMMENTS),
                },
                status=status,
                author=author,
                reviewer=reviewer,
            )

            for _ in range(random.randint(0, 3)):
                SocialDraftComment.objects.create(
                    draft=draft,
                    author=random.choice(team).user,
                    body=random.choice([
                        "Looks good, let's ship it.",
                        "Can we swap the hero image?",
                        "Caption is a bit long for IG.",
                        "Love the angle on this one.",
                        "Approved — schedule for Friday.",
                    ]),
                    decision=random.choice([
                        "", "", "",
                        ApprovalDecision.APPROVED,
                        ApprovalDecision.CHANGES,
                    ]),
                )
            created += 1

        self.stdout.write(f"  → {created} drafts seeded")

    def _seed_inbox(self, accounts: list[SocialAccount], count: int):
        connected = [a for a in accounts if a.is_connected]
        if not connected:
            return

        created = 0
        now = timezone.now()

        for _ in range(count):
            account = random.choice(connected)
            item_type = random.choice([
                InboxItemType.COMMENT,
                InboxItemType.COMMENT,
                InboxItemType.COMMENT,
                InboxItemType.DM,
                InboxItemType.MENTION,
            ])

            author_name, author_handle = random.choice(INBOX_AUTHORS)
            if item_type == InboxItemType.COMMENT:
                body = random.choice(COMMENT_BODIES)
            elif item_type == InboxItemType.DM:
                body = random.choice(DM_BODIES)
            else:
                body = random.choice(MENTION_BODIES)

            sentiment = Sentiment.NEUTRAL
            low = body.lower()
            if any(t in low for t in ("love", "thanks", "best", "🔥", "👏", "blown away")):
                sentiment = Sentiment.POSITIVE
            elif any(t in low for t in ("terrible", "refund", "😡", "still no")):
                sentiment = Sentiment.NEGATIVE

            received_at = now - timedelta(
                hours=random.randint(0, 72),
                minutes=random.randint(0, 59),
            )

            item = SocialInboxItem.objects.create(
                item_type=item_type,
                status=random.choice([
                    InboxItemStatus.OPEN,
                    InboxItemStatus.OPEN,
                    InboxItemStatus.OPEN,
                    InboxItemStatus.RESOLVED,
                    InboxItemStatus.SNOOZED,
                ]),
                sentiment=sentiment,
                platform=account.platform,
                account=account,
                platform_item_id=f"seed_{item_type.lower()}_{created + 1}",
                author_name=author_name,
                author_handle=author_handle,
                body=body,
                permalink=f"https://example.com/{account.platform.lower()}/{created + 1}",
                received_at=received_at,
            )

            if random.random() < 0.4:
                SocialInboxReply.objects.create(
                    item=item,
                    author=random.choice([None] + [t.user for t in SocialTeamMember.objects.all()[:3]]),
                    body=random.choice([
                        "Thanks for reaching out! We'll DM you shortly.",
                        "Appreciate the kind words 🙏",
                        "Sorry to hear that — our team will follow up today.",
                        "Please share your order number and we'll look into it.",
                    ]),
                    is_outbound=True,
                )

            created += 1

        self.stdout.write(f"  → {created} inbox items seeded")

    def _seed_templates(self, team: list, count: int):
        pool = TEMPLATE_NAMES[:count] if count <= len(TEMPLATE_NAMES) else TEMPLATE_NAMES
        created = 0
        for name, category in pool:
            SocialTemplate.objects.create(
                name=name,
                category=category,
                caption=random.choice(CAPTIONS),
                platforms=random.sample(["Facebook", "Instagram", "TikTok"], k=random.randint(1, 3)),
                fields={
                    "product_tag": random.choice(PRODUCT_TAGS) or "",
                    "first_comment": random.choice(FIRST_COMMENTS),
                },
                is_shared=True,
                created_by=random.choice(team).user if team else None,
            )
            created += 1

        self.stdout.write(f"  → {created} templates seeded")

    def _seed_links(self, team: list):
        specs = [
            ("sokoflow-promo",    "https://sokoflow.example.com/promo"),
            ("sokoflow-launch",   "https://sokoflow.example.com/launch"),
            ("sokoflow-webinar",  "https://sokoflow.example.com/webinar"),
            ("sokoflow-trial",    "https://sokoflow.example.com/trial"),
            ("sokoflow-blog",     "https://sokoflow.example.com/blog"),
        ]
        created = 0
        for code, dest in specs:
            SocialLink.objects.update_or_create(
                short_code=code,
                defaults={
                    "destination": dest,
                    "utm": {"source": "social", "medium": "post", "campaign": code},
                    "clicks": random.randint(50, 5_000),
                    "created_by": random.choice(team).user if team else None,
                },
            )
            created += 1
        self.stdout.write(f"  → {created} links seeded")

    def _seed_reports(self, team: list, count: int):
        created = 0
        today = date.today()
        for i in range(count):
            months_ago = i + 1
            first = today.replace(day=1) - timedelta(days=30 * months_ago)
            last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

            SocialReport.objects.create(
                name=f"Monthly performance — {first.strftime('%b %Y')}",
                date_from=first,
                date_to=last,
                platforms=["Facebook", "Instagram", "TikTok", "YouTube"],
                metrics=["reach", "engagement_rate", "link_clicks", "posts"],
                branding={"primary_color": "#172554", "logo": ""},
                format=random.choice([ReportFormat.PDF, ReportFormat.CSV, ReportFormat.PNG]),
                created_by=random.choice(team).user if team else None,
                generated_at=timezone.now() - timedelta(days=random.randint(1, 20)),
            )
            created += 1

        self.stdout.write(f"  → {created} reports seeded")

    def _seed_followers(self, accounts: list[SocialAccount], months: int):
        today = date.today()
        first_day = (today.replace(day=1) - timedelta(days=31 * months - 1)).replace(day=1)
        written = 0

        for account in accounts:
            if not account.is_connected:
                continue
            base = FOLLOWER_BASE.get(account.platform, 10_000)
            lo, hi = FOLLOWER_MONTHLY_GROWTH.get(account.platform, (200, 800))

            count = base
            cursor = first_day
            while cursor <= today:
                if cursor.day == 1:
                    count += random.randint(lo, hi)
                SocialFollowerSnapshot.objects.update_or_create(
                    account=account,
                    date=cursor,
                    defaults={
                        "platform":  account.platform,
                        "followers": count,
                    },
                )
                written += 1
                cursor += timedelta(days=30)

        self.stdout.write(f"  → {written} follower snapshots written")

    def _seed_engagement(self, accounts: list[SocialAccount]):
        written = 0
        for account in accounts:
            if not account.is_connected:
                continue

            targets = SocialPostTarget.objects.filter(
                platform=account.platform,
                status=TargetStatus.PUBLISHED,
            )
            reach = sum(t.reach for t in targets) or random.randint(20_000, 200_000)
            engagement = sum(t.total_engagement for t in targets) or int(reach * 0.06)

            SocialEngagementSnapshot.objects.update_or_create(
                platform=account.platform,
                defaults={"reach": reach, "engagement": engagement},
            )
            written += 1

        self.stdout.write(f"  → {written} engagement rollups written")

    def _seed_demographics(self, accounts: list[SocialAccount]):
        today = date.today()
        written = 0
        for account in accounts:
            if not account.is_connected:
                continue

            age_buckets = {age: random.randint(3, 30) for age in DEMOGRAPHIC_AGES}
            total = sum(age_buckets.values()) or 1
            age_buckets = {k: round(v / total * 100, 2) for k, v in age_buckets.items()}

            gender_raw = {g: random.randint(30, 70) for g in DEMOGRAPHIC_GENDERS}
            gtotal = sum(gender_raw.values()) or 1
            gender = {k: round(v / gtotal * 100, 2) for k, v in gender_raw.items()}

            top_cities = [
                {"name": city, "count": random.randint(500, 5_000)}
                for city in random.sample(DEMOGRAPHIC_CITIES, k=3)
            ]
            top_countries = [
                {"code": c["code"], "name": c["name"], "count": random.randint(2_000, 20_000)}
                for c in DEMOGRAPHIC_COUNTRIES
            ]

            SocialDemographicSnapshot.objects.update_or_create(
                platform=account.platform,
                date=today,
                defaults={
                    "age_buckets":   age_buckets,
                    "gender":        gender,
                    "top_cities":    top_cities,
                    "top_countries": top_countries,
                },
            )
            written += 1

        self.stdout.write(f"  → {written} demographic snapshots written")

    def _seed_best_times(self, accounts: list[SocialAccount]):
        written = 0
        for account in accounts:
            if not account.is_connected:
                continue
            for day in range(7):
                for hour in (7, 8, 12, 13, 18, 19, 20, 21):
                    SocialBestTimePost.objects.update_or_create(
                        platform=account.platform,
                        day_of_week=day,
                        hour=hour,
                        defaults={
                            "score":       round(random.uniform(0.4, 1.0), 3),
                            "sample_size": random.randint(20, 300),
                        },
                    )
                    written += 1

        self.stdout.write(f"  → {written} best-time rows written")

    def _seed_notifications(self, team: list, count: int):
        recipients = [t.user for t in team] if team else [None]
        created = 0

        notification_pool = [
            (NotificationType.POST_PUBLISHED,  "Post published",          "Post #12 published to Facebook, Instagram."),
            (NotificationType.POST_FAILED,     "TikTok publish failed",   "Rate limit exceeded. Retry in 5 minutes."),
            (NotificationType.TOKEN_EXPIRING,  "Facebook token expiring", "Facebook token expires in 2 days."),
            (NotificationType.TOKEN_EXPIRED,   "YouTube token expired",   "Reconnect the YouTube account."),
            (NotificationType.APPROVAL_NEEDED, "Approval needed",         "A draft is waiting for your review."),
            (NotificationType.APPROVAL_GIVEN,  "Draft approved",          "Your draft was approved by Peter."),
            (NotificationType.NEW_COMMENT,     "New comment on Instagram","\"Love this! Just ordered one\""),
            (NotificationType.NEW_DM,          "New message on Facebook", "\"Can you help me upgrade?\""),
            (NotificationType.NEW_MENTION,     "New mention on TikTok",   "You were mentioned in a post."),
            (NotificationType.REPORT_READY,    "Report ready",            "Monthly performance is ready to download."),
        ]

        for i in range(count):
            kind, title, message = random.choice(notification_pool)
            SocialNotification.objects.create(
                notification_type=kind,
                title=title,
                message=message,
                link=f"/social/notifications/{i + 1}",
                is_read=random.random() < 0.6,
                recipient=random.choice(recipients),
            )
            created += 1

        self.stdout.write(f"  → {created} notifications seeded")

    def _seed_audit(self, team: list):
        actors = [t.user for t in team] if team else [None]
        created = 0
        now = timezone.now()

        for i in range(30):
            action, target_type = random.choice(AUDIT_ACTIONS)
            SocialAuditLog.objects.create(
                actor=random.choice(actors),
                action=action,
                target_type=target_type,
                target_id=str(random.randint(1, 100)),
                details={"note": "seeded"},
                created_at=now - timedelta(hours=random.randint(1, 240)),
            )
            created += 1

        self.stdout.write(f"  → {created} audit entries seeded")

    def _attach_targets(
        self,
        post: SocialPost,
        accounts: list[SocialAccount],
        *,
        min_targets: int = 1,
        max_targets: int = 3,
    ) -> None:
        eligible = [a for a in accounts if a.is_connected] or accounts
        n = random.randint(min_targets, min(max_targets, len(eligible)))
        chosen = random.sample(eligible, k=n)

        for account in chosen:
            SocialPostTarget.objects.create(
                post=post,
                platform=account.platform,
                status=TargetStatus.PENDING,
            )

    def _attach_media(
        self,
        post: SocialPost,
        *,
        allow_video: bool,
        folder: SocialMediaFolder | None = None,
    ) -> None:
        if random.random() < 0.35:
            return

        n = random.randint(1, 3)
        for i in range(n):
            is_video = allow_video and i == 0 and random.random() < 0.5
            filename = f"seed/{post.pk}-{i}.{'mp4' if is_video else 'jpg'}"

            width, height = (
                (1080, 1920) if is_video else random.choice([(1080, 1080), (1080, 1350), (1920, 1080)])
            )

            SocialMedia.objects.create(
                post=post,
                folder=folder,
                file=filename,
                media_type=MediaType.VIDEO if is_video else MediaType.IMAGE,
                title=f"Seed asset {post.pk}-{i}",
                filename=filename.rsplit("/", 1)[-1],
                tags=random.sample(["product", "lifestyle", "promo", "ugc", "bts"], k=random.randint(0, 3)),
                size_bytes=random.randint(200_000, 8_000_000),
                width=width,
                height=height,
                duration_seconds=round(random.uniform(8, 90), 1) if is_video else 0,
                sort_order=i,
            )

    def _apply_metrics(self, target: SocialPostTarget) -> None:
        profile = METRIC_PROFILES.get(target.platform)
        if profile is None:
            return

        lo, hi = profile["reach_range"]
        reach = random.randint(lo, hi)
        impressions = int(reach * random.uniform(1.05, 1.4))
        likes = int(reach * random.uniform(*profile["like_rate"]))
        comments = int(reach * random.uniform(*profile["comment_rate"]))
        shares = int(reach * random.uniform(*profile["share_rate"]))
        saves = int(reach * random.uniform(*profile["save_rate"]))
        link_clicks = int(reach * random.uniform(*profile["click_rate"]))
        profile_visits = int(reach * random.uniform(*profile["profile_rate"]))
        follower_delta = random.randint(-5, max(5, reach // 500))

        video_views = 0
        watch_time_sec = 0
        if target.platform in (SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE):
            video_views = int(reach * random.uniform(0.6, 0.95))
            watch_time_sec = video_views * random.randint(3, 20)

        target.reach = reach
        target.impressions = impressions
        target.likes = likes
        target.comments = comments
        target.shares = shares
        target.saves = saves
        target.video_views = video_views
        target.watch_time_sec = watch_time_sec
        target.link_clicks = link_clicks
        target.profile_visits = profile_visits
        target.follower_delta = follower_delta
        target.save(update_fields=[
            "reach", "impressions", "likes", "comments", "shares",
            "saves", "video_views", "watch_time_sec",
            "link_clicks", "profile_visits", "follower_delta",
        ])