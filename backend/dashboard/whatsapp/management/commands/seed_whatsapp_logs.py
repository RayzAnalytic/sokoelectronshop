from django.core.management.base import BaseCommand
from django.utils import timezone
import random
from datetime import timedelta

class Command(BaseCommand):
    def handle(self, *args, **options):
        from dashboard.whatsapp.models import WhatsAppMessageLog, WhatsAppContact, WhatsAppTemplate
        now = timezone.now()
        contacts = list(WhatsAppContact.objects.all())
        if not contacts:
            print("No contacts")
            return
        
        # Delete using id field, not message_id
        WhatsAppMessageLog.objects.all().delete()
        
        template = WhatsAppTemplate.objects.first()
        
        for i in range(25):
            contact = random.choice(contacts)
            # Use actual model fields discovered: message_id is FK, so we need to handle it
            # Let's create with whatever fields exist
            data = {}
            # Check which fields exist
            field_names = [f.name for f in WhatsAppMessageLog._meta.get_fields() if hasattr(f, 'name')]
            
            if 'recipient' in field_names:
                data['recipient'] = contact.wa_id
            if 'customer_name' in field_names:
                data['customer_name'] = contact.profile_name
            if 'template_name' in field_names:
                data['template_name'] = random.choice(["hello_world","order_confirmation","promo_offer"])
            if 'category' in field_names:
                data['category'] = random.choice(["utility","marketing"])
            if 'status' in field_names:
                data['status'] = random.choice(["sent","delivered","read","failed"])
            if 'sent_at' in field_names:
                data['sent_at'] = now - timedelta(days=random.randint(0,5))
            if 'order_reference' in field_names:
                data['order_reference'] = f"WA-{random.randint(1000,9999)}"
            if 'contact' in field_names:
                data['contact'] = contact
            if 'template' in field_names and template:
                data['template'] = template
            if 'message_id' in field_names:
                # This might be CharField, not FK
                # If it's FK, skip
                try:
                    from dashboard.whatsapp.models import WhatsAppMessage
                    msg = WhatsAppMessage.objects.first()
                    if msg and hasattr(WhatsAppMessageLog._meta.get_field('message_id'), 'related_model'):
                        # It's FK, use msg
                        if msg:
                            data['message_id'] = msg.id
                    else:
                        data['message_id'] = f"fake_log_{i}_{random.randint(1000,9999)}"
                except:
                    pass
            if 'wa_message_id' in field_names:
                data['wa_message_id'] = f"fake_log_{i}_{random.randint(1000,9999)}"
            
            try:
                obj = WhatsAppMessageLog.objects.create(**data)
                print(f"Created log {i}: {obj}")
            except Exception as e:
                print(f"Failed {i} with {data}: {e}")
                # Print field details
                if i == 0:
                    for fn in field_names:
                        try:
                            fld = WhatsAppMessageLog._meta.get_field(fn)
                            print(f"  Field {fn}: {type(fld).__name__} null={fld.null} blank={fld.blank}")
                        except:
                            pass
                break
        
        print(f"Total logs: {WhatsAppMessageLog.objects.count()}")

