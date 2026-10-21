from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.apps import apps


@receiver(post_save, sender="catalog.Product")
def ensure_direct_product_wrapper(sender, instance, created, **kwargs):
    if not created:
        return

    DirectProduct = apps.get_model("direct_orders", "DirectProduct")

    DirectProduct.objects.get_or_create(
        product=instance,
        defaults={
            "status": "Active" if getattr(instance, "is_active", True) else "Draft",
            "viral": False,
            "low_stock_threshold": 5,
            "linked_to_website": True,
            "cost_price": 0,
            "reorder_point": 5,
            "reorder_quantity": 10,
            "is_bundle": False,
            "is_preorder": False,
            "commission_rate": 10,
            "tags": [],
            "seo_title": "",
            "seo_description": "",
        },
    )


@receiver(post_save, sender="direct_orders.DirectOrder")
def refresh_customer_stats_on_order(sender, instance, **kwargs):
    if not instance.customer_id:
        return
    try:
        Customer = apps.get_model("direct_orders", "Customer")
        customer = Customer.objects.get(pk=instance.customer_id)
        customer.recompute_stats(save=True)
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.DirectOrderItem")
def refresh_product_stats_on_item(sender, instance, **kwargs):
    if not instance.product_id:
        return
    try:
        DirectProduct = apps.get_model("direct_orders", "DirectProduct")
        product = DirectProduct.objects.get(pk=instance.product_id)
        product.recompute_sales_stats(save=True)
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.InventoryMovement")
def apply_inventory_movement(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.product_id:
        return
    try:
        Product = apps.get_model("catalog", "Product")
        product = Product.objects.get(pk=instance.product_id)
        current = getattr(product, "stock_quantity", 0) or 0
        new_qty = current + int(instance.quantity or 0)
        if new_qty < 0:
            new_qty = 0
        if hasattr(product, "stock_quantity"):
            product.stock_quantity = new_qty
            product.save(update_fields=["stock_quantity"])
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.PurchaseOrderItem")
def recompute_purchase_order_totals(sender, instance, **kwargs):
    if not instance.purchase_order_id:
        return
    try:
        PurchaseOrder = apps.get_model("direct_orders", "PurchaseOrder")
        po = PurchaseOrder.objects.get(pk=instance.purchase_order_id)
        po.recompute_totals(save=True)
    except Exception:
        pass


@receiver(post_delete, sender="direct_orders.PurchaseOrderItem")
def recompute_purchase_order_totals_on_delete(sender, instance, **kwargs):
    if not instance.purchase_order_id:
        return
    try:
        PurchaseOrder = apps.get_model("direct_orders", "PurchaseOrder")
        po = PurchaseOrder.objects.filter(pk=instance.purchase_order_id).first()
        if po:
            po.recompute_totals(save=True)
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.CreatorSale")
def attach_sale_to_payout(sender, instance, **kwargs):
    if not instance.payout_id or not instance.paid:
        return
    try:
        PayoutBatch = apps.get_model("direct_orders", "PayoutBatch")
        batch = PayoutBatch.objects.get(pk=instance.payout_id)
        batch.recompute_totals(save=True)
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.ReturnRequest")
def handle_return_restock(sender, instance, **kwargs):
    if not instance.restock or instance.restocked_at is not None:
        return
    if instance.status not in ("Received", "Refunded"):
        return
    try:
        from django.utils import timezone
        InventoryMovement = apps.get_model("direct_orders", "InventoryMovement")
        order = instance.order
        for item in order.items.select_related("product").all():
            if not item.product_id:
                continue
            InventoryMovement.objects.create(
                product_id=item.product_id,
                variant_id=getattr(item, "variant_id", None),
                kind="return",
                quantity=int(item.quantity or 0),
                reference=instance.reference,
                notes="Auto-restock from return",
            )
        instance.restocked_at = timezone.now()
        instance.save(update_fields=["restocked_at"])
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.Expense")
def log_expense_audit(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        AuditLog = apps.get_model("direct_orders", "AuditLog")
        AuditLog.objects.create(
            action="create",
            entity="Expense",
            entity_id=str(instance.pk),
            summary=f"Expense recorded: {instance.title}",
            diff={
                "amount": str(instance.amount),
                "category": instance.category,
            },
        )
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.PayoutBatch")
def log_payout_audit(sender, instance, **kwargs):
    try:
        AuditLog = apps.get_model("direct_orders", "AuditLog")
        AuditLog.objects.create(
            action="payout",
            entity="PayoutBatch",
            entity_id=str(instance.pk),
            summary=f"Payout {instance.reference} → {instance.status}",
            diff={
                "status": instance.status,
                "total": str(instance.total_amount),
                "items": instance.items_count,
            },
        )
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.ReturnRequest")
def log_return_audit(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        AuditLog = apps.get_model("direct_orders", "AuditLog")
        AuditLog.objects.create(
            action="create",
            entity="ReturnRequest",
            entity_id=str(instance.pk),
            summary=f"Return opened for {instance.order.reference}",
            diff={
                "reason": instance.reason,
                "refund": str(instance.refund_amount),
            },
        )
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.LiveSession")
def notify_team_on_live_scheduled(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.status != "Scheduled":
        return
    try:
        Notification = apps.get_model("direct_orders", "Notification")
        TeamMember = apps.get_model("direct_orders", "TeamMember")
        recipients = TeamMember.objects.filter(
            status="Active",
            role__in=["Owner", "Admin", "Content", "Operations"],
        )
        notes = [
            Notification(
                title=f"LIVE scheduled: {instance.title}",
                body=f"Host: {instance.host_name or '—'}",
                kind="info",
                link="/tiktok-business?tab=LIVE Sessions",
                recipient_id=member.user_id or None,
            )
            for member in recipients
        ]
        if notes:
            Notification.objects.bulk_create(notes, ignore_conflicts=True)
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.Customer")
def flag_cod_risk(sender, instance, **kwargs):
    try:
        if instance.segment == "COD Risk":
            return
        if instance.total_orders >= 3 and instance.lifetime_spend <= 0:
            instance.segment = "COD Risk"
            instance.save(update_fields=["segment"])
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.Campaign")
def link_attribution_to_campaign(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        AttributionLink = apps.get_model("direct_orders", "AttributionLink")
        code = f"CMP-{instance.slug.upper()[:16]}"
        AttributionLink.objects.get_or_create(
            code=code,
            defaults={
                "kind": "utm",
                "label": instance.name,
                "utm_source": "tiktok",
                "utm_medium": "campaign",
                "utm_campaign": instance.slug,
                "campaign_id": instance.pk,
                "is_active": True,
            },
        )
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.ContentPost")
def auto_attach_creator_to_content(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.creator_id:
        return
    try:
        AttributionLink = apps.get_model("direct_orders", "AttributionLink")
        code = f"CNT-{instance.pk}"
        AttributionLink.objects.get_or_create(
            code=code,
            defaults={
                "kind": "code",
                "label": instance.title[:120],
                "creator_id": instance.creator_id,
                "content_id": instance.pk,
                "campaign_id": instance.campaign_id,
                "is_active": True,
            },
        )
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.Creator")
def create_creator_payout_link(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        AttributionLink = apps.get_model("direct_orders", "AttributionLink")
        code = f"CRT-{instance.handle.upper().replace(' ', '_')[:20]}"
        AttributionLink.objects.get_or_create(
            code=code,
            defaults={
                "kind": "code",
                "label": f"{instance.name} referral code",
                "creator_id": instance.pk,
                "is_active": instance.status == "Active",
            },
        )
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.DirectOrder")
def notify_low_stock(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        DirectProduct = apps.get_model("direct_orders", "DirectProduct")
        Notification = apps.get_model("direct_orders", "Notification")
        for item in instance.items.select_related("product").all():
            if not item.product_id:
                continue
            product = DirectProduct.objects.filter(pk=item.product_id).first()
            if not product:
                continue
            catalog = getattr(product, "product", None)
            stock = getattr(catalog, "stock_quantity", 0) if catalog else 0
            threshold = product.low_stock_threshold or 5
            if stock <= threshold:
                Notification.objects.create(
                    title=f"Low stock: {catalog.name if catalog else 'Product'}",
                    body=f"Only {stock} left — reorder point {product.reorder_point}.",
                    kind="warning",
                    link="/tiktok-business?tab=Inventory",
                )
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.InboxMessage")
def bump_conversation_on_message(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        from django.utils import timezone
        InboxConversation = apps.get_model("direct_orders", "InboxConversation")
        convo = InboxConversation.objects.filter(
            pk=instance.conversation_id,
        ).first()
        if not convo:
            return
        convo.last_message_at = instance.created_at or timezone.now()
        if instance.direction == "in":
            convo.unread_count = (convo.unread_count or 0) + 1
            if convo.status == "closed":
                convo.status = "open"
        convo.save(update_fields=["last_message_at", "unread_count", "status", "updated_at"])
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.TeamMember")
def stamp_team_member_joined(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.status != "Active":
        return
    try:
        from django.utils import timezone
        if instance.joined_at is None:
            instance.joined_at = timezone.now()
            instance.save(update_fields=["joined_at"])
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.Review")
def mark_review_ugc(sender, instance, **kwargs):
    if not instance.media_url:
        return
    if instance.is_ugc:
        return
    try:
        instance.is_ugc = True
        instance.save(update_fields=["is_ugc"])
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.Automation")
def stamp_automation_run(sender, instance, **kwargs):
    if instance.status != "Active":
        return
    if instance.last_run_at is None:
        return
    try:
        instance.runs_count = (instance.runs_count or 0) + 1
        instance.save(update_fields=["runs_count"])
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.DirectOrder")
def emit_order_notifications(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        Notification = apps.get_model("direct_orders", "Notification")
        TeamMember = apps.get_model("direct_orders", "TeamMember")
        recipients = TeamMember.objects.filter(
            status="Active",
            role__in=["Owner", "Admin", "Operations", "Support"],
        )
        notes = [
            Notification(
                title=f"New order {instance.reference}",
                body=f"{instance.customer_name} — {instance.total}",
                kind="success",
                link=f"/tiktok-business?tab=Orders&ref={instance.reference}",
                recipient_id=member.user_id or None,
            )
            for member in recipients
        ]
        if notes:
            Notification.objects.bulk_create(notes, ignore_conflicts=True)
    except Exception:
        pass


@receiver(post_save, sender="direct_orders.DirectOrder")
def log_order_status_change(sender, instance, created, **kwargs):
    if created:
        return
    try:
        AuditLog = apps.get_model("direct_orders", "AuditLog")
        AuditLog.objects.create(
            action="status_change",
            entity="DirectOrder",
            entity_id=str(instance.pk),
            summary=f"{instance.reference} → {instance.status}",
            diff={
                "status": instance.status,
                "payment_status": instance.payment_status,
            },
        )
    except Exception:
        pass