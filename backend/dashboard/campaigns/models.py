import uuid

from django.conf import settings
from django.db import models


class Campaign(models.Model):
    class CampaignType(models.TextChoices):
        PRODUCT_PROMOTION = 'product_promotion', 'Product Promotion'
        DISCOUNT = 'discount', 'Discount Campaign'
        SEASONAL = 'seasonal', 'Seasonal Campaign'
        NEW_PRODUCT = 'new_product', 'New Product'
        RETENTION = 'retention', 'Customer Retention'
        ABANDONED_CART = 'abandoned_cart', 'Abandoned Cart'
        NEWSLETTER = 'newsletter', 'Newsletter'
        SOCIAL = 'social', 'Social Campaign'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SCHEDULED = 'scheduled', 'Scheduled'
        SENDING = 'sending', 'Sending'
        PAUSED = 'paused', 'Paused'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    class AudienceSource(models.TextChoices):
        ALL = 'all', 'All contacts'
        WHATSAPP_SEGMENT = 'whatsapp_segment', 'WhatsApp segment'
        NEWSLETTER_LIST = 'newsletter_list', 'Newsletter list'
        NEWSLETTER_SEGMENT = 'newsletter_segment', 'Newsletter segment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    campaign_type = models.CharField(max_length=40, choices=CampaignType.choices)
    audience_source = models.CharField(
        max_length=40, choices=AudienceSource.choices, default=AudienceSource.ALL
    )
    audience_ref_id = models.CharField(max_length=64, blank=True, default='')
    audience_size_cached = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    channels = models.JSONField(default=list)
    content = models.JSONField(default=dict)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='meta_campaigns',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaigns_campaign'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.name


class CampaignDispatch(models.Model):
    class Channel(models.TextChoices):
        WHATSAPP = 'whatsapp', 'WhatsApp'
        EMAIL = 'email', 'Email'
        SOCIAL = 'social', 'Social'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
        PAUSED = 'paused', 'Paused'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name='dispatches'
    )
    channel = models.CharField(max_length=20, choices=Channel.choices)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    external_ref_id = models.CharField(max_length=64, blank=True, default='')
    payload = models.JSONField(default=dict)
    result = models.JSONField(default=dict)
    error = models.TextField(blank=True, default='')
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campaigns_dispatch'
        ordering = ['-created_at']
        unique_together = [('campaign', 'channel')]

    def __str__(self):
        return f'{self.campaign.name} · {self.channel}'