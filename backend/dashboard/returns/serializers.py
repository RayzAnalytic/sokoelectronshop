from rest_framework import serializers

from .models import (
    Refund,
    ReturnItem,
    ReturnReason,
    ReturnRequest,
    ReturnSettings,
)


class ReturnReasonSerializer(serializers.ModelSerializer):
    requiresPhoto = serializers.BooleanField(source='requires_photo')

    class Meta:
        model = ReturnReason
        fields = (
            'id', 'label', 'description', 'requiresPhoto', 'active', 'order',
        )


class ReturnItemSerializer(serializers.ModelSerializer):
    productName = serializers.CharField(source='product_name')

    class Meta:
        model = ReturnItem
        fields = (
            'id', 'productName', 'sku', 'qty', 'price', 'image', 'condition',
        )


class RefundSerializer(serializers.ModelSerializer):
    returnCode = serializers.CharField(
        source='return_request.code', read_only=True,
    )
    orderId = serializers.CharField(
        source='return_request.order.reference', read_only=True,
    )
    customer = serializers.CharField(
        source='return_request.customer_name', read_only=True,
    )
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    completedAt = serializers.DateTimeField(
        source='completed_at', read_only=True,
    )

    class Meta:
        model = Refund
        fields = (
            'id', 'returnCode', 'orderId', 'customer', 'amount',
            'method', 'status', 'reference', 'createdAt', 'completedAt',
        )


class ReturnRequestSerializer(serializers.ModelSerializer):
    orderId = serializers.CharField(source='order.reference', read_only=True)
    customer = serializers.SerializerMethodField()
    reason = serializers.SerializerMethodField()
    reasonId = serializers.SerializerMethodField()

    refundStatus = serializers.CharField(source='refund_status')
    refundMethod = serializers.CharField(source='refund_method')

    requestedAt = serializers.DateTimeField(source='requested_at')
    resolvedAt = serializers.DateTimeField(source='resolved_at')

    originalAmount = serializers.DecimalField(
        source='original_amount', max_digits=12, decimal_places=2,
    )
    refundAmount = serializers.DecimalField(
        source='refund_amount', max_digits=12, decimal_places=2,
    )
    internalNotes = serializers.CharField(
        source='internal_notes', allow_blank=True, required=False,
    )

    items = ReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = ReturnRequest
        fields = (
            'id', 'code', 'orderId', 'customer', 'reason', 'reasonId',
            'notes', 'internalNotes',
            'status', 'refundStatus', 'refundMethod',
            'originalAmount', 'refundAmount', 'address', 'tracking',
            'requestedAt', 'resolvedAt', 'items',
        )
        read_only_fields = (
            'id', 'code', 'orderId', 'customer', 'reasonId',
            'originalAmount', 'refundAmount', 'requestedAt', 'items',
        )

    def get_customer(self, obj):
        return {
            'name': obj.customer_name,
            'email': obj.customer_email,
            'phone': obj.customer_phone,
        }

    def get_reason(self, obj):
        if obj.reason_id:
            return obj.reason.label
        return obj.reason_text

    def get_reasonId(self, obj):
        return obj.reason_id


class ReturnStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ReturnRequest.Status.choices)


class ReturnRefundMethodSerializer(serializers.Serializer):
    refund_method = serializers.ChoiceField(
        choices=ReturnRequest.RefundMethod.choices,
    )


class RefundCreateSerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=ReturnRequest.RefundMethod.choices, required=False,
    )
    reference = serializers.CharField(
        max_length=120, required=False, allow_blank=True,
    )
    note = serializers.CharField(required=False, allow_blank=True)


class ReturnSettingsSerializer(serializers.ModelSerializer):
    returnWindowDays = serializers.IntegerField(source='return_window_days')
    autoApproveUnder = serializers.DecimalField(
        source='auto_approve_under', max_digits=12, decimal_places=2,
    )
    restockingFeePct = serializers.DecimalField(
        source='restocking_fee_pct', max_digits=5, decimal_places=2,
    )
    notifyEmail = serializers.BooleanField(source='notify_email')
    notifySms = serializers.BooleanField(source='notify_sms')
    notifyPush = serializers.BooleanField(source='notify_push')

    class Meta:
        model = ReturnSettings
        fields = (
            'returnWindowDays', 'autoApproveUnder', 'restockingFeePct',
            'notifyEmail', 'notifySms', 'notifyPush',
        )


class ReturnItemWriteSerializer(serializers.Serializer):
    product_name = serializers.CharField(max_length=255)
    sku = serializers.CharField(
        max_length=64, required=False, allow_blank=True, default='',
    )
    qty = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    image = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default='',
    )
    condition = serializers.ChoiceField(
        choices=ReturnItem.Condition.choices,
        required=False,
        default=ReturnItem.Condition.UNOPENED,
    )


class ReturnRequestCreateSerializer(serializers.Serializer):
    order_id = serializers.CharField(max_length=64)
    reason_id = serializers.IntegerField(required=False, allow_null=True)
    reason_text = serializers.CharField(
        max_length=180, required=False, allow_blank=True, default='',
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = ReturnItemWriteSerializer(many=True, allow_empty=False)