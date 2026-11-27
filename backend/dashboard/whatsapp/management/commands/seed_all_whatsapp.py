from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.crypto import get_random_string
from decimal import Decimal
import random
from datetime import timedelta

class Command(BaseCommand):
    def handle(self, *args, **options):
        from dashboard.whatsapp.models import (
            WhatsAppCatalog, WhatsAppCatalogItem, WhatsAppContact,
            WhatsAppConversation, WhatsAppMessage, WhatsAppOrder,
            WhatsAppTemplate, WhatsAppAccount, WhatsAppMessageLog
        )
        from catalog.models import Product
        now = timezone.now()
        
        acct = WhatsAppAccount.objects.first()
        if acct:
            try:
                if hasattr(acct, 'is_connected'):
                    acct.is_connected = True
                if hasattr(acct, 'connection_status'):
                    acct.connection_status = "connected"
                acct.save()
            except:
                pass
        
        try:
            catalog = WhatsAppCatalog.get_solo()
            catalog.auto_sync = True
            catalog.save()
        except:
            catalog = WhatsAppCatalog.objects.first()
        
        # Sync products - idempotent, ensures 11 products with active/synced
        if catalog:
            for prod in Product.objects.filter(is_active=True):
                rid = (prod.sku or f"prod_{prod.id}").lower()
                item, created = WhatsAppCatalogItem.objects.get_or_create(
                    retailer_id=rid,
                    defaults={
                        "catalog": catalog,
                        "store_product": prod,
                        "name": prod.name[:200],
                        "price": prod.price,
                        "currency": "KES",
                        "sync_status": "synced",
                        "product_status": "active",
                        "eligible": True,
                        "is_removed": False,
                        "last_synced_at": now,
                        "stock_quantity": 10,
                    }
                )
                if not created:
                    # Ensure visible
                    item.store_product = prod
                    item.name = prod.name[:200]
                    item.price = prod.price
                    item.sync_status = "synced"
                    item.product_status = "active"
                    item.eligible = True
                    item.is_removed = False
                    item.last_synced_at = now
                    if not item.stock_quantity:
                        item.stock_quantity = 10
                    item.save()
        
        # Contacts - idempotent
        contacts_data = [
            ("254712345001","Brian Otieno"), ("254712345002","Faith Wanjiku"),
            ("254723456789","Kevin Mwangi"), ("254734567890","Grace Akinyi"),
            ("254745678901","David Kamau"), ("254756789012","Linda Njeri"),
        ]
        contacts = []
        for wa_id, name in contacts_data:
            c,_ = WhatsAppContact.objects.update_or_create(
                wa_id=wa_id,
                defaults={"profile_name": name, "opt_in_status": "SUBSCRIBED"}
            )
            contacts.append(c)
        
        # Conversations + Messages - only if empty
        if WhatsAppConversation.objects.filter(contact__in=contacts).count() == 0:
            for contact in contacts[:4]:
                conv = WhatsAppConversation.objects.create(
                    contact=contact, status="OPEN", unread_count=0,
                    last_message_at=now, last_message_preview="Habari, iko available?"
                )
                for j in range(3):
                    WhatsAppMessage.objects.create(
                        conversation=conv, wa_message_id=f"fake_{get_random_string(8)}_{j}",
                        direction="IN" if j%2==0 else "OUT", type="text",
                        body=random.choice(["Habari, iko available?","Bei ni how much?","Sawa, tuna deliver"]),
                        status="READ", timestamp=now - timedelta(hours=j)
                    )
        
        # MessageLogs - THE FIX FOR HISTORY TAB - idempotent
        if WhatsAppMessageLog.objects.count() < 5:
            template = WhatsAppTemplate.objects.first()
            for i in range(25):
                contact = random.choice(contacts)
                try:
                    WhatsAppMessageLog.objects.create(
                        wa_message_id=f"fake_log_{i}_{get_random_string(6)}",
                        recipient=contact.wa_id,
                        customer_name=contact.profile_name,
                        template_name=random.choice(["hello_world","order_confirmation","promo_offer"]),
                        category=random.choice(["utility","marketing"]),
                        status=random.choice(["sent","delivered","read"]),
                        sent_at=now - timedelta(days=random.randint(0,5)),
                        order_reference=f"WA-{random.randint(1000,9999)}" if i%2==0 else "",
                        contact=contact,
                        template=template if template and i%3==0 else None,
                    )
                except Exception as e:
                    print(f"Log failed {i}: {e}")
                    break
        
        # Templates
        for name, body, cat in [
            ("hello_world","Hello {{1}}, welcome!","utility"),
            ("order_confirmation","Order {{1}} confirmed KES {{2}}","utility"),
            ("promo_offer","Offer {{1}} OFF!","marketing"),
        ]:
            WhatsAppTemplate.objects.update_or_create(
                name=name, language="en",
                defaults={"category":cat,"status":"APPROVED","body_text":body,"header_type":"none"}
            )
        
        print(f"✅ Done: CatalogItems:{WhatsAppCatalogItem.objects.count()} Contacts:{WhatsAppContact.objects.count()} Conv:{WhatsAppConversation.objects.count()} Msg:{WhatsAppMessage.objects.count()} Logs:{WhatsAppMessageLog.objects.count()}")
