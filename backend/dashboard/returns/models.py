from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class ReturnReason(models.Model):
    label = models.CharField(max_length=120)
    description = models.CharField(max_length=255, blank=True)
    requires_photo = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'label']
        verbose_name = 'Return reason'
        verbose_name_plural = 'Return reasons'

    def __str__(self):
        return self.label


class ReturnRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'REQUESTED', 'Requested'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        AWAITING_ITEM = 'AWAITING_ITEM', 'Awaiting item'
        ITEM_RECEIVED = 'ITEM_RECEIVED', 'Item received'
        CLOSED = 'CLOSED', 'Closed'

    class RefundStatus(models.TextChoices):
        NONE = 'NONE', 'None'
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    class RefundMethod(models.TextChoices):
        ORIGINAL = 'original', 'Original payment'
        STORE_CREDIT = 'store_credit', 'Store credit'
        BANK_TRANSFER = 'bank_transfer', 'Bank transfer'
        MANUAL = 'manual', 'Manual'

    code = models.CharField(max_length=32, unique=True, db_index=True)
    order = models.ForeignKey(
        'checkout.Order',
        on_delete=models.PROTECT,
        related_name='returns',
    )
    reason = models.ForeignKey(
        ReturnReason,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='requests',
    )
    reason_text = models.CharField(max_length=180, blank=True)

    customer_name = models.CharField(max_length=180)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)
    tracking = models.CharField(max_length=120, blank=True)

    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REQUESTED,
        db_index=True,
    )
    refund_status = models.CharField(
        max_length=20,
        choices=RefundStatus.choices,
        default=RefundStatus.NONE,
    )
    refund_method = models.CharField(
        max_length=20,
        choices=RefundMethod.choices,
        default=RefundMethod.ORIGINAL,
    )

    original_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00'),
    )
    refund_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00'),
    )

    requested_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['status', '-requested_at']),
            models.Index(fields=['refund_status']),
        ]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self) -> str:
        year = timezone.now().year
        prefix = f'RET-{year}-'
        last = (
            ReturnRequest.objects
            .filter(code__startswith=prefix)
            .order_by('-code')
            .values_list('code', flat=True)
            .first()
        )
        n = 1
        if last:
            try:
                n = int(last.rsplit('-', 1)[1]) + 1
            except (ValueError, IndexError):
                n = 1
        return f'{prefix}{n:04d}'


class ReturnItem(models.Model):
    class Condition(models.TextChoices):
        UNOPENED = 'unopened', 'Unopened'
        OPENED = 'opened', 'Opened'
        DAMAGED = 'damaged', 'Damaged'
        DEFECTIVE = 'defective', 'Defective'

    return_request = models.ForeignKey(
        ReturnRequest,
        on_delete=models.CASCADE,
        related_name='items',
    )
    order_item = models.ForeignKey(
        'checkout.OrderItem',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='return_items',
    )

    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64, blank=True)
    qty = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    image = models.CharField(max_length=500, blank=True)
    condition = models.CharField(
        max_length=20,
        choices=Condition.choices,
        default=Condition.UNOPENED,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.product_name} x{self.qty}'


class Refund(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    return_request = models.ForeignKey(
        ReturnRequest,
        on_delete=models.CASCADE,
        related_name='refunds',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(
        max_length=20,
        choices=ReturnRequest.RefundMethod.choices,
        default=ReturnRequest.RefundMethod.ORIGINAL,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reference = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Refund {self.id} · {self.amount}'


class ReturnSettings(models.Model):
    return_window_days = models.PositiveIntegerField(default=14)
    auto_approve_under = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('5000.00'),
    )
    restocking_fee_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.00'),
    )
    notify_email = models.BooleanField(default=True)
    notify_sms = models.BooleanField(default=False)
    notify_push = models.BooleanField(default=False)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Return settings'
        verbose_name_plural = 'Return settings'

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)