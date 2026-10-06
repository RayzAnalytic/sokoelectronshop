from rest_framework import serializers
from .models import WhatsAppConfig, WhatsAppQuickAction


class WhatsAppQuickActionSerializer(serializers.ModelSerializer):
    """
    Wire shape matches `WhatsAppQuickAction` in lib/api.ts:
      { id, label, message, icon }
    """
    class Meta:
        model = WhatsAppQuickAction
        fields = ['id', 'label', 'message', 'icon']


class WhatsAppConfigSerializer(serializers.ModelSerializer):
    """
    Wire shape matches `WhatsAppConfig` in lib/api.ts:

      {
        enabled, phoneNumber, displayNumber, shopName,
        hoursLabel, defaultMessage, quickActions: [...]
      }

    The DB is snake_case; the wire is camelCase. We bridge here.
    """
    phoneNumber = serializers.CharField(source='phone_number')
    displayNumber = serializers.CharField(source='display_number', allow_blank=True)
    shopName = serializers.CharField(source='shop_name')
    hoursLabel = serializers.CharField(source='hours_label', allow_blank=True)
    defaultMessage = serializers.CharField(source='default_message', allow_blank=True)
    quickActions = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppConfig
        fields = [
            'enabled',
            'phoneNumber',
            'displayNumber',
            'shopName',
            'hoursLabel',
            'defaultMessage',
            'quickActions',
        ]

    def get_quickActions(self, obj):
        qs = WhatsAppQuickAction.objects.filter(is_active=True).order_by('order', 'id')
        return WhatsAppQuickActionSerializer(qs, many=True).data