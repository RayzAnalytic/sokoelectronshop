from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
import random

from catalog.models import Product
from dashboard.direct_orders.models import (
    Supplier, Location, Customer, Creator, 
    DirectProduct, CreatorSample, DirectOrder, DirectOrderItem,
    Campaign, InboxConversation
)

class Command(BaseCommand):
    help = 'Seed direct_orders with mock data from main catalog'

    def handle(self, *args, **options):
        self.stdout.write("Seeding direct_orders from main catalog...")

        supplier, _ = Supplier.objects.get_or_create(
            name="Soko Electronics Supplier",
            defaults={
                "phone": "254712345678",
                "email": "supplier@sokoelectronics.co.ke",
                "contact_person": "John Supplier",
                "is_active": True,
            }
        )

        location, _ = Location.objects.get_or_create(
            name="Main Warehouse - Nairobi",
            defaults={
                "kind": "warehouse",
                "address": "Industrial Area, Nairobi",
                "county": "Nairobi",
                "is_default": True,
                "is_active": True,
            }
        )

        creators_data = [
            {"name": "TechQueen KE", "handle": "@techqueen_ke", "platform": "tiktok", "followers": 150000, "niche": "tech"},
            {"name": "Gadget Guy", "handle": "@gadgetguy_ke", "platform": "tiktok", "followers": 89000, "niche": "electronics"},
            {"name": "Nairobi Deals", "handle": "@nairobi_deals", "platform": "tiktok", "followers": 230000, "niche": "deals"},
            {"name": "Phone Review KE", "handle": "@phonereviewke", "platform": "instagram", "followers": 65000, "niche": "phones"},
            {"name": "Soko Influencer", "handle": "@soko_influencer", "platform": "tiktok", "followers": 120000, "niche": "shopping"},
        ]
        creators = []
        for data in creators_data:
            creator, _ = Creator.objects.get_or_create(
                handle=data["handle"],
                defaults={
                    "name": data["name"],
                    "platform": data["platform"],
                    "followers": data["followers"],
                    "niche": data["niche"],
                    "commission_rate": Decimal("0.10"),
                    "status": "Active",
                    "engagement_rate": Decimal(str(random.uniform(3, 8))),
                    "avg_views": random.randint(10000, 50000),
                }
            )
            creators.append(creator)

        customers = []
        fake_names = ["James Mwangi", "Aisha Hassan", "Brian Otieno", "Grace Wanjiku", "Kevin Kipchoge", "Mercy Akinyi", "David Kimani", "Linda Njeri", "Peter Ochieng", "Faith Muthoni", "Samuel Kariuki", "Ann Wambui", "John Kamau", "Mary Atieno", "Daniel Mutiso", "Sarah Chebet", "Michael Oloo", "Jane Wairimu", "Joseph Maina", "Esther Nyambura"]
        for i, name in enumerate(fake_names):
            customer, _ = Customer.objects.get_or_create(
                phone=f"2547{random.randint(10000000, 99999999)}",
                defaults={
                    "name": name,
                    "email": f"{name.lower().replace(' ', '')}{i}@example.com",
                    "county": random.choice(["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu"]),
                    "segment": random.choice(["New", "Repeat", "VIP", "Regular"]),
                    "total_orders": random.randint(0, 5),
                    "lifetime_spend": Decimal(str(random.randint(1000, 50000))),
                    "whatsapp_opt_in": True,
                }
            )
            customers.append(customer)

        main_products = Product.objects.all()
        direct_products = []
        for prod in main_products:
            dp, _ = DirectProduct.objects.get_or_create(
                product=prod,
                defaults={
                    "status": random.choice(["Active", "Active", "Active", "Low Stock"]),
                    "viral": random.choice([True, False, False]),
                    "supplier": supplier,
                    "cost_price": prod.price * Decimal("0.7") if prod.price else Decimal("1000"),
                    "commission_rate": Decimal("0.10"),
                    "direct_sales_count": random.randint(0, 50),
                    "direct_revenue": Decimal(str(random.randint(0, 200000))),
                    "linked_to_website": True,
                }
            )
            if dp.supplier is None:
                dp.supplier = supplier
                dp.save()
            direct_products.append(dp)

        campaign, _ = Campaign.objects.get_or_create(
            slug="black-friday-2024",
            defaults={
                "name": "Black Friday 2024",
                "status": "Active",
                "starts_at": timezone.now() - timezone.timedelta(days=5),
                "ends_at": timezone.now() + timezone.timedelta(days=10),
                "budget": Decimal("100000"),
                "objective": "sales",
            }
        )

        for _ in range(10):
            prod = random.choice(direct_products)
            creator = random.choice(creators)
            CreatorSample.objects.get_or_create(
                creator=creator,
                product=prod,
                defaults={
                    "quantity": 1,
                    "status": random.choice(["Requested", "Approved", "Dispatched", "Delivered"]),
                    "tracking_number": f"TRK{random.randint(100000, 999999)}",
                }
            )

        for i in range(15):
            customer = random.choice(customers)
            creator = random.choice(creators) if random.choice([True, False]) else None
            status = random.choice(["New", "Awaiting Payment", "Paid", "Shipped", "Delivered"])
            payment_status = "paid" if status in ["Paid", "Shipped", "Delivered"] else random.choice(["unpaid", "paid"])
            
            order = DirectOrder.objects.create(
                reference=f"DO-{random.randint(10000, 99999)}",
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                customer=customer,
                source=random.choice(["tiktok_dm", "tiktok_comment", "live", "whatsapp", "phone"]),
                status=status,
                payment_status=payment_status,
                payment_method=random.choice(["mpesa", "cod", "bank"]),
                subtotal=Decimal("0"),
                shipping=Decimal("200"),
                total=Decimal("0"),
                creator=creator,
                campaign=campaign,
            )
            order_products = random.sample(direct_products, k=random.randint(1, min(3, len(direct_products))))
            total = Decimal("0")
            for dp in order_products:
                qty = random.randint(1, 2)
                price = dp.product.price or Decimal("1000")
                subtotal = price * qty
                DirectOrderItem.objects.create(
                    order=order,
                    product=dp,
                    product_name=dp.product.name,
                    sku=dp.product.sku,
                    quantity=qty,
                    price=price,
                    subtotal=subtotal,
                )
                total += subtotal
            order.subtotal = total
            order.total = total + order.shipping
            order.save()

        for _ in range(10):
            customer = random.choice(customers)
            InboxConversation.objects.get_or_create(
                contact_handle=f"@{customer.name.lower().replace(' ', '')[:12]}{random.randint(10,99)}",
                channel=random.choice(["tiktok_dm", "whatsapp", "instagram_dm"]),
                defaults={
                    "status": random.choice(["open", "pending", "converted"]),
                    "subject": f"Inquiry about {random.choice(direct_products).product.name[:20]}",
                    "customer": customer,
                    "contact_name": customer.name,
                    "unread_count": random.randint(0, 3),
                }
            )

        self.stdout.write(self.style.SUCCESS(f"Done: {len(direct_products)} DirectProducts from main catalog, {DirectOrder.objects.count()} orders"))
