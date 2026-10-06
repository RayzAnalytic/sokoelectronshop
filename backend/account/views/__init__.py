"""
account/views/__init__.py

Re-exports every view class so `account/urls.py` can keep using
`views.ClassName` regardless of which file the class physically lives
in. Adding a new view means:

    1. Create or edit its file (e.g. `addresses.py`)
    2. Add an import line below
    3. Add the class name to `__all__`
    4. Add the URL pattern in `account/urls.py`

Never import from the submodules directly in `urls.py` — go through
this package so the URL file stays a single list of routes with no
knowledge of the internal file layout.
"""

from .addresses import (
    AddressDetailView,
    AddressListCreateView,
    AddressSetDefaultView,
)
from .notifications import (
    NotificationClearView,
    NotificationDeleteView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationUnreadCountView,
)
from .orders import (
    OrderClaimView,
    OrderDetailView,
    OrderListView,
    OrderReorderView,
    OrderRejectView,
)
from .overview import OverviewView
from .reviews import (
    PendingReviewListView,
    ReviewDetailView,
    ReviewImageUploadView,
    ReviewListCreateView,
)
from .settings import (
    PreferencesView,
    SettingsView,
)
from .wishlist import (
    WishlistBatchCheckView,
    WishlistBulkAddView,
    WishlistByVariantView,
    WishlistCheckView,
    WishlistClearView,
    WishlistDetailView,
    WishlistListCreateView,
)

__all__ = [
    # Overview
    "OverviewView",

    # Settings
    "SettingsView",
    "PreferencesView",

    # Addresses
    "AddressListCreateView",
    "AddressDetailView",
    "AddressSetDefaultView",

    # Wishlist
    "WishlistListCreateView",
    "WishlistDetailView",
    "WishlistCheckView",
    "WishlistBatchCheckView",
    "WishlistBulkAddView",
    "WishlistByVariantView",
    "WishlistClearView",

    # Orders
    "OrderListView",
    "OrderDetailView",
    "OrderReorderView",
    "OrderRejectView",
    "OrderClaimView",

    # Notifications
    "NotificationListView",
    "NotificationMarkReadView",
    "NotificationDeleteView",
    "NotificationMarkAllReadView",
    "NotificationClearView",
    "NotificationUnreadCountView",

    # Reviews
    "ReviewListCreateView",
    "ReviewDetailView",
    "PendingReviewListView",
    "ReviewImageUploadView",
]