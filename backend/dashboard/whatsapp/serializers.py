from rest_framework import serializers

from .models import (
    WhatsAppAccount,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
    WhatsAppCartSession,
)


class WhatsAppAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppAccount
        fields = [
            "id", "waba_id", "phone_number_id", "display_phone", "business_name",
            "quality_score", "messaging_limit", "token_expires_at",
            "is_active", "updated_at",
        ]
        read_only_fields = fields


class WhatsAppContactSerializer(serializers.ModelSerializer):
    """
    Read-shape for a contact.

    `userId` is null for walk-in contacts that have never signed up —
    which is most of them in the Kenyan social-commerce case. The admin
    inbox uses this to decide whether to offer "Convert to order"
    (creates a guest order) or "Link to account" (rare, when the buyer
    has an account under a different phone).

    Deliberately does NOT expose the full User object. The admin inbox
    only needs to know *whether* there is an account, not the whole
    account payload. If a page ever needs the customer name for a
    linked account, it can fetch the user separately — keeping this
    serializer small avoids dragging auth metadata (email, is_staff,
    last_login) into a WhatsApp response.
    """
    userId = serializers.IntegerField(              # ── ADDED
        source="user_id",                            # ── ADDED
        read_only=True,                              # ── ADDED
        allow_null=True,                             # ── ADDED
    )                                                # ── ADDED

    class Meta:
        model = WhatsAppContact
        fields = [
            "id",
            "wa_id",
            "profile_name",
            "is_verified",
            "opt_in_status",
            "userId",                                # ── ADDED
            "tags",
            "notes",
            "last_inbound_at",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "last_inbound_at", "userId"]


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppMessage
        fields = [
            "id", "wa_message_id", "direction", "type", "body",
            "status", "error_message", "timestamp",
        ]
        read_only_fields = fields


class WhatsAppConversationSerializer(serializers.ModelSerializer):
    contact = WhatsAppContactSerializer(read_only=True)
    messages = WhatsAppMessageSerializer(many=True, read_only=True)

    class Meta:
        model = WhatsAppConversation
        fields = [
            "id", "contact", "status", "assigned_to",
            "last_message_at", "created_at", "messages",
        ]
        read_only_fields = ["id", "created_at", "last_message_at"]


class WhatsAppTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppTemplate
        fields = [
            "id", "name", "language", "category", "status", "quality",
            "components", "meta_template_id", "last_synced_at", "updated_at",
        ]
        read_only_fields = ["id", "meta_template_id", "last_synced_at", "updated_at"]


class WhatsAppCartSessionSerializer(serializers.ModelSerializer):
    """
    Read-shape for a cart session.

    Used by two callers:

      * The checkout page when the customer opens a handoff link
        (`/checkout/whatsapp/<token>`) — reads `cart_snapshot`,
        `delivery_method`, `expires_at`.

      * The admin inbox when a seller inspects or re-sends a session —
        reads `user` / `isAnonymous` to decide how to render the
        session (walk-in vs account-linked), plus `status` to know
        where in the lifecycle it sits.

    `user` is nullable. When it is null, the session was created by an
    admin on behalf of a WhatsApp contact who has no storefront
    account. `isAnonymous` is the derived boolean the frontend branches
    on — cleaner than asking the client to test `user == null`.

    `cart_snapshot` stays snake_case. It is the one legacy key on this
    serializer, and the checkout page already reads it verbatim. Do
    not rename it without a coordinated frontend change.
    """
    user = serializers.PrimaryKeyRelatedField(      # ── ADDED
        read_only=True,                              # ── ADDED
    )                                                # ── ADDED
    isAnonymous = serializers.BooleanField(         # ── ADDED
        source="is_anonymous",                       # ── ADDED
        read_only=True,                              # ── ADDED
    )                                                # ── ADDED

    class Meta:
        model = WhatsAppCartSession
        fields = [
            "token",
            "user",                                  # ── ADDED
            "isAnonymous",                           # ── ADDED
            "status",
            "delivery_method",
            "coupon_code",
            "cart_snapshot",
            "order",
            "created_at",
            "expires_at",
        ]
        read_only_fields = fields


# ── Input serializers ──

class CartHandoffItemSerializer(serializers.Serializer):
    product_id = serializers.CharField(max_length=64)
    quantity = serializers.IntegerField(min_value=1, max_value=99)


class CartHandoffRequestSerializer(serializers.Serializer):
    items = CartHandoffItemSerializer(many=True, allow_empty=False)
    delivery = serializers.ChoiceField(choices=["standard", "express", "pickup"],
                                       default="standard")
    coupon = serializers.CharField(max_length=32, required=False, allow_blank=True)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)


class OTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)


class OTPConfirmSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(min_length=4, max_length=8)