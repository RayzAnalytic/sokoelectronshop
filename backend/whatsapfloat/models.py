from django.db import models


class WhatsAppConfig(models.Model):
    """
    Singleton row holding the storefront floating-button config.

    Backs GET /api/whatsapp/config/ (public).
    Reuses the pre-existing `whatsapp_whatsappconfig` table.
    """

    enabled = models.BooleanField(
        default=True,
        help_text='Turn the floating button on or off across the storefront.',
    )
    phone_number = models.CharField(
        max_length=20,
        help_text='E.164 without +, e.g. 254712345678. Used to build wa.me links.',
    )
    display_number = models.CharField(
        max_length=32,
        blank=True,
        help_text='Human-friendly number shown in the panel footer.',
    )
    shop_name = models.CharField(
        max_length=120,
        help_text='Shown in the panel header: "Chat with <shop name>".',
    )
    hours_label = models.CharField(
        max_length=120,
        blank=True,
        help_text='Short status line, e.g. "Mon–Sat, 9am–6pm".',
    )
    default_message = models.TextField(
        blank=True,
        help_text='Prefilled message when the customer taps "Open WhatsApp".',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_whatsappconfig'
        verbose_name = 'WhatsApp Float Config'
        verbose_name_plural = 'WhatsApp Float Config'

    def __str__(self):
        return f'{self.shop_name} ({self.phone_number})'


class WhatsAppQuickAction(models.Model):
    """
    One row per quick-question button in the floating panel.

    Icon values must stay in sync with:
      * ICON_CHOICES below
      * ICON_MAP in components/WhatsAppButton.tsx
    """

    ICON_CHOICES = [
        ('shopping_bag', 'Shopping bag'),
        ('package', 'Package'),
        ('truck', 'Truck'),
        ('headphones', 'Headphones'),
        ('message', 'Message'),
        ('clock', 'Clock'),
    ]

    label = models.CharField(max_length=80)
    message = models.TextField(
        help_text='Prefilled WhatsApp message sent when this button is tapped.',
    )
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