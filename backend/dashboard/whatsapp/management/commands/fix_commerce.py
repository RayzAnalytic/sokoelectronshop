from django.core.management.base import BaseCommand
from django.utils import timezone

class Command(BaseCommand):
    def handle(self, *args, **options):
        from dashboard.whatsapp.models import WhatsAppCatalogItem, WhatsAppCatalog
        from catalog.models import Product
        
        now = timezone.now()
        catalog = WhatsAppCatalog.objects.first()
        if not catalog:
            catalog = WhatsAppCatalog.get_solo()
        
        fixed = 0
        for prod in Product.objects.filter(is_active=True):
            rid = (prod.sku or f"prod_{prod.id}").lower()
            item = WhatsAppCatalogItem.objects.filter(retailer_id=rid).first()
            if not item:
                # Create
                WhatsAppCatalogItem.objects.create(
                    retailer_id=rid,
                    catalog=catalog,
                    store_product=prod,
                    name=prod.name[:200] if hasattr(prod, 'name') else str(prod),
                    price=getattr(prod, 'price', 0),
                    currency="KES",
                    sync_status="synced",
                    eligible=True,
                    is_removed=False,
                    last_synced_at=now,
                    availability="in stock" if hasattr(WhatsAppCatalogItem, 'availability') else None,
                )
                fixed += 1
                print(f"Created {rid}")
            else:
                # Fix to be visible
                update = {}
                if hasattr(item, 'sync_status') and item.sync_status != 'synced':
                    item.sync_status = 'synced'
                    update['sync_status'] = 'synced'
                if hasattr(item, 'eligible') and not item.eligible:
                    item.eligible = True
                    update['eligible'] = True
                if hasattr(item, 'is_removed') and item.is_removed:
                    item.is_removed = False
                    update['is_removed'] = False
                if hasattr(item, 'price') and (not item.price or item.price == 0):
                    item.price = prod.price
                    update['price'] = prod.price
                if hasattr(item, 'name') and not item.name:
                    item.name = prod.name[:200]
                    update['name'] = prod.name[:200]
                if update:
                    item.last_synced_at = now
                    item.save()
                    fixed += 1
                    print(f"Fixed {rid}: {list(update.keys())}")
        
        print(f"\nFixed {fixed} items. Total now: {WhatsAppCatalogItem.objects.count()}")
        print("Sample for frontend:")
        for item in WhatsAppCatalogItem.objects.all()[:3]:
            print(f"  {item.retailer_id} - {getattr(item, 'name', '?')} - {getattr(item, 'sync_status', '?')} - eligible={getattr(item, 'eligible', '?')}")

