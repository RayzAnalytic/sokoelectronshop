from django.db import migrations


ROLES = [
    ('Administrator',   'Full access to storefront operations, staff, orders, products, and reports.',
     'Full store control',     'bg-red-50 text-red-700 border-red-100',          'Crown',        False),
    ('Manager',         'Oversee products, orders, staff, reports, and daily storefront operations.',
     'Operations & reporting', 'bg-blue-50 text-blue-950 border-blue-100',        'Briefcase',    False),
    ('Sales Staff',     'Process orders, manage customers, and handle point-of-sale interactions.',
     'Orders & customers',     'bg-emerald-50 text-emerald-700 border-emerald-100','ShoppingCart', False),
    ('Inventory Staff', 'Manage stock levels, product catalog, suppliers, and warehouse movements.',
     'Stock & catalog',        'bg-amber-50 text-amber-700 border-amber-100',     'Package',      False),
    ('Marketing Staff', 'Run campaigns, manage social presence, promos, and content assets.',
     'Campaigns & content',    'bg-purple-50 text-purple-700 border-purple-100',  'Megaphone',    False),
    ('Support Staff',   'Handle customer queries, tickets, WhatsApp chats, and issue resolution.',
     'Tickets & chats',        'bg-indigo-50 text-indigo-700 border-indigo-100',  'Headphones',   False),
    ('Customer',        'Buyer account with access only to their own orders, wishlist, and profile.',
     'Self-service only',      'bg-slate-50 text-slate-700 border-slate-200',     'UserCircle',   True),
]


PERMISSIONS = [
    ('Products & Catalog',     'Catalog',   {'Administrator': True,  'Manager': True,  'Sales Staff': True,  'Inventory Staff': True,  'Marketing Staff': True,  'Support Staff': False, 'Customer': False}),
    ('Inventory & Stock',      'Catalog',   {'Administrator': True,  'Manager': True,  'Sales Staff': False, 'Inventory Staff': True,  'Marketing Staff': False, 'Support Staff': False, 'Customer': False}),
    ('Orders',                 'Sales',     {'Administrator': True,  'Manager': True,  'Sales Staff': True,  'Inventory Staff': True,  'Marketing Staff': False, 'Support Staff': True,  'Customer': False}),
    ('Payments & M-Pesa',      'Sales',     {'Administrator': True,  'Manager': True,  'Sales Staff': True,  'Inventory Staff': False, 'Marketing Staff': False, 'Support Staff': False, 'Customer': False}),
    ('Customers & CRM',        'Sales',     {'Administrator': True,  'Manager': True,  'Sales Staff': True,  'Inventory Staff': False, 'Marketing Staff': False, 'Support Staff': True,  'Customer': False}),
    ('Shipping & Fulfillment', 'Sales',     {'Administrator': True,  'Manager': True,  'Sales Staff': True,  'Inventory Staff': True,  'Marketing Staff': False, 'Support Staff': True,  'Customer': False}),
    ('Campaigns & Promos',     'Marketing', {'Administrator': True,  'Manager': True,  'Sales Staff': False, 'Inventory Staff': False, 'Marketing Staff': True,  'Support Staff': False, 'Customer': False}),
    ('Social & Content',       'Marketing', {'Administrator': True,  'Manager': True,  'Sales Staff': False, 'Inventory Staff': False, 'Marketing Staff': True,  'Support Staff': False, 'Customer': False}),
    ('Support Tickets',        'Support',   {'Administrator': True,  'Manager': True,  'Sales Staff': False, 'Inventory Staff': False, 'Marketing Staff': False, 'Support Staff': True,  'Customer': False}),
    ('Analytics & Reports',    'Insights',  {'Administrator': True,  'Manager': True,  'Sales Staff': True,  'Inventory Staff': True,  'Marketing Staff': True,  'Support Staff': False, 'Customer': False}),
    ('Users & Roles',          'Admin',     {'Administrator': True,  'Manager': False, 'Sales Staff': False, 'Inventory Staff': False, 'Marketing Staff': False, 'Support Staff': False, 'Customer': False}),
    ('My Orders',              'Customer',  {'Administrator': False, 'Manager': False, 'Sales Staff': False, 'Inventory Staff': False, 'Marketing Staff': False, 'Support Staff': False, 'Customer': True}),
    ('My Profile & Wishlist',  'Customer',  {'Administrator': False, 'Manager': False, 'Sales Staff': False, 'Inventory Staff': False, 'Marketing Staff': False, 'Support Staff': False, 'Customer': True}),
]


def seed(apps, schema_editor):
    Role             = apps.get_model('dashboard_users', 'Role')
    ModulePermission = apps.get_model('dashboard_users', 'ModulePermission')

    for name, desc, scope, color, icon, is_cust in ROLES:
        Role.objects.update_or_create(
            name=name,
            defaults={
                'description': desc,
                'scope': scope,
                'color': color,
                'icon': icon,
                'is_customer': is_cust,
            },
        )

    for module, group, roles in PERMISSIONS:
        for role, granted in roles.items():
            ModulePermission.objects.update_or_create(
                module=module,
                role=role,
                defaults={'group': group, 'granted': granted},
            )


def unseed(apps, schema_editor):
    apps.get_model('dashboard_users', 'Role').objects.all().delete()
    apps.get_model('dashboard_users', 'ModulePermission').objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard_users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
