from django.core.management.base import BaseCommand
from django.utils import timezone
import random
from datetime import timedelta

class Command(BaseCommand):
    def handle(self, *args, **options):
        from dashboard.whatsapp.models import WhatsAppMessageLog, WhatsAppContact
        
        now = timezone.now()
        contacts = list(WhatsAppContact.objects.all())
        if not contacts:
            print("No contacts - run seed_whatsapp_fake first")
            return
        
        # Clear old fake
        WhatsAppMessageLog.objects.filter(message_id__startswith="fake_").delete()
        WhatsAppMessageLog.objects.filter(recipient__startswith="2547").delete() if WhatsAppMessageLog.objects.filter(recipient__startswith="2547").exists() else None
        
        # Inspect actual fields by trying common ones
        # From views.py it filters: recipient, customer_name, order_reference, template_name, status, category, sent_at
        for i in range(30):
            contact = random.choice(contacts)
            try:
                # Try the real model signature
                WhatsAppMessageLog.objects.create(
                    message_id=f"fake_log_{i}_{random.randint(1000,9999)}",
                    recipient=contact.wa_id,
                    customer_name=contact.profile_name,
                    template_name=random.choice(["hello_world","order_confirmation","promo_offer","delivery_update",""]),
                    category=random.choice(["utility","marketing","authentication"]),
                    status=random.choice(["sent","delivered","read","failed","accepted"]),
                    sent_at=now - timedelta(days=random.randint(0,5), hours=random.randint(0,23)),
                    failure_reason="" if random.random() > 0.1 else "User not reachable",
                    order_reference=f"WA-{random.randint(1000,9999)}" if random.random() > 0.5 else None,
                )
            except Exception as e:
                print(f"Failed with first schema, trying alt: {e}")
                try:
                    WhatsAppMessageLog.objects.create(
                        wa_message_id=f"fake_log_{i}_{random.randint(1000,9999)}",
                        recipient=contact.wa_id,
                        customer_name=contact.profile_name,
                        template_name=random.choice(["hello_world","order_confirmation"]),
                        category="utility",
                        status=random.choice(["SENT","DELIVERED","READ"]),
                        sent_at=now - timedelta(days=random.randint(0,5)),
                    )
                except Exception as e2:
                    print(f"Second schema failed: {e2}")
                    # Last resort: print actual model fields
                    from dashboard.whatsapp.models import WhatsAppMessageLog
                    print("Fields:", [f.name for f in WhatsAppMessageLog._meta.get_fields() if hasattr(f,'name')])
                    break
        
        print(f"MessageLog count now: {WhatsAppMessageLog.objects.count()}")
        for log in WhatsAppMessageLog.objects.all()[:3]:
            print(f"  {log}")
