"""
Enums shared by the customers module.

Segment names mirror the frontend's `CustomerSegment` union exactly —
any drift breaks the badge renderer.
"""

from django.db import models


class CustomerStatus(models.TextChoices):
    ACTIVE = "Active", "Active"
    BLOCKED = "Blocked", "Blocked"


class CustomerSegment(models.TextChoices):
    VIP = "VIP", "VIP"
    LOYAL = "Loyal", "Loyal"
    NEW = "New", "New"
    AT_RISK = "At Risk", "At Risk"
    CHURNED = "Churned", "Churned"
    REGULAR = "Regular", "Regular"


class MarketingConsent(models.TextChoices):
    SUBSCRIBED = "Subscribed", "Subscribed"
    UNSUBSCRIBED = "Unsubscribed", "Unsubscribed"
    PENDING = "Pending", "Pending"


class SupportTicketStatus(models.TextChoices):
    OPEN = "Open", "Open"
    IN_PROGRESS = "In Progress", "In Progress"
    RESOLVED = "Resolved", "Resolved"
    CLOSED = "Closed", "Closed"


class SupportTicketPriority(models.TextChoices):
    LOW = "Low", "Low"
    MEDIUM = "Medium", "Medium"
    HIGH = "High", "High"
    URGENT = "Urgent", "Urgent"


class CommunicationChannel(models.TextChoices):
    WHATSAPP = "WhatsApp", "WhatsApp"
    EMAIL = "Email", "Email"
    SMS = "SMS", "SMS"
    CALL = "Call", "Call"


class CommunicationDirection(models.TextChoices):
    INBOUND = "Inbound", "Inbound"
    OUTBOUND = "Outbound", "Outbound"


# Segment thresholds — tune once real order data exists.
VIP_SPEND_THRESHOLD = 200_000          # KES
VIP_ORDER_THRESHOLD = 5
LOYAL_ORDER_THRESHOLD = 3
NEW_WINDOW_DAYS = 30
AT_RISK_WINDOW_DAYS = 60
CHURNED_WINDOW_DAYS = 90