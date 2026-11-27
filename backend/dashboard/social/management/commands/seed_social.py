import random
from datetime import timedelta, date, datetime, time
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = "Seed fake social data for frontend display - idempotent"

    def handle(self, *args, **options):
        from dashboard.social.models import (
            SocialPlatform, AccountConnectionStatus, AccountSyncStatus,
            SocialAccount, SocialCampaign, SocialContentCategory, SocialContent,
            SocialContentProduct, SocialCampaignProduct, SocialCampaignContent,
            SocialScheduledPost, SocialPlatformDailyMetric, SocialFollowerSnapshot,
            SocialEngagementSnapshot, SocialInboxConversation, SocialInboxMessage,
            SocialMediaFolder, SocialMedia, SocialLink, SocialNotification,
            SocialQueueSlot, SocialEvergreenPost, SocialActivityLog,
            SocialDemographicSnapshot, SocialBestTimePost, SocialCampaignAlert,
            SocialAttributionEvent, SocialContentMedia, ContentType, ContentStatus,
            CampaignStatus, CampaignType, CampaignObjective, PublishStatus,
            InteractionType, ConversationStatus, MediaKind,
            AlertSeverity, CampaignAlertType
        )
        from catalog.models import Product

        now = timezone.now()
        today = timezone.localdate(now)
        user = User.objects.filter(is_staff=True).first() or User.objects.first()

        self.stdout.write("=== SEEDING SOCIAL FAKE DATA ===")

        # Clear existing
        if SocialAccount.objects.count() > 0:
            self.stdout.write(f"Existing accounts: {SocialAccount.objects.count()} - clearing")
            SocialInboxMessage.objects.all().delete()
            SocialInboxConversation.objects.all().delete()
            SocialScheduledPost.objects.all().delete()
            SocialContentProduct.objects.all().delete()
            SocialContentMedia.objects.all().delete()
            SocialCampaignContent.objects.all().delete()
            SocialCampaignProduct.objects.all().delete()
            SocialContent.objects.all().delete()
            SocialCampaignAlert.objects.all().delete()
            SocialCampaign.objects.all().delete()
            SocialPlatformDailyMetric.objects.all().delete()
            SocialFollowerSnapshot.objects.all().delete()
            SocialEngagementSnapshot.objects.all().delete()
            SocialMedia.objects.all().delete()
            SocialMediaFolder.objects.all().delete()
            SocialLink.objects.all().delete()
            SocialNotification.objects.all().delete()
            SocialQueueSlot.objects.all().delete()
            SocialEvergreenPost.objects.all().delete()
            SocialActivityLog.objects.all().delete()
            SocialDemographicSnapshot.objects.all().delete()
            SocialBestTimePost.objects.all().delete()
            SocialAttributionEvent.objects.all().delete()
            SocialContentCategory.objects.all().delete()
            SocialAccount.objects.all().delete()

        # 1. ACCOUNTS
        accounts_data = [
            {"platform": SocialPlatform.INSTAGRAM.value, "display_name": "SokoFlow Official", "username": "sokoflow_ke", "followers": 45200, "account_type": "business", "account_id": "17841400000000001"},
            {"platform": SocialPlatform.FACEBOOK.value, "display_name": "SokoFlow Electronics", "username": "SokoFlowElectronics", "followers": 12800, "account_type": "page", "account_id": "10230000000000001"},
            {"platform": SocialPlatform.TIKTOK.value, "display_name": "SokoFlow KE", "username": "@sokoflow_ke", "followers": 89300, "account_type": "business", "account_id": "70000000000000001"},
            {"platform": SocialPlatform.YOUTUBE.value, "display_name": "SokoFlow Reviews", "username": "@SokoFlowReviews", "followers": 12400, "account_type": "channel", "account_id": "UC00000000000000000001"},
        ]
        accounts = []
        for idx, data in enumerate(accounts_data):
            acc = SocialAccount.objects.create(
                platform=data["platform"], status=AccountConnectionStatus.CONNECTED,
                display_name=data["display_name"], username=data["username"],
                profile_image_url=f"https://picsum.photos/seed/{data['platform']}/200/200",
                account_type=data["account_type"], account_id=data["account_id"], followers=data["followers"],
                sync_status=AccountSyncStatus.OK, is_default_publishing=(idx == 0), enabled_for_distribution=True,
                supports_dm=True, supports_comments=True, supports_mentions=True, supports_reply=True,
                publishing_formats=["image", "video", "reel", "story"],
                connected_at=now - timedelta(days=random.randint(30, 90)), last_synced_at=now - timedelta(minutes=random.randint(5, 60)),
                coverage_start=today - timedelta(days=90), coverage_end=today, label=f"Main {data['platform']}",
            )
            accounts.append(acc)

        # 2. CATEGORIES
        categories = []
        for name, slug in [("Product Showcase", "product-showcase"), ("Promotions", "promotions"), ("Tutorials", "tutorials"), ("Behind the Scenes", "bts")]:
            cat, _ = SocialContentCategory.objects.get_or_create(name=name, slug=slug)
            categories.append(cat)

        # 3. MEDIA - use SHORT urls (picsum, not presigned B2)
        folder_products, _ = SocialMediaFolder.objects.get_or_create(name="Product Images", slug="product-images")
        products = list(Product.objects.all())
        medias = []
        for prod in products[:11]:
            # Use short picsum URL - B2 presigned URLs are >200 chars and break URLField(200)
            short_url = f"https://picsum.photos/seed/{prod.sku.lower()}/600/600"
            m = SocialMedia.objects.create(
                folder=folder_products, kind=MediaKind.IMAGE, name=f"{prod.name[:80]}",
                url=short_url, thumbnail_url=f"https://picsum.photos/seed/{prod.sku.lower()}/300/300",
                tags=["product", prod.sku.lower()], width=600, height=600,
                mime_type="image/jpeg", size_bytes=random.randint(200000, 800000), source="library",
            )
            medias.append(m)

        # 4. CAMPAIGNS
        campaigns = []
        for cd in [
            {"name": "iPhone 17 Pro Max Launch", "type": CampaignType.PRODUCT_LAUNCH, "objective": CampaignObjective.SALES, "status": CampaignStatus.ACTIVE, "platforms": ["instagram", "facebook", "tiktok"], "desc": "Launch campaign for new iPhone 17 Pro Max"},
            {"name": "Back to School Tech Deals", "type": CampaignType.SEASONAL, "objective": CampaignObjective.CONVERSIONS, "status": CampaignStatus.ACTIVE, "platforms": ["instagram", "facebook", "tiktok", "youtube"], "desc": "Laptops and accessories for students"},
            {"name": "Black Friday Countdown", "type": CampaignType.DISCOUNT, "objective": CampaignObjective.TRAFFIC, "status": CampaignStatus.SCHEDULED, "platforms": ["instagram", "facebook"], "desc": "Teasing Black Friday deals"},
        ]:
            camp = SocialCampaign.objects.create(
                name=cd["name"], description=cd["desc"], type=cd["type"], objective=cd["objective"], status=cd["status"],
                start_date=today - timedelta(days=random.randint(0, 10)), end_date=today + timedelta(days=random.randint(15, 45)),
                platforms=cd["platforms"], owner=user,
                planned_budget=Decimal(random.randint(50000, 200000)), actual_spend=Decimal(random.randint(10000, 50000)),
                attributed_revenue=Decimal(random.randint(100000, 500000)), currency="KES", roas=round(random.uniform(2.5, 6.5), 2),
                reach=random.randint(50000, 200000), impressions=random.randint(100000, 500000), views=random.randint(50000, 300000),
                engagement=random.randint(5000, 20000), link_clicks=random.randint(1000, 8000), orders=random.randint(50, 300),
            )
            camp.accounts.set(random.sample(accounts, k=random.randint(2, 4)))
            campaigns.append(camp)

        # 5. CONTENTS
        contents = []
        for i, prod in enumerate(products[:8]):
            title = f"New Arrival: {prod.name[:40]}"
            caption = f"Just landed! {prod.name[:80]} now in stock. Limited units. Order via WhatsApp! Price {prod.price} KES"
            ct = SocialContent.objects.create(
                title=title, caption=caption, description=f"Content for {prod.sku}",
                content_type=random.choice([ContentType.IMAGE, ContentType.REEL, ContentType.VIDEO]),
                category=random.choice(categories), campaign=random.choice(campaigns) if campaigns else None,
                owner=user, platforms=random.sample(["instagram", "facebook", "tiktok"], k=random.randint(1, 3)),
                status=random.choice([ContentStatus.PUBLISHED, ContentStatus.APPROVED, ContentStatus.SCHEDULED]),
            )
            SocialContentProduct.objects.create(content=ct, product_id=prod.sku, sort_order=0)
            if medias:
                SocialContentMedia.objects.create(content=ct, media=medias[i % len(medias)], sort_order=0)
            contents.append(ct)

        for camp in campaigns:
            for prod in random.sample(products, k=min(3, len(products))):
                SocialCampaignProduct.objects.get_or_create(campaign=camp, product_id=prod.sku, defaults={"revenue": Decimal(random.randint(10000, 100000)), "orders": random.randint(5, 50), "units_sold": random.randint(5, 50)})
            for ct in random.sample(contents, k=min(2, len(contents))):
                SocialCampaignContent.objects.get_or_create(campaign=camp, content=ct, defaults={"reach": random.randint(5000, 20000), "impressions": random.randint(10000, 40000), "views": random.randint(5000, 25000), "engagement": random.randint(300, 2000), "clicks": random.randint(100, 800)})

        # 6. SCHEDULED POSTS
        for idx in range(15):
            ct = random.choice(contents) if contents else None
            acc = random.choice(accounts)
            if idx < 5:
                scheduled_at = now - timedelta(days=random.randint(1, 20), hours=random.randint(0, 23))
                status_val = PublishStatus.PUBLISHED
                published_at = scheduled_at + timedelta(minutes=5)
            elif idx < 10:
                scheduled_at = now + timedelta(days=random.randint(1, 10), hours=random.randint(0, 23))
                status_val = PublishStatus.SCHEDULED
                published_at = None
            else:
                scheduled_at = now + timedelta(days=random.randint(0, 3))
                status_val = random.choice([PublishStatus.DRAFT, PublishStatus.FAILED, PublishStatus.QUEUED])
                published_at = None
            SocialScheduledPost.objects.create(
                content=ct, content_title=ct.title if ct else f"Post {idx+1}", caption=ct.caption if ct else f"Scheduled post {idx+1}",
                content_type=ct.content_type if ct else ContentType.IMAGE, platform=acc.platform, account=acc,
                campaign=random.choice(campaigns) if campaigns and random.random() > 0.3 else None, owner=user,
                scheduled_at=scheduled_at, timezone="Africa/Nairobi", status=status_val, published_at=published_at,
                published_url=f"https://{acc.platform}.com/p/{random.randint(100000, 999999)}" if published_at else "",
                likes=random.randint(100, 5000) if published_at else None, comments=random.randint(10, 500) if published_at else None,
                shares=random.randint(5, 300) if published_at else None, reach=random.randint(1000, 20000) if published_at else None,
                impressions=random.randint(2000, 40000) if published_at else None, views=random.randint(1000, 30000) if published_at else None,
                link_clicks=random.randint(20, 500) if published_at else None, attributed_orders=random.randint(0, 20) if published_at else None,
                attributed_revenue=Decimal(random.randint(0, 50000)) if published_at else 0),
                failure_reason="Failed to publish: API rate limit" if status_val == PublishStatus.FAILED else "",
                thumbnail_url=f"https://picsum.photos/seed/post{idx}/400/400",
            )

        # 7. DAILY METRICS - 30 days
        for acc in accounts:
            for d in range(30):
                day = today - timedelta(days=d)
                SocialPlatformDailyMetric.objects.create(
                    account=acc, platform=acc.platform, date=day,
                    followers=(acc.followers or 10000) + random.randint(-500, 2000),
                    follower_growth=random.randint(-50, 300), reach=random.randint(1000, 15000),
                    impressions=random.randint(2000, 30000), views=random.randint(1000, 25000),
                    engagement=random.randint(100, 2000), engagement_rate=round(random.uniform(1.5, 8.5), 2),
                    link_clicks=random.randint(20, 800), profile_visits=random.randint(50, 1000), published_content=random.randint(0, 3),
                )
                SocialFollowerSnapshot.objects.create(account=acc, platform=acc.platform, date=day, followers=(acc.followers or 10000) + random.randint(-500, 1000))

        # 8. ENGAGEMENT
        for plat in [SocialPlatform.INSTAGRAM.value, SocialPlatform.FACEBOOK.value, SocialPlatform.TIKTOK.value, SocialPlatform.YOUTUBE.value]:
            SocialEngagementSnapshot.objects.create(platform=plat, reach=random.randint(10000, 80000), engagement=random.randint(1000, 10000))

        # 9. BEST TIME
        for plat in [SocialPlatform.INSTAGRAM.value, SocialPlatform.FACEBOOK.value, SocialPlatform.TIKTOK.value]:
            for day in range(7):
                for hour in [9, 12, 15, 18, 20]:
                    SocialBestTimePost.objects.create(platform=plat, day_of_week=day, hour=hour, score=round(random.uniform(0.3, 0.95), 2), sample_size=random.randint(20, 200))

        # 10. INBOX
        customer_names = ["Brian Otieno", "Aisha Mohammed", "John Kamau", "Grace Wanjiku", "David Mwangi", "Faith Chebet", "Kevin Ochieng", "Linda Njeri"]
        for i in range(8):
            acc = random.choice(accounts)
            conv = SocialInboxConversation.objects.create(
                platform=acc.platform, account=acc,
                type=random.choice([InteractionType.DM, InteractionType.COMMENT]), status=random.choice([ConversationStatus.UNREAD, ConversationStatus.READ, ConversationStatus.PENDING, ConversationStatus.RESOLVED]),
                customer_display_name=random.choice(customer_names), customer_username=f"user_{random.randint(1000, 9999)}",
                customer_avatar_url=f"https://picsum.photos/seed/c{i}/100/100",
                preview=random.choice(["Is this still available?", "How much delivery to Nakuru?", "Do you have warranty?", "I love this!"]),
                related_post_title=random.choice(contents).title if contents else "",
                last_interaction_at=now - timedelta(hours=random.randint(1, 72)), unread=(i < 3),
            )
            for j in range(random.randint(2, 5)):
                is_inbound = j % 2 == 0
                SocialInboxMessage.objects.create(
                    conversation=conv, direction="inbound" if is_inbound else "outbound",
                    body=random.choice(["Hi, is iPhone 17 available?", "Yes! 180k KES", "Deliver to Nyeri?", "Yes 300 KES", "Thanks order via WhatsApp"]),
                    author="customer" if is_inbound else "agent", author_name=conv.customer_display_name if is_inbound else "SokoFlow Support", can_reply=True,
                )

        # 11. QUEUE, LINKS, NOTIFICATIONS
        for name, days in [("Morning Rush", [1,2,3,4,5]), ("Evening Peak", [1,2,3,4,5,6,0])]:
            SocialQueueSlot.objects.create(name=name, days=days, time_of_day=time(hour=random.choice([9, 18])), timezone="Africa/Nairobi", platforms=["instagram", "facebook"], is_active=True)

        for i in range(5):
            SocialLink.objects.create(short_code=f"soko{i}", destination=f"https://sokoelectronshop.onrender.com/", utm=f"utm_source=instagram&utm_medium=social", clicks=random.randint(10, 500), created_by=user)

        for i in range(6):
            SocialNotification.objects.create(
                notification_type=random.choice(["publish_success", "publish_failed", "campaign_ending", "inbox_message"]),
                severity=random.choice([AlertSeverity.INFO, AlertSeverity.WARNING]), title=random.choice(["Post published", "Failed publish", "Campaign ending", "New message"]), message="Check details", link="/admin/social", is_read=(i > 2), recipient=user,
            )

        for plat in [SocialPlatform.INSTAGRAM.value, SocialPlatform.FACEBOOK.value]:
            SocialDemographicSnapshot.objects.create(platform=plat, date=today, age_buckets={"18-24": 35, "25-34": 40}, gender={"male": 60, "female": 38}, top_cities=["Nairobi", "Mombasa"], top_countries=["KE", "UG"])

        for ct in contents[:3]:
            SocialEvergreenPost.objects.create(content=ct, caption=ct.caption, platforms=ct.platforms, is_active=True, use_count=random.randint(0, 10))

        for act in ["published", "scheduled", "campaign", "message"]:
            SocialActivityLog.objects.create(kind=act, title=f"{act.capitalize()} - Test content", platform=random.choice(["instagram", "facebook", "tiktok"]), status=random.choice(["success", "pending"]), occurred_at=now - timedelta(hours=random.randint(1, 48)))

        for i in range(10):
            prod = random.choice(products) if products else None
            SocialAttributionEvent.objects.create(
                event_type="purchase", platform=random.choice([SocialPlatform.INSTAGRAM.value, SocialPlatform.FACEBOOK.value]), account=random.choice(accounts), 
                campaign=random.choice(campaigns) if campaigns else None, product_id=prod.sku if prod else f"PROD_{i}", order_id=f"ORD-{random.randint(10000, 99999)}", units=random.randint(1, 3), revenue=Decimal(random.randint(3000, 180000)), currency="KES", utm_source=random.choice(["instagram", "facebook"]), utm_medium="social", is_verified_paid=True, occurred_at=now - timedelta(days=random.randint(0, 14)),
            )

        for camp in campaigns[:2]:
            SocialCampaignAlert.objects.create(campaign=camp, type=CampaignAlertType.ENDING_SOON, message=f"Campaign {camp.name} ending in 3 days", severity=AlertSeverity.WARNING)

        self.stdout.write(self.style.SUCCESS(f"""
✅ SOCIAL SEED COMPLETE:
- Accounts: {SocialAccount.objects.count()}
- Campaigns: {SocialCampaign.objects.count()}
- Contents: {SocialContent.objects.count()}
- ScheduledPosts: {SocialScheduledPost.objects.count()}
- DailyMetrics: {SocialPlatformDailyMetric.objects.count()}
- Inbox: {SocialInboxConversation.objects.count()} conv + {SocialInboxMessage.objects.count()} msgs
- Media: {SocialMedia.objects.count()}
"""))
