"""Seed the WhatsApp tables with realistic fake data.

Usage:
    python manage.py seed_whatsapp                  # seed everything missing
    python manage.py seed_whatsapp --reset          # wipe seed data, then seed
    python manage.py seed_whatsapp --real-catalog   # sync catalog.Product first
    python manage.py seed_whatsapp --only inbox     # one section only
"""

import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from dashboard.whatsapp.models import (
    WhatsAppAccount,
    WhatsAppAuditEntry,
    WhatsAppAutomation,
    WhatsAppBotFlow,
    WhatsAppBotNode,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppInvoice,
    WhatsAppMessage,
    WhatsAppNotification,
    WhatsAppOrder,
    WhatsAppQuickReply,
    WhatsAppSegment,
    WhatsAppTeamMember,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)


FIRST_NAMES = [
    'Wanjiru', 'Brian', 'Amina', 'Peter', 'Grace', 'John', 'Faith', 'David',
    'Sarah', 'James', 'Lucy', 'Ahmed', 'Rose', 'Michael', 'Esther', 'Kevin',
    'Mercy', 'Daniel', 'Jane', 'Samuel', 'Lilian', 'Joseph', 'Beatrice',
    'Patrick', 'Catherine', 'Francis', 'Ann', 'Stephen', 'Hannah', 'Robert',
    'Caroline', 'Dennis', 'Janet', 'Victor', 'Monica', 'Alex', 'Ruth',
    'George', 'Elizabeth', 'Martin',
]

LAST_NAMES = [
    'Kamau', 'Otieno', 'Hassan', 'Mwangi', 'Achieng', 'Kipchoge', 'Njeri',
    'Mutua', 'Wambui', 'Kariuki', 'Wairimu', 'Ali', 'Chebet', 'Ouma',
    'Atieno', 'Maina', 'Nyambura', 'Barasa', 'Wanjiku', 'Kiptoo', 'Auma',
    'Njoroge', 'Moraa', 'Ochieng', 'Muthoni', 'Wekesa', 'Odera', 'Wambua',
    'Koech', 'Onyango', 'Wafula', 'Mbugua', 'Waweru', 'Korir', 'Odhiambo',
    'Ngugi', 'Wanjala', 'Mumo', 'Ngige', 'Oduya',
]

TAGS_POOL = ['VIP', 'Repeat', 'New', 'Wholesale', 'Wholesale-ready', 'Nairobi', 'Mombasa', 'Lead']
CITIES = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Nyeri']

PHONE_PREFIXES = [
    '0700', '0701', '0710', '0712', '0720', '0722', '0725', '0730',
    '0733', '0735', '0740', '0742', '0745', '0757', '0759', '0768',
    '0769', '0790', '0792', '0798',
]

FAKE_CATALOG_ITEMS = [
    {'retailer_id': 'FAKE-001', 'name': 'Wireless Earbuds Pro', 'category': 'Audio', 'brand': 'SoundMax', 'price': '3500', 'sale_price': '2999'},
    {'retailer_id': 'FAKE-002', 'name': 'Smart Watch Series 5', 'category': 'Wearables', 'brand': 'TimeTech', 'price': '8900', 'sale_price': None},
    {'retailer_id': 'FAKE-003', 'name': 'Bluetooth Speaker Mini', 'category': 'Audio', 'brand': 'SoundMax', 'price': '2200', 'sale_price': None},
    {'retailer_id': 'FAKE-004', 'name': 'USB-C Fast Charger 65W', 'category': 'Accessories', 'brand': 'PowerLine', 'price': '1800', 'sale_price': '1499'},
    {'retailer_id': 'FAKE-005', 'name': 'Phone Case Clear Slim', 'category': 'Accessories', 'brand': 'ShieldPro', 'price': '500', 'sale_price': None},
    {'retailer_id': 'FAKE-006', 'name': 'Wireless Mouse Ergonomic', 'category': 'Computer', 'brand': 'ClickTech', 'price': '1500', 'sale_price': None},
    {'retailer_id': 'FAKE-007', 'name': 'LED Desk Lamp', 'category': 'Home', 'brand': 'GlowLite', 'price': '1200', 'sale_price': None},
    {'retailer_id': 'FAKE-008', 'name': 'Power Bank 20000mAh', 'category': 'Accessories', 'brand': 'PowerLine', 'price': '2800', 'sale_price': '2499'},
]

TEMPLATES = [
    {'name': 'order_confirmation', 'category': 'UTILITY', 'status': 'APPROVED', 'body': 'Hi {{1}}, your order {{2}} is confirmed. Total: KES {{3}}. Track: {{4}}'},
    {'name': 'shipping_update', 'category': 'UTILITY', 'status': 'APPROVED', 'body': 'Good news {{1}}! Your order {{2}} is on its way. ETA: {{3}}'},
    {'name': 'order_delivered', 'category': 'UTILITY', 'status': 'APPROVED', 'body': 'Your order {{1}} was delivered. Please rate us: {{2}}'},
    {'name': 'cart_recovery', 'category': 'MARKETING', 'status': 'APPROVED', 'body': 'Hi {{1}}, you left {{2}} in your cart. Complete: {{3}}'},
    {'name': 'payment_reminder', 'category': 'UTILITY', 'status': 'APPROVED', 'body': 'Hi {{1}}, payment of KES {{2}} pending for order {{3}}'},
    {'name': 'welcome_message', 'category': 'MARKETING', 'status': 'APPROVED', 'body': 'Welcome to RazeStore, {{1}}! Reply HELP for assistance.'},
    {'name': 'promo_launch', 'category': 'MARKETING', 'status': 'APPROVED', 'body': 'Hi {{1}}, check our new arrivals! {{2}} off today only. Shop: {{3}}'},
    {'name': 'abandoned_cart_24h', 'category': 'MARKETING', 'status': 'PENDING', 'body': 'Still thinking about it {{1}}? Your cart is waiting: {{2}}'},
    {'name': 'flash_sale', 'category': 'MARKETING', 'status': 'PENDING', 'body': 'Flash sale {{1}}! {{2}}% off for the next 6 hours: {{3}}'},
    {'name': 'whatsapp_verification', 'category': 'AUTHENTICATION', 'status': 'APPROVED', 'body': 'Your verification code is {{1}}. Valid for 10 minutes.'},
    {'name': 'order_shipped_pickup', 'category': 'UTILITY', 'status': 'PENDING', 'body': 'Hi {{1}}, order {{2}} ready at {{3}}. Pickup: {{4}}'},
    {'name': 'reorder_reminder', 'category': 'MARKETING', 'status': 'APPROVED', 'body': 'Hi {{1}}, ready to reorder {{2}}? Here: {{3}}'},
    {'name': 'christmas_promo', 'category': 'MARKETING', 'status': 'REJECTED', 'body': 'Merry Christmas {{1}}! {{2}} off everything today.', 'rejection_reason': 'Template uses promotional language not permitted for this category'},
    {'name': 'inactive_customer', 'category': 'MARKETING', 'status': 'PAUSED', 'body': 'Hi {{1}}, we miss you! Here is {{2}}% off your next order: {{3}}'},
]

QUICK_REPLIES = [
    {'shortcut': '/shipping', 'title': 'Delivery times', 'body': 'Delivery takes 2-3 business days. Free over KES 5,000.', 'category': 'Logistics'},
    {'shortcut': '/hours', 'title': 'Business hours', 'body': 'We are open Mon-Sat, 9am-6pm. Closed Sundays.', 'category': 'General'},
    {'shortcut': '/mpesa', 'title': 'M-Pesa instructions', 'body': 'Pay via M-Pesa: Paybill 123456, Account: your order number.', 'category': 'Payments'},
    {'shortcut': '/returns', 'title': 'Return policy', 'body': 'Returns accepted within 7 days of delivery. Reply RETURN to start.', 'category': 'Logistics'},
    {'shortcut': '/loc', 'title': 'Our location', 'body': 'We are at Kenyatta Avenue, Nairobi CBD. Open 9am-6pm.', 'category': 'General'},
    {'shortcut': '/track', 'title': 'Track order', 'body': 'Please share your order number (starts with WA-) to track.', 'category': 'Logistics'},
    {'shortcut': '/payment', 'title': 'Payment methods', 'body': 'We accept M-Pesa, Visa, Mastercard, and cash on delivery.', 'category': 'Payments'},
    {'shortcut': '/cart', 'title': 'Continue cart', 'body': 'Tap the cart icon above to review or complete your order.', 'category': 'Shopping'},
    {'shortcut': '/hello', 'title': 'Greeting', 'body': 'Hi! How can I help you today?', 'category': 'General'},
    {'shortcut': '/bye', 'title': 'Sign-off', 'body': 'Thank you for shopping with us! Have a great day.', 'category': 'General'},
]

SEGMENTS = [
    {'name': 'VIP customers', 'description': 'High-value customers with 5+ orders', 'rules': [
        {'field': 'order_count', 'op': 'gt', 'value': '5'},
        {'field': 'total_spent', 'op': 'gt', 'value': '20000'},
    ]},
    {'name': 'Repeat buyers', 'description': 'Customers who ordered more than once', 'rules': [
        {'field': 'order_count', 'op': 'gt', 'value': '1'},
    ]},
    {'name': 'First-time buyers', 'description': 'Customers with exactly one order', 'rules': [
        {'field': 'order_count', 'op': 'eq', 'value': '1'},
    ]},
    {'name': 'Churn risk', 'description': 'Customers with prior orders but inactive for 30+ days', 'rules': [
        {'field': 'order_count', 'op': 'gt', 'value': '0'},
        {'field': 'last_inbound_at', 'op': 'lt', 'value': '30d'},
    ]},
]

AUTOMATIONS = [
    {'name': 'New message auto-reply', 'trigger': 'MESSAGE_RECEIVED', 'trigger_label': 'When a customer messages', 'delay_minutes': 0, 'recipients': 'ALL', 'status': 'ACTIVE', 'template_key': 'welcome_message'},
    {'name': 'Order placed confirmation', 'trigger': 'ORDER_PLACED', 'trigger_label': 'When an order is placed', 'delay_minutes': 0, 'recipients': 'BUYERS', 'status': 'ACTIVE', 'template_key': 'order_confirmation'},
    {'name': 'Cart abandonment', 'trigger': 'CART_ABANDONED', 'trigger_label': 'When cart is abandoned for 1 hour', 'delay_minutes': 60, 'recipients': 'CART_OWNERS', 'status': 'ACTIVE', 'template_key': 'cart_recovery'},
    {'name': 'Shipping update', 'trigger': 'ORDER_SHIPPED', 'trigger_label': 'When an order is marked shipped', 'delay_minutes': 0, 'recipients': 'BUYERS', 'status': 'ACTIVE', 'template_key': 'shipping_update'},
    {'name': 'Delivery follow-up', 'trigger': 'ORDER_DELIVERED', 'trigger_label': 'When an order is marked delivered', 'delay_minutes': 1440, 'recipients': 'BUYERS', 'status': 'PAUSED', 'template_key': 'order_delivered'},
]

BROADCASTS = [
    {'campaign_name': 'Easter Flash Sale', 'status': 'COMPLETED', 'template_key': 'flash_sale', 'audience': 'ALL', 'progress': 100},
    {'campaign_name': 'VIP Early Access', 'status': 'COMPLETED', 'template_key': 'promo_launch', 'audience': 'SEGMENT', 'segment': 'VIP customers', 'progress': 100},
    {'campaign_name': 'Cart Recovery Wave', 'status': 'SENDING', 'template_key': 'abandoned_cart_24h', 'audience': 'ALL', 'progress': 45},
    {'campaign_name': 'New Arrivals', 'status': 'SCHEDULED', 'template_key': 'promo_launch', 'audience': 'ALL', 'progress': 0},
    {'campaign_name': 'Repeat Buyers Offer', 'status': 'PAUSED', 'template_key': 'reorder_reminder', 'audience': 'SEGMENT', 'segment': 'Repeat buyers', 'progress': 30},
    {'campaign_name': 'Weekend Promo Draft', 'status': 'DRAFT', 'template_key': 'flash_sale', 'audience': 'ALL', 'progress': 0},
]

SCRIPTS = {
    'order_inquiry': [
        ('IN', 'Hi'),
        ('OUT', 'Hello! How can we help you today?'),
        ('IN', 'How much are the wireless earbuds?'),
        ('OUT', 'The Wireless Earbuds Pro are KES 3,500. Would you like to order?'),
        ('IN', 'Yes please. Send to Kilimani'),
        ('OUT', 'Great! Order confirmed. Pay via M-Pesa: Paybill 123456, Account WA-1024.'),
        ('IN', 'Paid. TSC2X8ABC'),
        ('OUT', 'Payment received! Your order ships today. Tracking: shp.ke/4xk2'),
    ],
    'support_issue': [
        ('IN', 'My order has not arrived yet'),
        ('OUT', 'Sorry to hear that. Can you share your order number?'),
        ('IN', 'WA-8942'),
        ('OUT', 'Found it. Your parcel is out for delivery today, expected by 5pm.'),
        ('IN', 'Ok thank you!'),
        ('OUT', 'Happy to help! Let us know if it does not arrive by 6pm.'),
    ],
    'browse_products': [
        ('IN', 'Do you have the smart watch in black?'),
        ('OUT', 'Yes! Smart Watch Series 5 in black is available at KES 8,900.'),
        ('IN', 'What about the strap?'),
        ('OUT', 'It comes with a standard silicone strap. Extra straps available for KES 800.'),
        ('IN', 'Let me think about it'),
        ('OUT', 'Take your time! Reply anytime and I will help you complete the order.'),
    ],
    'silent_lead': [
        ('IN', 'Interested in the power bank'),
    ],
    'unread_customer': [
        ('IN', 'Hi, is the LED desk lamp still available?'),
        ('IN', 'Also what is the price?'),
    ],
    'payment_issue': [
        ('IN', 'I sent money but order still shows unpaid'),
        ('OUT', 'Sorry about that. Can you share the M-Pesa confirmation code?'),
        ('IN', 'TSC2X8DEF'),
        ('OUT', 'Found it, confirming your order now. It will update in a minute.'),
        ('IN', 'Thanks!'),
    ],
}

BOT_NODES = [
    {
        'key': 'greeting', 'kind': 'message', 'title': 'Greeting',
        'body': 'Welcome to RazeStore! How can we help you today?',
        'options': [
            {'id': 'browse', 'label': 'Browse products', 'nextId': 'browse'},
            {'id': 'track', 'label': 'Track my order', 'nextId': 'track'},
            {'id': 'agent', 'label': 'Talk to an agent', 'nextId': 'agent'},
        ],
        'position': {'x': 60, 'y': 60}, 'order': 0,
    },
    {
        'key': 'browse', 'kind': 'products', 'title': 'Browse products',
        'body': 'Here are our top picks. Tap any product to view details.',
        'options': [], 'config': {'limit': 5, 'sort': 'popular'},
        'position': {'x': 360, 'y': 60}, 'order': 1,
    },
    {
        'key': 'track', 'kind': 'message', 'title': 'Track order',
        'body': 'Please reply with your order number (e.g. WA-1024).',
        'options': [], 'position': {'x': 360, 'y': 200}, 'order': 2,
    },
    {
        'key': 'agent', 'kind': 'handoff', 'title': 'Human handoff',
        'body': 'Connecting you to our team. One moment please.',
        'options': [], 'position': {'x': 360, 'y': 340}, 'order': 3,
    },
    {
        'key': 'end', 'kind': 'end', 'title': 'Goodbye',
        'body': 'Thanks for shopping with us! Reply anytime to start over.',
        'options': [], 'position': {'x': 60, 'y': 340}, 'order': 4,
    },
]


def _phone():
    return '254' + random.choice(PHONE_PREFIXES)[1:] + ''.join(str(random.randint(0, 9)) for _ in range(6))


def _name():
    return f'{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}'


def _months_ago(n):
    d = timezone.now()
    month = d.month - n
    year = d.year
    while month < 1:
        month += 12
        year -= 1
    return d.replace(year=year, month=month, day=1)


class Command(BaseCommand):
    help = 'Seed WhatsApp tables with realistic fake data.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Wipe existing seed data first')
        parser.add_argument('--only', default='all', help='Seed only one section')
        parser.add_argument('--real-catalog', action='store_true', help='Run real catalog sync first')

    def handle(self, *args, **options):
        if options['reset']:
            self._reset()

        WhatsAppAccount.get_solo()
        WhatsAppCatalog.get_solo()

        if options['real_catalog']:
            self._run_real_catalog_sync()

        self._ensure_fallback_catalog()

        sections = {
            'team': self._seed_team,
            'templates': self._seed_templates,
            'contacts': self._seed_contacts,
            'segments': self._seed_segments,
            'quick-replies': self._seed_quick_replies,
            'inbox': self._seed_inbox,
            'orders': self._seed_orders,
            'automations': self._seed_automations,
            'broadcasts': self._seed_broadcasts,
            'bot': self._seed_bot,
            'webhooks': self._seed_webhooks,
            'invoices': self._seed_invoices,
            'notifications': self._seed_notifications,
            'audit': self._seed_audit,
        }

        to_run = list(sections.keys()) if options['only'] == 'all' else [options['only']]

        for name in to_run:
            if name not in sections:
                self.stderr.write(self.style.ERROR(f'Unknown section: {name}'))
                continue
            with transaction.atomic():
                sections[name]()
            self.stdout.write(self.style.SUCCESS(f'  seeded {name}'))

        self.stdout.write(self.style.SUCCESS('\nDone.'))

    def _run_real_catalog_sync(self):
        try:
            from dashboard.whatsapp.services import sync_catalog
            sync_catalog(WhatsAppCatalog.get_solo())
            self.stdout.write(self.style.SUCCESS('  real catalog synced'))
        except Exception as exc:
            self.stderr.write(self.style.WARNING(f'  real catalog sync failed: {exc}'))

    def _reset(self):
        WhatsAppMessage.objects.all().delete()
        WhatsAppConversation.objects.all().delete()
        WhatsAppOrder.objects.all().delete()
        WhatsAppBroadcast.objects.all().delete()
        WhatsAppAutomation.objects.all().delete()
        WhatsAppSegment.objects.all().delete()
        WhatsAppTemplate.objects.all().delete()
        WhatsAppContact.objects.all().delete()
        WhatsAppWebhookEvent.objects.all().delete()
        WhatsAppInvoice.objects.all().delete()
        WhatsAppNotification.objects.all().delete()
        WhatsAppAuditEntry.objects.all().delete()
        WhatsAppTeamMember.objects.all().delete()
        WhatsAppBotNode.objects.all().delete()
        WhatsAppBotFlow.objects.all().delete()
        WhatsAppCatalogItem.objects.filter(retailer_id__startswith='FAKE-').delete()
        self.stdout.write(self.style.WARNING('Reset complete.'))

    def _ensure_fallback_catalog(self):
        catalog = WhatsAppCatalog.get_solo()
        if WhatsAppCatalogItem.objects.filter(catalog=catalog, is_removed=False).exists():
            return
        for data in FAKE_CATALOG_ITEMS:
            price = Decimal(data['price'])
            sale = Decimal(data['sale_price']) if data['sale_price'] else None
            WhatsAppCatalogItem.objects.create(
                catalog=catalog,
                retailer_id=data['retailer_id'],
                name=data['name'],
                display_title=data['name'],
                description=f"{data['brand']} {data['name']}",
                price=price,
                sale_price=sale,
                currency='KES',
                category=data['category'],
                brand=data['brand'],
                in_stock=True,
                stock_quantity=random.randint(5, 80),
                eligible=True,
                is_linked=False,
                sync_status='SYNCED',
                last_synced_at=timezone.now(),
            )

    def _seed_team(self):
        User = get_user_model()
        users = list(User.objects.all()[:3])
        if not users:
            self.stdout.write(self.style.WARNING('  no users found, skipping team'))
            return
        roles = ['ADMIN', 'AGENT', 'AGENT']
        for user, role in zip(users, roles):
            member, created = WhatsAppTeamMember.objects.get_or_create(
                user=user,
                defaults={
                    'role': role,
                    'active': True,
                    'last_seen_at': timezone.now() - timedelta(minutes=random.randint(1, 30)),
                },
            )
            if not created and not member.last_seen_at:
                member.last_seen_at = timezone.now() - timedelta(minutes=random.randint(1, 30))
                member.save(update_fields=['last_seen_at'])

    def _seed_templates(self):
        for row in TEMPLATES:
            approved = row['status'] == 'APPROVED'
            WhatsAppTemplate.objects.get_or_create(
                name=row['name'],
                language='en',
                defaults={
                    'category': row['category'],
                    'status': row['status'],
                    'body_text': row['body'],
                    'quality': 'GREEN' if approved else 'UNKNOWN',
                    'rejection_reason': row.get('rejection_reason', ''),
                    'is_paused': row['status'] == 'PAUSED',
                    'sent_count': random.randint(0, 500) if approved else 0,
                    'delivered_count': random.randint(0, 450) if approved else 0,
                    'read_count': random.randint(0, 300) if approved else 0,
                    'last_synced_at': timezone.now() - timedelta(hours=random.randint(1, 48)),
                },
            )

    def _seed_contacts(self):
        existing = set(WhatsAppContact.objects.values_list('wa_id', flat=True))
        target = 40
        attempts = 0
        while WhatsAppContact.objects.count() < target and attempts < 200:
            attempts += 1
            wa_id = _phone()
            if wa_id in existing:
                continue
            existing.add(wa_id)
            profile = _name()
            n_tags = random.randint(0, 3)
            tags = random.sample(TAGS_POOL, n_tags) if n_tags else []
            last_inbound = timezone.now() - timedelta(days=random.randint(0, 60))
            WhatsAppContact.objects.create(
                wa_id=wa_id,
                profile_name=profile,
                tags=tags,
                attributes={'city': random.choice(CITIES)},
                opt_in_status='SUBSCRIBED' if random.random() > 0.15 else 'UNSUBSCRIBED',
                opt_in_source=random.choice(['INBOUND', 'CHECKOUT', 'IMPORT']),
                opt_in_at=last_inbound,
                last_inbound_at=last_inbound,
                is_verified=random.random() > 0.3,
                order_count=0,
                total_spent=Decimal('0.00'),
            )

    def _seed_segments(self):
        for row in SEGMENTS:
            WhatsAppSegment.objects.get_or_create(
                name=row['name'],
                defaults={
                    'description': row['description'],
                    'rules': row['rules'],
                    'cached_count': random.randint(3, 15),
                },
            )

    def _seed_quick_replies(self):
        for row in QUICK_REPLIES:
            WhatsAppQuickReply.objects.get_or_create(
                shortcut=row['shortcut'],
                defaults={
                    'title': row['title'],
                    'body': row['body'],
                    'category': row['category'],
                },
            )

    def _seed_inbox(self):
        contacts = list(WhatsAppContact.objects.all())
        if not contacts:
            return
        team = list(WhatsAppTeamMember.objects.filter(active=True))
        script_names = list(SCRIPTS.keys())
        random.shuffle(contacts)
        for i, contact in enumerate(contacts[:30]):
            if WhatsAppConversation.objects.filter(contact=contact).exists():
                continue
            self._create_conversation(contact, team, script_names[i % len(script_names)])

    def _create_conversation(self, contact, team, script_name):
        messages = SCRIPTS[script_name]
        base = timezone.now() - timedelta(
            days=random.randint(0, 13),
            hours=random.randint(0, 8),
            minutes=random.randint(0, 59),
        )
        assigned = random.choice(team) if (team and random.random() > 0.3) else None
        is_resolved = script_name in ('support_issue', 'payment_issue')

        conv = WhatsAppConversation.objects.create(
            contact=contact,
            status='RESOLVED' if is_resolved else 'OPEN',
            assigned_to=assigned.user if assigned else None,
            resolved_at=timezone.now() - timedelta(hours=1) if is_resolved else None,
            csat=random.randint(4, 5) if is_resolved and random.random() > 0.5 else None,
            sla_first_response_due_at=base + timedelta(minutes=15),
            sla_resolution_due_at=base + timedelta(minutes=240),
        )

        timestamps = []
        current = base
        for idx, (direction, body) in enumerate(messages):
            current = current + timedelta(minutes=random.randint(1, 3))
            timestamps.append(current)
            status_val = 'READ' if direction == 'IN' else random.choice(['DELIVERED', 'READ', 'SENT'])
            WhatsAppMessage.objects.create(
                conversation=conv,
                wa_message_id=f'seed_msg_{conv.id}_{idx}',
                direction=direction,
                type='text',
                body=body,
                status=status_val,
                timestamp=current,
                author=assigned.user if (direction == 'OUT' and assigned) else None,
            )

        unread = 0
        for direction, _body in reversed(messages):
            if direction == 'IN':
                unread += 1
            else:
                break

        inbound_ts = [ts for (d, _), ts in zip(messages, timestamps) if d == 'IN']
        conv.first_message_at = timestamps[0]
        conv.last_message_at = timestamps[-1]
        conv.last_inbound_at = inbound_ts[-1] if inbound_ts else None
        conv.last_message_preview = messages[-1][1][:255]
        conv.unread_count = unread if conv.status == 'OPEN' else 0
        conv.first_response_at = timestamps[1] if len(timestamps) > 1 and messages[1][0] == 'OUT' else None
        conv.save(update_fields=[
            'first_message_at', 'last_message_at', 'last_inbound_at',
            'last_message_preview', 'unread_count', 'first_response_at', 'updated_at',
        ])

    def _seed_orders(self):
        catalog = WhatsAppCatalog.get_solo()
        items = list(WhatsAppCatalogItem.objects.filter(catalog=catalog, is_removed=False))
        contacts = list(WhatsAppContact.objects.all())
        if not items or not contacts:
            return
        statuses = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']
        weights = [3, 5, 8, 4, 8, 2]
        payment_methods = ['MPESA', 'CARD', 'COD']
        target = 30
        existing = WhatsAppOrder.objects.count()
        seq = existing
        for _ in range(max(0, target - existing)):
            seq += 1
            contact = random.choice(contacts)
            picked = random.sample(items, min(random.randint(1, 3), len(items)))
            order_items = []
            subtotal = Decimal('0.00')
            for item in picked:
                qty = random.randint(1, 2)
                unit = Decimal(item.effective_price)
                subtotal += unit * qty
                order_items.append({'name': item.name, 'qty': qty, 'price': str(unit), 'currency': 'KES'})
            status_val = random.choices(statuses, weights=weights, k=1)[0]
            created = timezone.now() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            order = WhatsAppOrder.objects.create(
                order_number=f'WA-SEED-{seq:04d}',
                contact=contact,
                contact_name=contact.profile_name or contact.wa_id,
                contact_wa_id=contact.wa_id,
                items=order_items,
                subtotal=subtotal,
                total=subtotal,
                currency='KES',
                status=status_val,
                payment_method=random.choice(payment_methods),
                payment_ref=f'MPESA{random.randint(100000, 999999)}' if status_val in ('PAID', 'SHIPPED', 'DELIVERED') else '',
                delivery_address=f'{random.choice(CITIES)}, Kenya',
            )
            WhatsAppOrder.objects.filter(pk=order.pk).update(created_at=created, updated_at=created)

        for contact in contacts:
            orders_qs = WhatsAppOrder.objects.filter(contact=contact).exclude(status='CANCELLED')
            WhatsAppContact.objects.filter(pk=contact.pk).update(
                order_count=orders_qs.count(),
                total_spent=sum((o.total for o in orders_qs), Decimal('0.00')),
            )

    def _seed_automations(self):
        templates = {t.name: t for t in WhatsAppTemplate.objects.all()}
        for row in AUTOMATIONS:
            WhatsAppAutomation.objects.get_or_create(
                name=row['name'],
                defaults={
                    'trigger': row['trigger'],
                    'trigger_label': row['trigger_label'],
                    'template': templates.get(row['template_key']),
                    'delay_minutes': row['delay_minutes'],
                    'recipients': row['recipients'],
                    'status': row['status'],
                    'messages_sent': random.randint(20, 800) if row['status'] == 'ACTIVE' else 0,
                    'last_triggered_at': timezone.now() - timedelta(hours=random.randint(1, 48)) if row['status'] == 'ACTIVE' else None,
                },
            )

    def _seed_broadcasts(self):
        templates = {t.name: t for t in WhatsAppTemplate.objects.all()}
        segments = {s.name: s for s in WhatsAppSegment.objects.all()}
        for row in BROADCASTS:
            if WhatsAppBroadcast.objects.filter(campaign_name=row['campaign_name']).exists():
                continue
            seg = segments.get(row['segment']) if row['audience'] == 'SEGMENT' else None
            audience_count = seg.cached_count if seg else random.randint(30, 200)
            progress = row['progress']
            reached = int(audience_count * progress / 100)
            delivered = int(reached * 0.94)
            read = int(delivered * 0.7)
            replied = int(read * 0.3)
            failed = max(0, reached - delivered)
            WhatsAppBroadcast.objects.create(
                campaign_name=row['campaign_name'],
                template=templates.get(row['template_key']),
                audience=row['audience'],
                segment=seg,
                audience_count=audience_count,
                recipients=reached,
                delivered=delivered,
                read=read,
                replied=replied,
                failed=failed,
                estimated_cost_kes=Decimal(str(audience_count * 0.50)),
                actual_cost_kes=Decimal(str(delivered * 0.50)),
                status=row['status'],
                sent_at=timezone.now() - timedelta(days=random.randint(1, 10)) if progress > 0 else None,
                scheduled_at=timezone.now() + timedelta(days=2) if row['status'] == 'SCHEDULED' else None,
                completed_at=timezone.now() - timedelta(days=random.randint(0, 5)) if row['status'] == 'COMPLETED' else None,
            )

    def _seed_bot(self):
        flow = WhatsAppBotFlow.get_solo()
        if not flow.name:
            flow.name = 'Main Menu'
        if not flow.entry_node_key:
            flow.entry_node_key = 'greeting'
        flow.save()
        for node_data in BOT_NODES:
            WhatsAppBotNode.objects.get_or_create(
                flow=flow,
                key=node_data['key'],
                defaults={
                    'kind': node_data['kind'],
                    'title': node_data['title'],
                    'body': node_data['body'],
                    'options': node_data.get('options', []),
                    'config': node_data.get('config', {}),
                    'position': node_data['position'],
                    'order': node_data['order'],
                },
            )

    def _seed_webhooks(self):
        if WhatsAppWebhookEvent.objects.count() >= 20:
            return
        fields = ['messages', 'message_status', 'message_template_status_update', 'product_catalog_status_update']
        outcomes = ['DELIVERED'] * 8 + ['RETRYING', 'FAILED']
        for _ in range(30):
            field = random.choice(fields)
            status_val = random.choice(outcomes)
            WhatsAppWebhookEvent.objects.create(
                type=field,
                event_type=field,
                payload=self._fake_webhook_payload(field),
                status=status_val,
                attempts=random.randint(1, 3),
                signature_valid=True,
                latency_ms=random.randint(20, 300),
                error='Timeout' if status_val == 'FAILED' else '',
                received_at=timezone.now() - timedelta(hours=random.randint(1, 48)),
            )

    def _fake_webhook_payload(self, field):
        phone_id = random.randint(100000, 999999)
        wa_from = _phone()
        now_ts = str(int(timezone.now().timestamp()))
        if field == 'messages':
            return {
                'object': 'whatsapp_business_account',
                'entry': [{
                    'id': 'WABA_SEED',
                    'changes': [{
                        'value': {
                            'messaging_product': 'whatsapp',
                            'metadata': {'display_phone_number': '254700000000', 'phone_number_id': str(phone_id)},
                            'messages': [{
                                'from': wa_from,
                                'id': f'wamid.SEED{random.randint(10**15, 10**16)}',
                                'timestamp': now_ts,
                                'type': 'text',
                                'text': {'body': random.choice(['Hi', 'Price?', 'Available?', 'Order status'])},
                            }],
                        },
                        'field': 'messages',
                    }],
                }],
            }
        if field == 'message_status':
            return {
                'object': 'whatsapp_business_account',
                'entry': [{
                    'id': 'WABA_SEED',
                    'changes': [{
                        'value': {
                            'messaging_product': 'whatsapp',
                            'statuses': [{
                                'id': f'wamid.SEED{random.randint(10**15, 10**16)}',
                                'recipient_id': wa_from,
                                'status': random.choice(['sent', 'delivered', 'read']),
                                'timestamp': now_ts,
                            }],
                        },
                        'field': 'message_status',
                    }],
                }],
            }
        return {
            'object': 'whatsapp_business_account',
            'entry': [{'id': 'WABA_SEED', 'changes': [{'field': field, 'value': {}}]}],
        }

    def _seed_invoices(self):
        if WhatsAppInvoice.objects.exists():
            return
        statuses = [(2, 'PAID'), (1, 'PAID'), (0, 'PENDING')]
        for months_back, status_val in statuses:
            period_start = _months_ago(months_back)
            if months_back == 0:
                period_end = timezone.now().date()
            else:
                period_end = _months_ago(months_back - 1).date() - timedelta(days=1)
            WhatsAppInvoice.objects.create(
                period_start=period_start.date(),
                period_end=period_end,
                amount_kes=Decimal(str(random.randint(2500, 9500))),
                currency='KES',
                status=status_val,
                issued_at=period_end + timedelta(days=1),
                pdf_url='',
            )

    def _seed_notifications(self):
        if WhatsAppNotification.objects.exists():
            return
        rows = [
            {'type': 'order', 'title': 'New WhatsApp order', 'body': 'Amina Hassan placed order WA-SEED-0031', 'link': 'Orders'},
            {'type': 'order', 'title': 'Payment received', 'body': 'M-Pesa payment confirmed for WA-SEED-0028', 'link': 'Orders'},
            {'type': 'template', 'title': 'Template approved', 'body': 'promo_launch has been approved by Meta', 'link': 'Templates'},
            {'type': 'template', 'title': 'Template rejected', 'body': 'christmas_promo was rejected, edit and resubmit', 'link': 'Templates'},
            {'type': 'broadcast', 'title': 'Broadcast completed', 'body': 'Easter Flash Sale finished sending to 156 contacts', 'link': 'Broadcasts'},
            {'type': 'quality', 'title': 'Quality score alert', 'body': 'Your WhatsApp number quality dropped to YELLOW', 'link': 'Connection'},
            {'type': 'system', 'title': 'Token expiring soon', 'body': 'Your WhatsApp access token expires in 5 days', 'link': 'Connection'},
        ]
        for row in rows:
            WhatsAppNotification.objects.create(
                type=row['type'],
                title=row['title'],
                body=row['body'],
                link_tab=row['link'],
                read=random.random() > 0.6,
                timestamp=timezone.now() - timedelta(hours=random.randint(1, 72)),
            )

    def _seed_audit(self):
        if WhatsAppAuditEntry.objects.exists():
            return
        team = list(WhatsAppTeamMember.objects.select_related('user'))
        actions = [
            ('catalog.sync', 'catalog'),
            ('settings.update', 'account'),
            ('template.submit', 'template'),
            ('broadcast.send', 'broadcast'),
            ('automation.toggle', 'automation'),
            ('conversation.resolve', 'conversation'),
            ('order.update', 'order'),
            ('contact.unsubscribe', 'contact'),
        ]
        for _ in range(12):
            action, target = random.choice(actions)
            actor = random.choice(team).user if (team and random.random() > 0.2) else None
            WhatsAppAuditEntry.objects.create(
                actor=actor,
                actor_name=(actor.get_full_name() or actor.get_username()) if actor else 'system',
                action=action,
                target=f'{target}:{random.randint(1, 50)}',
                payload={'note': 'seeded'},
                timestamp=timezone.now() - timedelta(hours=random.randint(1, 96)),
            )