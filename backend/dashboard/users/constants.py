# dashboard/users/constants.py

# ─────────────────────────────────────────────────────────────
# ROLES
#
# Two enums live side by side on purpose:
#
#   • ROLE_CHOICES        — the six staff roles. Used by
#                           StaffProfile.role. Customer is never
#                           assignable as a staff role.
#
#   • MATRIX_ROLE_CHOICES — the six staff roles PLUS Customer.
#                           Used by ModulePermission.role. The
#                           permission matrix has a Customer
#                           column even though a Customer can't
#                           hold a StaffProfile.
#
# Keeping them separate prevents both failure modes:
# a Customer sneaking into a StaffProfile, and the Customer
# column going missing from the matrix.
# ─────────────────────────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────
# POST-LOGIN DESTINATION PER ROLE
#
# Fallback landing page. The accept-invite view can override this
# per-user, and if you later compute the landing page from the
# role's first accessible module, do that in the view — not here.
# ─────────────────────────────────────────────────────────────
ROLE_DASHBOARD_MAP = {
    ROLE_ADMIN:     '/admin',
    ROLE_MANAGER:   '/admin',
    ROLE_SALES:     '/admin/orders',
    ROLE_INVENTORY: '/admin/inventory',
    ROLE_MARKETING: '/admin/social',
    ROLE_SUPPORT:   '/admin/whatsapp',
    ROLE_CUSTOMER:  '/pages/account',
}


# ─────────────────────────────────────────────────────────────
# MODULE NAMES
#
# Keys are the internal handle used in Python code
# (e.g. `MODULES['ORDERS']`). Values are the labels shown in the
# permission matrix UI.
#
# The seed migration stores the *value* on
# ModulePermission.module — the frontend's `AdminPermissionRow`
# renders `module` directly, so it needs the human string.
# Code that wants to gate on "orders access" compares against
# MODULES['ORDERS'], which resolves to the same string.
# ─────────────────────────────────────────────────────────────
MODULES = {
    # Catalog
    'PRODUCTS':   'Products & Catalog',
    'INVENTORY':  'Inventory & Stock',

    # Sales
    'ORDERS':     'Orders',
    'PAYMENTS':   'Payments & M-Pesa',
    'SHIPPING':   'Shipping & Fulfillment',

    # Customers
    'CUSTOMERS':  'Customers & CRM',
    'SUPPORT':    'Support Tickets',

    # Marketing
    'CAMPAIGNS':  'Campaigns & Promos',
    'SOCIAL':     'Social & Content',

    # System
    'ANALYTICS':  'Analytics & Reports',
    'USERS':      'Users & Roles',

    # Storefront (Customer column only)
    'MY_ORDERS':  'My Orders',
    'MY_PROFILE': 'My Profile & Wishlist',
}


# ─────────────────────────────────────────────────────────────
# MODULE GROUPS
#
# Defines the seed data shape: which modules belong to which
# group, and the order the groups appear in the matrix.
#
# The Meta ordering on ModulePermission sorts alphabetically, so
# the *display* order comes from this list, not from the query.
# The view reads `MODULE_GROUP_ORDER` to sort before serializing.
#
# `MY_ORDERS` / `MY_PROFILE` live in a separate "Storefront" group
# because they're customer-only — they'll show a checkmark in the
# Customer column and a dash in every staff column.
# ─────────────────────────────────────────────────────────────
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

# Left-to-right column order the frontend's table iterates.
MODULE_GROUP_ORDER = [
    'Catalog',
    'Sales',
    'Customers',
    'Marketing',
    'System',
    'Storefront',
]


# ─────────────────────────────────────────────────────────────
# DEFAULT GRANTS
#
# What each role gets on a fresh install, before any admin edits
# the matrix. The seed migration writes these as the initial
# `granted` values.
#
# Anything not listed here defaults to `granted=False` — safe
# for new modules that get added later.
#
# Administrators are intentionally absent: the model computes
# them as "always everything" and the matrix UI locks the
# Administrator column so it can't be edited.
# ─────────────────────────────────────────────────────────────
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
        # No USERS — only Administrator manages staff.
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