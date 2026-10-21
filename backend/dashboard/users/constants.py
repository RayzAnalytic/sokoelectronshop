ROLE_ADMIN     = 'Administrator'
ROLE_MANAGER   = 'Manager'
ROLE_SALES     = 'Sales Staff'
ROLE_INVENTORY = 'Inventory Staff'
ROLE_MARKETING = 'Marketing Staff'
ROLE_SUPPORT   = 'Support Staff'
ROLE_CUSTOMER  = 'Customer'

STAFF_ROLES = [
    ROLE_ADMIN,
    ROLE_MANAGER,
    ROLE_SALES,
    ROLE_INVENTORY,
    ROLE_MARKETING,
    ROLE_SUPPORT,
]

ALL_ROLES = STAFF_ROLES + [ROLE_CUSTOMER]

ROLE_CHOICES        = [(r, r) for r in STAFF_ROLES]
MATRIX_ROLE_CHOICES = [(r, r) for r in ALL_ROLES]


ROLE_DASHBOARD_MAP = {
    ROLE_ADMIN:     '/admin',
    ROLE_MANAGER:   '/admin',
    ROLE_SALES:     '/admin/orders',
    ROLE_INVENTORY: '/admin/inventory',
    ROLE_MARKETING: '/admin/social',
    ROLE_SUPPORT:   '/admin/whatsapp',
    ROLE_CUSTOMER:  '/pages/account',
}


MODULES = {
    'PRODUCTS':   'Products & Catalog',
    'INVENTORY':  'Inventory & Stock',

    'ORDERS':     'Orders',
    'PAYMENTS':   'Payments & M-Pesa',
    'SHIPPING':   'Shipping & Fulfillment',

    'CUSTOMERS':  'Customers & CRM',
    'SUPPORT':    'Support Tickets',

    'CAMPAIGNS':  'Campaigns & Promos',
    'SOCIAL':     'Social & Content',

    'ANALYTICS':  'Analytics & Reports',
    'USERS':      'Users & Roles',

    'MY_ORDERS':  'My Orders',
    'MY_PROFILE': 'My Profile & Wishlist',
}


MODULE_GROUPS = {
    'Catalog': [
        MODULES['PRODUCTS'],
        MODULES['INVENTORY'],
    ],
    'Sales': [
        MODULES['ORDERS'],
        MODULES['PAYMENTS'],
        MODULES['SHIPPING'],
    ],
    'Customers': [
        MODULES['CUSTOMERS'],
        MODULES['SUPPORT'],
    ],
    'Marketing': [
        MODULES['CAMPAIGNS'],
        MODULES['SOCIAL'],
    ],
    'System': [
        MODULES['ANALYTICS'],
        MODULES['USERS'],
    ],
    'Storefront': [
        MODULES['MY_ORDERS'],
        MODULES['MY_PROFILE'],
    ],
}

MODULE_GROUP_ORDER = [
    'Catalog',
    'Sales',
    'Customers',
    'Marketing',
    'System',
    'Storefront',
]


DEFAULT_GRANTS = {
    ROLE_MANAGER: [
        MODULES['PRODUCTS'],
        MODULES['INVENTORY'],
        MODULES['ORDERS'],
        MODULES['PAYMENTS'],
        MODULES['SHIPPING'],
        MODULES['CUSTOMERS'],
        MODULES['SUPPORT'],
        MODULES['CAMPAIGNS'],
        MODULES['SOCIAL'],
        MODULES['ANALYTICS'],
    ],
    ROLE_SALES: [
        MODULES['ORDERS'],
        MODULES['PAYMENTS'],
        MODULES['CUSTOMERS'],
    ],
    ROLE_INVENTORY: [
        MODULES['PRODUCTS'],
        MODULES['INVENTORY'],
    ],
    ROLE_MARKETING: [
        MODULES['CAMPAIGNS'],
        MODULES['SOCIAL'],
        MODULES['ANALYTICS'],
    ],
    ROLE_SUPPORT: [
        MODULES['ORDERS'],
        MODULES['CUSTOMERS'],
        MODULES['SUPPORT'],
    ],
    ROLE_CUSTOMER: [
        MODULES['MY_ORDERS'],
        MODULES['MY_PROFILE'],
    ],
}