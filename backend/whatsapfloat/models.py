from django.core.validators import RegexValidator
from django.db import models


class WhatsAppConfig(models.Model):
    phone_validator = RegexValidator(
        regex=r'^\d{10,15}$',
        message='Enter digits only, no + or spaces. Example: 254712345678.',
    )

    enabled = models.BooleanField(default=True)
    phone_number = models.CharField(
        max_length=20,
        validators=[phone_validator],
    )
    display_number = models.CharField(max_length=32, blank=True, default='')
    shop_name = models.CharField(max_length=120)
    hours_label = models.CharField(max_length=120, blank=True, default='')
    default_message = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_whatsappconfig'
        verbose_name = 'WhatsApp Float Config'
        verbose_name_plural = 'WhatsApp Float Config'

    def __str__(self):
        return f'{self.shop_name} ({self.phone_number})'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def build_wa_link(self, message: str | None = None) -> str:
        text = (message or self.default_message or '').strip()
        base = f'https://wa.me/{self.phone_number}'
        if not text:
            return base
        from urllib.parse import quote
        return f'{base}?text={quote(text)}'


class WhatsAppQuickAction(models.Model):
    ICON_CHOICES = [
        ('shopping_bag', 'Shopping bag'),
        ('package', 'Package'),
        ('truck', 'Truck'),
        ('headphones', 'Headphones'),
        ('message', 'Message'),
        ('clock', 'Clock'),
    ]

    label = models.CharField(max_length=80)
    message = models.TextField()
    icon = models.CharField(
        max_length=24,
        choices=ICON_CHOICES,
        default='message',
    )
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_whatsappquickaction'
        ordering = ['order', 'id']
        verbose_name = 'WhatsApp Quick Action'
        verbose_name_plural = 'WhatsApp Quick Actions'

    def __str__(self):
        return self.label