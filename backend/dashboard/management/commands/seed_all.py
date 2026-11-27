from django.core.management.base import BaseCommand
from django.core.management import call_command

class Command(BaseCommand):
    help = "Seed all fake data for Render - idempotent, safe to run on every deploy"

    def handle(self, *args, **options):
        self.stdout.write("=== SEED ALL START ===")
        
        # Order matters: catalog first, then whatsapp catalog, then others
        commands = [
            ("sync_wa_catalog", {}),
            ("seed_all_whatsapp", {}),  # catalog + messages + logs
            ("seed_social", {}),
            ("seed_direct_orders", {}),
            ("seed_whatsapp_logs", {}),
            ("fix_commerce", {}),
        ]
        
        for cmd_name, kwargs in commands:
            try:
                self.stdout.write(f"\n--> Running {cmd_name}...")
                call_command(cmd_name, **kwargs)
                self.stdout.write(self.style.SUCCESS(f"✅ {cmd_name} done"))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"⚠️ {cmd_name} failed (may not exist or already seeded): {e}"))
        
        self.stdout.write(self.style.SUCCESS("\n=== SEED ALL COMPLETE ==="))
        self.stdout.write("Summary:")
        try:
            from catalog.models import Product
            from dashboard.whatsapp.models import WhatsAppCatalogItem, WhatsAppMessage, WhatsAppMessageLog
            from dashboard.social.models import SocialAccount
            from dashboard.direct_orders.models import DirectOrder
            self.stdout.write(f"  Products: {Product.objects.count()}")
            self.stdout.write(f"  WA Catalog: {WhatsAppCatalogItem.objects.count()}")
            self.stdout.write(f"  WA Messages: {WhatsAppMessage.objects.count()}")
            self.stdout.write(f"  WA Logs: {WhatsAppMessageLog.objects.count()}")
            self.stdout.write(f"  Social Accounts: {SocialAccount.objects.count()}")
            self.stdout.write(f"  Direct Orders: {DirectOrder.objects.count()}")
        except Exception as e:
            self.stdout.write(f"  Could not get summary: {e}")
