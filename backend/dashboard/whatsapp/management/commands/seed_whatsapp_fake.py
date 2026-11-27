from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.crypto import get_random_string
from decimal import Decimal
import random
from datetime import timedelta

class Command(BaseCommand):
    help = "Seed WhatsApp with fake demo data"

    def handle(self, *args, **options):
        from dashboard.whatsapp.models import (
            WhatsAppCatalog,
            WhatsAppCatalogItem,
            WhatsAppContact,
            WhatsAppConversation,
            WhatsAppMessage,
            WhatsAppOrder,
            WhatsAppTemplate,
            WhatsAppAccount,
            WhatsAppSettings,
            WhatsAppMessageLog,
        )
        from catalog.models import Product
        
        now = timezone.now()
        
        account = WhatsAppAccount.objects.first()
        if account:
            account.is_connected = True
            try:
                account.connection_status = "connected"
                account.save(update_fields=["is_connected", "connection_status", "updated_at"])
            except:
                account.save()
            print(f"Account connected")
        
        catalog = WhatsAppCatalog.get_solo()
        catalog.auto_sync = True
        catalog.save(update_fields=["auto_sync", "updated_at"])
        print(f"Catalog items: {WhatsAppCatalogItem.objects.count()}")

        contacts_data = [
            ("254712345001", "Brian Otieno", "brian@example.com"),
            ("254712345002", "Faith Wanjiku", "faith@example.com"),
            ("254723456789", "Kevin Mwangi", "kevin@example.com"),
            ("254734567890", "Grace Akinyi", "grace@example.com"),
            ("254745678901", "David Kamau", "david@example.com"),
            ("254756789012", "Linda Njeri", "linda@example.com"),
            ("254767890123", "James Ochieng", "james@example.com"),
            ("254778901234", "Sarah Muthoni", "sarah@example.com"),
        ]
        
        contacts = []
        for wa_id, name, email in contacts_data:
            contact, _ = WhatsAppContact.objects.update_or_create(
                wa_id=wa_id,
                defaults={
                    "profile_name": name,
                    "email": email,
                    "opt_in_status": "SUBSCRIBED",
                    "opt_in_source": "website",
                    "opt_in_at": now - timedelta(days=random.randint(1, 30)),
                    "last_inbound_at": now - timedelta(hours=random.randint(1, 72)),
                    "order_count": random.randint(0, 5),
                    "total_spent": Decimal(random.randint(1000, 50000)),
                    "tags": random.sample(["vip", "new", "returning"], k=2),
                }
            )
            contacts.append(contact)
        print(f"Contacts: {len(contacts)}")

        WhatsAppMessage.objects.filter(wa_message_id__startswith="fake_").delete()
        
        inbound_texts = [
            "Habari, iko available?",
            "Bei ni how much?",
            "Niko na swali about iPhone 17",
            "Naeza pata discount?",
            "Delivery ni how long to Nyeri?",
            "Niko interested",
            "Mko na warranty?",
            "Naeza lipa na M-Pesa?",
        ]
        outbound_texts = [
            "Habari! Yes iko available. Bei ni KES 135,000",
            "Tuna same day delivery Nyeri town",
            "Yes, 1 year warranty + free case",
            "Naeza kutumia catalog uchoose?",
            "Sawa, nimekutumia invoice",
            "Asante kwa order yako!",
            "Tuna accept M-Pesa, card na COD",
            "Karibu Sana! SokoFlow Nyeri",
        ]
        
        conv_count = 0
        for contact in contacts[:6]:
            conv, _ = WhatsAppConversation.objects.update_or_create(
                contact=contact,
                defaults={
                    "status": random.choice(["OPEN", "OPEN", "PENDING", "RESOLVED"]),
                    "priority": random.choice(["NORMAL", "HIGH"]),
                    "unread_count": random.randint(0, 2),
                    "last_message_at": now - timedelta(hours=random.randint(0, 48)),
                    "last_inbound_at": now - timedelta(hours=random.randint(0, 48)),
                    "first_message_at": now - timedelta(days=random.randint(1, 5)),
                    "last_message_preview": random.choice(inbound_texts)[:100],
                    "tags": ["sales"],
                    "starred": random.choice([False, True]),
                }
            )
            conv_count += 1
            
            num_msgs = random.randint(4, 8)
            base_time = now - timedelta(hours=random.randint(1, 72))
            last_body = ""
            last_msg = None
            for i in range(num_msgs):
                is_in = i % 2 == 0
                direction = "IN" if is_in else "OUT"
                body = random.choice(inbound_texts) if is_in else random.choice(outbound_texts)
                last_body = body
                last_msg = WhatsAppMessage.objects.create(
                    conversation=conv,
                    wa_message_id=f"fake_{get_random_string(12)}_{i}_{contact.id}",
                    direction=direction,
                    type="text",
                    body=body,
                    status=random.choice(["SENT", "DELIVERED", "READ"]),
                    timestamp=base_time + timedelta(minutes=i*15),
                )
            if last_msg:
                conv.last_message_preview = last_body[:100]
                conv.last_message_at = last_msg.timestamp
                conv.save(update_fields=["last_message_preview", "last_message_at", "updated_at"])
        
        print(f"Conversations: {conv_count}, Messages: {WhatsAppMessage.objects.count()}")

        WhatsAppOrder.objects.filter(order_number__startswith="WA-FAKE").delete()
        items_catalog = list(WhatsAppCatalogItem.objects.all()[:10])
        
        for i in range(6):
            contact = random.choice(contacts)
            conv = WhatsAppConversation.objects.filter(contact=contact).first()
            prod_item = random.choice(items_catalog) if items_catalog else None
            price = prod_item.price if prod_item and hasattr(prod_item, 'price') else Decimal(random.randint(2000, 80000))
            
            WhatsAppOrder.objects.create(
                order_number=f"WA-FAKE-{get_random_string(6).upper()}",
                contact=contact,
                contact_name=contact.profile_name,
                contact_wa_id=contact.wa_id,
                conversation=conv,
                items=[{
                    "name": getattr(prod_item, 'name', 'iPhone 17 Pro') if prod_item else "iPhone",
                    "retailer_id": getattr(prod_item, 'retailer_id', 'prod_fe00ce') if prod_item else "prod_fe00ce",
                    "quantity": 1,
                    "price": str(price),
                }],
                subtotal=price,
                total=price + Decimal("200"),
                currency="KES",
                status=random.choice(["PENDING", "CONFIRMED", "PAID", "SHIPPED", "DELIVERED"]),
                payment_method=random.choice(["mpesa", "card", "cod"]),
                delivery_address=f"{contact.profile_name}, Nyeri Town",
            )
        print(f"Orders: {WhatsAppOrder.objects.filter(order_number__startswith='WA-FAKE').count()}")

        templates_data = [
            ("hello_world", "en", "UTILITY", "APPROVED", "Hello {{1}}, welcome to SokoFlow!"),
            ("order_confirmation", "en", "UTILITY", "APPROVED", "Hi {{1}}, order {{2}} confirmed! Total KES {{3}}"),
            ("delivery_update", "en", "UTILITY", "APPROVED", "Hi {{1}}, order {{2}} out for delivery! Rider {{3}}"),
            ("abandoned_cart", "en", "MARKETING", "APPROVED", "Hey {{1}}, you left {{2}} in cart! 5% off {{3}}"),
            ("promo_offer", "en", "MARKETING", "APPROVED", "Offer {{1}} - {{2}}% OFF on iPhones! {{3}}"),
        ]
        
        for name, lang, cat, status, body in templates_data:
            WhatsAppTemplate.objects.update_or_create(
                name=name,
                language=lang,
                defaults={
                    "category": cat,
                    "status": status,
                    "body_text": body,
                    "header_type": "none",
                    "variable_count": body.count("{{"),
                    "sent_count": random.randint(100, 1000),
                    "delivered_count": random.randint(90, 900),
                    "read_count": random.randint(80, 800),
                    "quality": "HIGH",
                }
            )
        print(f"Templates: {WhatsAppTemplate.objects.count()}")

        self.stdout.write(self.style.SUCCESS("WhatsApp fake data seeded"))
