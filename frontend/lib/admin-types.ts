// lib/admin-types.ts

// ─────────────────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────────────────
export interface AdminProductImage {
    id?: number;
    url: string;
    alt_text?: string;
    is_primary?: boolean;
    sort_order?: number;
}

export interface AdminProductFeature {
    id?: number;
    text: string;
    sort_order?: number;
}

export interface AdminProductSpec {
    id?: number;
    key: string;
    value: string;
    sort_order?: number;
}

export interface AdminBrandRef {
    id: number;
    name: string;
}

export interface AdminCategoryRef {
    id: number;
    name: string;
}

export interface AdminProduct {
    id: string;
    name: string;
    slug: string;
    description: string;
    brand: AdminBrandRef;
    category: AdminCategoryRef;
    price: string;
    compare_at_price: string | null;
    stock_quantity: number;
    low_stock_threshold: number;
    featured: boolean;
    best_seller: boolean;
    sales_volume: string;
    sales_count: number;
    promo_end_date: string | null;
    is_active: boolean;
    rating_avg: string;
    review_count: number;
    images: AdminProductImage[];
    features: AdminProductFeature[];
    specs: AdminProductSpec[];
    created_at: string;
    updated_at: string;
}

export interface AdminProductWrite {
    name: string;
    description?: string;
    brand_id: number;
    category_id: number;
    price: string;
    compare_at_price?: string | null;
    stock_quantity: number;
    low_stock_threshold?: number;
    featured?: boolean;
    best_seller?: boolean;
    sales_volume?: string;
    sales_count?: number;
    promo_end_date?: string | null;
    is_active?: boolean;
    images?: {
        url: string;
        alt_text?: string;
        is_primary?: boolean;
        sort_order?: number;
    }[];
    features?: string[];
    specs?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO — shared by Categories and Brands
// ─────────────────────────────────────────────────────────────────────────────
export interface AdminSEO {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
    canonicalUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories — admin shape (nested tree + SEO)
// ─────────────────────────────────────────────────────────────────────────────
export interface AdminCategory {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    productsCount: number;
    status: 'Active' | 'Inactive';
    image: string | null;
    displayOrder: number;
    description: string;
    seo: AdminSEO;
    is_active: boolean;
    icon_name: string;
    children?: AdminCategory[];
}

export interface AdminCategoryWrite {
    name?: string;
    slug?: string;
    parent_id?: number | null;
    description?: string;
    image?: string | null;
    is_active?: boolean;
    sort_order?: number;
    seo?: Partial<AdminSEO>;
    status?: 'Active' | 'Inactive';
    icon_name?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Brands — admin shape
// ─────────────────────────────────────────────────────────────────────────────
export interface AdminBrand {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    is_active: boolean;

    description: string;
    websiteUrl: string;
    featured: boolean;
    productsCount: number;

    salesTotal: number;
    salesGrowth: number;
    customersCount: number;

    seo: AdminSEO;
    created_at: string;
    updated_at: string;
}

export interface AdminBrandWrite {
    name?: string;
    slug?: string;
    logo?: string | null;
    description?: string;
    websiteUrl?: string;
    featured?: boolean;
    is_active?: boolean;
    status?: 'Active' | 'Inactive';
    seo?: Partial<AdminSEO>;
}

// ═════════════════════════════════════════════════════════════════════════════
// NEWSLETTER
// ═════════════════════════════════════════════════════════════════════════════

export interface AdminSubscriberListRef {
    id: number;
    name: string;
    color: string;
}

export interface AdminSubscriber {
    id: number;
    email: string;
    name: string;
    tags: string[];
    source: string;
    is_active: boolean;
    status: 'Subscribed' | 'Unsubscribed';
    lists: AdminSubscriberListRef[];
    subscribed_at: string;
    unsubscribed_at: string | null;
}

export interface AdminSubscriberWrite {
    email?: string;
    name?: string;
    tags?: string[];
    source?: string;
    is_active?: boolean;
}

export interface AdminSubscriberStats {
    total: number;
    active: number;
    unsubscribed: number;
    new_this_month: number;
    churn_rate: number;
}

export interface AdminSubscriberList {
    id: number;
    name: string;
    description: string;
    color: string;
    subscriberCount: number;
    created_at: string;
}

export interface AdminSubscriberListWrite {
    name: string;
    description?: string;
    color?: string;
}

export interface AdminSegment {
    id: string;
    name: string;
    description: string;
    rules: string[];
    count: number;
    color: string;
}

export type AdminTemplateCategory =
    | 'Welcome'
    | 'Promotional'
    | 'Transactional'
    | 'Re-engagement';

export interface AdminEmailTemplate {
    id: number;
    name: string;
    subject: string;
    body: string;
    hero_image_url: string;
    cta_text: string;
    cta_url: string;
    category: AdminTemplateCategory;
    created_at: string;
    updated_at: string;
}

export interface AdminEmailTemplateWrite {
    name?: string;
    subject?: string;
    body?: string;
    hero_image_url?: string;
    cta_text?: string;
    cta_url?: string;
    category?: AdminTemplateCategory;
}

export type AdminCampaignStatusType =
    | 'draft'
    | 'scheduled'
    | 'queued'
    | 'sending'
    | 'sent'
    | 'paused'
    | 'failed';

export type AdminAudienceType = 'all_active' | 'list' | 'segment';

export interface AdminCampaign {
    id: number;
    name: string;
    subject: string;
    hero_image_url: string;
    body: string;
    cta_text: string;
    cta_url: string;
    audience_type: AdminAudienceType;
    audience_id: string;
    audienceLabel: string;
    status: AdminCampaignStatusType;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    unsubRate: number;
    scheduled_at: string | null;
    sent_at: string | null;
    created_at: string;
}

export interface AdminCampaignWrite {
    name: string;
    subject: string;
    hero_image_url?: string;
    body: string;
    cta_text?: string;
    cta_url?: string;
    audience_type: AdminAudienceType;
    audience_id?: string;
    scheduled_at?: string | null;
}

export interface AdminCampaignStatus {
    id: number;
    status: AdminCampaignStatusType;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    sent_at: string | null;
}

export interface AdminCampaignRecipient {
    id: number;
    email: string;
    status: 'queued' | 'sent' | 'failed' | 'bounced';
    error_message: string;
    sent_at: string | null;
}

export interface AdminGrowthPoint {
    month: string;
    subscribers: number;
}

export interface AdminCampaignPerformance {
    name: string;
    open: number;
    click: number;
    bounce: number;
}

export interface AdminAnalyticsSummary {
    delivered_total: number;
    delivery_rate: number;
    avg_open_rate: number;
    avg_click_rate: number;
    avg_unsub_rate: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOMERS (admin mini-CRM)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminCustomerStatus = 'Active' | 'Blocked';

export type AdminCustomerSegment =
    | 'VIP'
    | 'Loyal'
    | 'New'
    | 'At Risk'
    | 'Churned'
    | 'Regular';

export type AdminMarketingConsent =
    | 'Subscribed'
    | 'Unsubscribed'
    | 'Pending';

export interface AdminCustomerFilters {
    search?: string;
    segment?: AdminCustomerSegment;
    orders?: '1' | '2-5' | '5+';
    spent?: '100k+' | '50k-100k' | '<50k';
}

export interface AdminCustomerStats {
    total_customers: number;
    new_this_month: number;
    repeat_rate: number;
    avg_order_value: number;
    total_revenue: number;
}

export interface AdminCustomerRow {
    id: string;
    name: string;
    avatar: string;
    email: string;
    phone: string;
    location: string;
    dateJoined: string;
    ordersCount: number;
    totalSpent: number;
    lastOrderDate: string | null;
    status: AdminCustomerStatus;
    segment: AdminCustomerSegment;
}

export interface AdminCustomerListResponse {
    stats: AdminCustomerStats;
    segment_counts: Record<string, number>;
    results: AdminCustomerRow[];
}

export interface AdminCustomerOrder {
    id: string;
    orderNumber: string;
    date: string;
    itemsCount: number;
    total: number;
    status: string;
    paymentMethod: string;
}

export interface AdminCustomerAddress {
    id: string;
    title: string;
    address: string;
    city: string;
    isDefault: boolean;
}

export interface AdminCustomerNote {
    id: string;
    author: string;
    date: string;
    text: string;
}

export interface AdminCustomerWishlistItem {
    id: string;
    productName: string;
    sku: string;
    price: number;
    addedDate: string;
    image: string;
}

export interface AdminCustomerCartItem {
    id: string;
    productName: string;
    sku: string;
    price: number;
    qty: number;
    addedDate: string;
    image: string;
}

export interface AdminCustomerReview {
    id: string;
    productName: string;
    rating: number;
    comment: string;
    date: string;
    status: 'Published' | 'Pending' | 'Hidden';
}

export interface AdminCustomerTicket {
    id: string;
    subject: string;
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    date: string;
    lastUpdate: string;
}

export interface AdminCustomerCommunication {
    id: string;
    channel: 'WhatsApp' | 'Email' | 'SMS' | 'Call';
    direction: 'Inbound' | 'Outbound';
    subject: string;
    date: string;
    agent: string;
}

export interface AdminCustomerDetail extends AdminCustomerRow {
    mostPurchasedCategory: string;
    preferredPayment: string;
    marketingConsent: AdminMarketingConsent;
    orders: AdminCustomerOrder[];
    addresses: AdminCustomerAddress[];
    notes: AdminCustomerNote[];
    wishlist: AdminCustomerWishlistItem[];
    cart: AdminCustomerCartItem[];
    reviews: AdminCustomerReview[];
    supportTickets: AdminCustomerTicket[];
    communicationLog: AdminCustomerCommunication[];
}

export interface AdminBlockWrite {
    blocked: boolean;
}

export interface AdminConsentWrite {
    consent: AdminMarketingConsent;
}

export interface AdminNoteWrite {
    text: string;
}

export interface AdminWhatsAppWrite {
    message: string;
}

export interface AdminEmailWrite {
    subject: string;
    body: string;
}

export interface AdminAddressWrite {
    title: string;
    address: string;
    city: string;
    isDefault?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// ORDERS (admin fulfillment view)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminOrderStatus =
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'returned'
    | 'cancelled'
    | 'failed';

export type AdminOrderPaymentStatus =
    | 'unpaid'
    | 'paid'
    | 'refunded'
    | 'failed';

export type AdminOrderPaymentMethod = 'MPESA' | 'COD';

export type AdminOrderTab =
    | 'all'
    | 'pending'
    | 'payment_pending'
    | 'paid'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'failed'
    | 'refunded'
    | 'returned';

export interface AdminOrderFilters {
    tab?: AdminOrderTab;
    search?: string;
    payment_status?: AdminOrderPaymentStatus;
    date_from?: string;
    date_to?: string;
}

export interface AdminOrderStats {
    total_orders: number;
    active_orders: number;
    pending_orders: number;
    shipped_orders: number;
    delivered_orders: number;
    unpaid_orders: number;
    failed_payments: number;
    revenue_today: string;
    revenue_month: string;
}

export interface AdminOrderTabCounts {
    all: number;
    pending: number;
    payment_pending: number;
    paid: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    failed: number;
    refunded: number;
    returned: number;
}

export interface AdminOrderPreviewItem {
    image: string;
    name: string;
    quantity: number;
}

export interface AdminOrderRow {
    id: string;
    reference: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    item_count: number;
    preview_items: AdminOrderPreviewItem[];
    total: string;
    payment_method: string;
    payment_status: AdminOrderPaymentStatus;
    payment_status_label: string;
    status: AdminOrderStatus;
    date: string;
}

export interface AdminOrderListResponse {
    results: AdminOrderRow[];
}

export interface AdminOrderItem {
    id: number;
    product_id: string;
    name: string;
    brand: string;
    price: string;
    quantity: number;
    subtotal: string;
    image: string;
}

export interface AdminOrderStatusEvent {
    id: number;
    to_status: AdminOrderStatus;
    status_label: string;
    from_status: string;
    from_label: string;
    actor_label: string;
    note: string;
    created_at: string;
}

export interface AdminOrderPayment {
    id: string;
    status:
    | 'PENDING'
    | 'PROCESSING'
    | 'SUCCESS'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMEOUT';
    amount: string;
    phone_number: string;
    mpesa_receipt_number: string;
    checkout_request_id: string;
    merchant_request_id: string;
    result_code: number | null;
    result_description: string;
    created_at: string;
    updated_at: string;
}

export interface AdminOrderDetail {
    id: string;
    reference: string;

    customer_name: string;
    customer_phone: string;
    customer_email: string;

    status: AdminOrderStatus;
    status_label: string;
    payment_status: AdminOrderPaymentStatus;
    payment_status_label: string;
    payment_method: string;

    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    total: string;

    coupon_code: string;

    notes: string;
    internal_notes: string;

    delivery_method: string;
    estimated_delivery: string;

    courier: string;
    tracking_number: string;

    contact_email: string;
    contact_phone: string;

    items: AdminOrderItem[];
    timeline: AdminOrderStatusEvent[];
    payments: AdminOrderPayment[];

    snapshot: Record<string, unknown>;

    created_at: string;
    updated_at: string;
}

export interface AdminOrderStatusWrite {
    status: AdminOrderStatus;
    note?: string;
}

export interface AdminOrderTrackingWrite {
    courier?: string;
    tracking_number?: string;
}

export interface AdminOrderRefundWrite {
    amount?: string | number;
    reason?: string;
}

export interface AdminOrderNoteWrite {
    text: string;
}

export interface AdminOrderWhatsAppWrite {
    message: string;
}

export interface AdminOrderExportWrite extends AdminOrderFilters { }

export interface AdminOrderExportResponse {
    csv: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═════════════════════════════════════════════════════════════════════════════

export type AdminSupplierStatus = 'Active' | 'Inactive';

export type AdminSupplierType =
    | 'Manufacturer'
    | 'Distributor'
    | 'Wholesaler'
    | 'Importer'
    | 'Retailer';

export type AdminPurchasePaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

export type AdminPurchaseStatus = 'Received' | 'Pending' | 'Cancelled';

export type AdminSupplierActivityType =
    | 'created'
    | 'product_added'
    | 'purchase_recorded'
    | 'updated';

export interface AdminSupplierProduct {
    id: number;
    productId: string;
    name: string;
    sku: string;
    image: string;
    category: string;
    currentStock: number;
    supplierSku: string;
    costPrice: number;
    minOrderQty: number;
    leadTimeDays: number;
    lastPurchasePrice: number;
    lastPurchaseDate: string | null;
}

export interface AdminPurchase {
    id: number;
    number: string;
    date: string;
    itemsCount: number;
    totalQty: number;
    totalAmount: number;
    paymentStatus: AdminPurchasePaymentStatus;
    status: AdminPurchaseStatus;
}

export interface AdminSupplierActivity {
    id: number;
    type: AdminSupplierActivityType;
    description: string;
    user: string;
    date: string;
}

export interface AdminSupplier {
    id: number;

    name: string;
    company: string;
    type: AdminSupplierType;

    phone: string;
    email: string;
    website: string;

    country: string;
    county: string;
    city: string;
    address: string;

    taxPin: string;
    regNumber: string;
    paymentTerms: string;
    paymentMethod: string;

    notes: string;
    status: AdminSupplierStatus;
    createdAt: string;

    products: AdminSupplierProduct[];
    purchases: AdminPurchase[];
    activity: AdminSupplierActivity[];
}

export interface AdminSupplierWrite {
    name: string;
    company: string;
    type: AdminSupplierType;
    phone?: string;
    email?: string;
    website?: string;
    country?: string;
    county?: string;
    city?: string;
    address?: string;
    taxPin?: string;
    regNumber?: string;
    paymentTerms?: string;
    paymentMethod?: string;
    notes?: string;
    status?: AdminSupplierStatus;
}

export interface AdminSupplierProductInput {
    productId: string;
    name: string;
    sku?: string;
    image?: string;
    category?: string;
    supplierSku?: string;
    costPrice?: number;
    minOrderQty?: number;
    leadTimeDays?: number;
    lastPurchasePrice?: number;
    lastPurchaseDate?: string | null;
}

export interface AdminPurchaseInput {
    number: string;
    date: string;
    itemsCount?: number;
    totalQty?: number;
    totalAmount?: number;
    paymentStatus?: AdminPurchasePaymentStatus;
    status?: AdminPurchaseStatus;
}

// ═════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═════════════════════════════════════════════════════════════════════════════

export type AdminStockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export type AdminStockMovementReason =
    | 'sale'
    | 'restock'
    | 'adjustment'
    | 'damage'
    | 'return'
    | 'correction'
    | 'transfer_in'
    | 'transfer_out';

export type AdminAdjustType = 'Add' | 'Remove' | 'Set';

export interface AdminInventoryItem {
    id: string;
    name: string;
    sku: string;
    image: string;
    category: string;
    brand: string;
    currentStock: number;
    threshold: number;
    status: AdminStockStatus;
    reserved: number;
    available: number;
}

export interface AdminStockMovement {
    id: number;
    date: string;
    productName: string;
    sku: string;
    type: AdminStockMovementReason;
    quantity: number;
    reference: string;
    user: string;
    notes: string;
}

export interface AdminInventoryAdjustInput {
    productId: string;
    type: AdminAdjustType;
    quantity: number;
    reason?: string;
    notes?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS (moderation)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminReviewStatus = 'Pending' | 'Approved' | 'Rejected';
export type AdminReviewFlagStatus = 'none' | 'flagged' | 'resolved';
export type AdminReviewRating = 1 | 2 | 3 | 4 | 5;

export interface AdminReviewReply {
    id: string;
    author: string;
    date: string;
    text: string;
}

export interface AdminReview {
    id: string;

    productId: string;
    productName: string;
    productImage: string;
    productSlug: string;
    productBrand: string;

    customerId: string;
    customerName: string;
    customerEmail: string;

    rating: AdminReviewRating;
    comment: string;
    title: string;
    images: string[];

    date: string;

    status: AdminReviewStatus;
    rejectionReason: string;
    verifiedPurchase: boolean;

    flagStatus: AdminReviewFlagStatus;
    flagReason: string;

    helpfulCount: number;

    replies: AdminReviewReply[];
}

export interface AdminReviewFilters {
    status?: AdminReviewStatus | 'all';
    rating?: AdminReviewRating;
    verified?: boolean;
    flagged?: boolean;
    search?: string;
}

export interface AdminReviewRatingBucket {
    stars: number;
    count: number;
    percentage: number;
}

export interface AdminReviewStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    flagged: number;
    verified: number;
    averageRating: number;
    ratingDistribution: AdminReviewRatingBucket[];
}

export interface AdminRejectReviewWrite {
    reason?: string;
}

export interface AdminFlagReviewWrite {
    reason?: string;
}

export interface AdminReplyReviewWrite {
    text: string;
}

export interface AdminBulkReviewWrite {
    action: 'approve' | 'reject' | 'flag' | 'delete';
    ids: number[];
    reason?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// DISCOUNTS (dashboard promotions)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminDiscountStatus =
    | 'Active'
    | 'Scheduled'
    | 'Expired'
    | 'Draft'
    | 'Paused';

export type AdminDiscountType =
    | 'Percentage'
    | 'Fixed Amount'
    | 'Free Shipping'
    | 'BOGO'
    | 'Bundle'
    | 'Tiered';

export type AdminDiscountAppliesTo =
    | 'Entire Order'
    | 'Specific Products'
    | 'Specific Categories'
    | 'Exclude Products';

export type AdminDiscountEligibility =
    | 'All Customers'
    | 'New Customers Only'
    | 'Repeat Customers Only'
    | 'Specific Tags'
    | 'Specific Customers';

export type AdminDiscountChannel = 'Website' | 'WhatsApp' | 'TikTok';

export type AdminDiscountSource =
    | 'campaign'
    | 'clearance'
    | 'manual'
    | 'auto_slow_moving';

export type AdminDiscountPromotionType =
    | 'Percentage Discount'
    | 'Fixed Amount Discount'
    | 'Sale Price'
    | 'Campaign'
    | 'Flash Sale'
    | 'Free Shipping'
    | 'BOGO'
    | 'Bundle Discount'
    | 'Tiered Discount';

export interface AdminDiscount {
    id: number;

    code: string;
    description: string;
    dealTitle: string;
    badgeText: string;

    type: AdminDiscountType;
    value: string;
    minOrder: number;
    maxCap: number;
    promotionType: AdminDiscountPromotionType;

    usageLimit: number;
    perCustomer: number;
    usageCount: number;

    startDate: string;
    endDate: string | null;

    appliesTo: AdminDiscountAppliesTo;
    eligibility: AdminDiscountEligibility | string;
    targetAudience: string;
    linkedProductIds: string[];
    linkedCategories: string[];

    status: AdminDiscountStatus;

    source: AdminDiscountSource;
    isAutomatic: boolean;
    isClearance: boolean;
    expiresWhenSoldOut: boolean;

    image: string;
    displayOnDealsPage: boolean;
    isMostDeal: boolean;
    priority: number;

    channels: AdminDiscountChannel[];
    tiktokVideo: string;
}

export interface AdminDiscountWrite {
    code: string;
    description?: string;
    dealTitle?: string;
    badgeText?: string;

    type: AdminDiscountType;
    value: string;
    minOrder?: number;
    maxCap?: number;
    promotionType?: AdminDiscountPromotionType;

    usageLimit?: number;
    perCustomer?: number;

    startDate: string;
    endDate?: string | null;

    appliesTo: AdminDiscountAppliesTo;
    eligibility?: AdminDiscountEligibility | string;
    targetAudience?: string;
    linkedCategories?: string[];
    linkedProductIds?: string[];

    status?: AdminDiscountStatus;

    isAutomatic?: boolean;
    isClearance?: boolean;
    expiresWhenSoldOut?: boolean;

    image?: string;
    displayOnDealsPage?: boolean;
    isMostDeal?: boolean;
    priority?: number;

    channels?: AdminDiscountChannel[];
    tiktokVideo?: string;
}

export interface AdminDiscountFilters {
    status?: AdminDiscountStatus;
    type?: AdminDiscountType;
    channel?: AdminDiscountChannel;
    search?: string;
}

export interface AdminDiscountSlowMover {
    id: string;
    name: string;
    brand: string;
    category: string;
    price: string;
    stock_quantity: number;
    sales_count: number;
    daysSinceListed: number;
    stockValue: string;
    suggestedDiscountPct: number;
}

export interface AdminBulkClearanceWrite {
    product_ids: string[];
    percent_off: number;
    expires_when_sold_out?: boolean;
    title?: string;
}

export interface AdminDiscountAnalytics {
    kpis: {
        total_discounts_given: number;
        total_redemptions: number;
        revenue_from_discounts: number;
        aov_discounted: number;
        aov_regular: number;
        active_discounts: number;
    };
    redemptions_over_time: Array<{ day: string; redemptions: number }>;
    revenue_by_discount: Array<{ name: string; revenue: number }>;
    type_breakdown: Array<{ name: string; value: number; color: string }>;
    channel_breakdown: Array<{ name: string; value: number; color: string }>;
    top_discounts: Array<{
        code: string;
        type: string;
        redemptions: number;
        revenue: number;
        discount_given: number;
        roi: number;
    }>;
}

export interface AdminDiscountAnalyticsSummary {
    total_discounts_given: number;
    total_redemptions: number;
    revenue_from_discounts: number;
    aov_discounted: number;
    aov_regular: number;
    active_discounts: number;
}

export interface AdminDiscountRule {
    name: string;
    example: string;
}

export interface AdminDiscountRules {
    conditions: AdminDiscountRule[];
    actions: AdminDiscountRule[];
}

// ═════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS (financial ledger)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminTransactionStatus =
    | 'Success'
    | 'Pending'
    | 'Failed'
    | 'Reversed';

export type AdminTransactionMethod = 'MPESA' | 'COD';

export type AdminTransactionDateRange =
    | 'Today'
    | 'Yesterday'
    | 'Last 7 Days'
    | 'Last 30 Days';

export interface AdminTransactionTimelineEvent {
    title: string;
    time: string;
    status: 'completed' | 'active' | 'failed';
}

export interface AdminTransactionReversal {
    id: string;
    status: AdminTransactionStatus;
    createdAt: string;
    reason: string;
}

export interface AdminTransaction {
    id: string;

    ref: string;
    orderNumber: string;

    amount: string;
    fee: string;

    phoneNumber: string;

    status: AdminTransactionStatus;
    responseCode: string;
    responseDesc: string;

    date: string;

    customerName: string;
    customerEmail: string;

    merchantRequestId: string;
    checkoutRequestId: string;

    payload: Record<string, unknown>;
    timeline: AdminTransactionTimelineEvent[];

    method: AdminTransactionMethod;
    settledAt: string | null;
    reversals: AdminTransactionReversal[];
}

export interface AdminTransactionMethodBreakdown {
    label: string;
    successful: string;
    pending: string;
    failed: string;
    fees: string;
    count: number;
}

export interface AdminTransactionSummary {
    totalSuccessful: string;
    totalPending: string;
    totalFailed: string;
    totalFees: string;
    netAmount: string;
    transactionCount: number;
    perMethod: Record<AdminTransactionMethod, AdminTransactionMethodBreakdown>;
}

export interface AdminTransactionFilters {
    q?: string;
    status?: AdminTransactionStatus;
    method?: AdminTransactionMethod;
    dateRange?: AdminTransactionDateRange;
    minAmount?: string;
    maxAmount?: string;
}

export interface AdminRetryWrite {
    phone_number?: string;
}

export interface AdminReconcileWrite {
    status: 'Matched' | 'Unmatched';
    orderNumber?: string;
    note?: string;
}

export interface AdminBulkExportWrite {
    ids: string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// SHIPPING (admin configuration + tracking)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminKenyaRegions = Record<string, string[]>;

export interface AdminShippingRate {
    id: number;
    methodName: string;
    price: number;
    eta: string;
    freeShippingThreshold: number | null;
}

export interface AdminShippingZone {
    id: number;
    name: string;
    region: string;
    counties: string[];
    rates: AdminShippingRate[];
}

export interface AdminShippingZoneWrite {
    name: string;
    region: string;
    counties: string[];
}

export interface AdminShippingRateWrite {
    methodName: string;
    price: number | string;
    eta?: string;
    freeShippingThreshold?: number | string | null;
}

export type AdminShippingMethodStatus = 'Active' | 'Disabled';

export interface AdminShippingMethod {
    id: number;
    name: string;
    description: string;
    defaultPrice: number;
    eta: string;
    status: AdminShippingMethodStatus;
}

export type AdminPickupLocationType = 'Locker' | 'Agent' | 'Store';
export type AdminPickupLocationStatus = 'Active' | 'Disabled';

export interface AdminPickupLocation {
    id: number;
    name: string;
    type: AdminPickupLocationType;
    address: string;
    county: string;
    phone: string;
    hours: string;
    status: AdminPickupLocationStatus;
}

export interface AdminPickupLocationWrite {
    name: string;
    type: AdminPickupLocationType;
    address: string;
    county: string;
    phone?: string;
    hours?: string;
}

export type AdminShipmentStatus =
    | 'Pending'
    | 'Label Created'
    | 'Picked Up'
    | 'In Transit'
    | 'Out for Delivery'
    | 'Delivered'
    | 'Failed'
    | 'Returned';

export interface AdminShipment {
    id: number;
    orderNumber: string;
    customerName: string;
    method: string;
    provider: string;
    trackingNumber: string;
    status: AdminShipmentStatus;
    destination: string;
    updatedAt: string;
}

export interface AdminShipmentStatusWrite {
    status: AdminShipmentStatus;
    note?: string;
}

export interface AdminCourierConfig {
    id: string;
    name: string;
    logoBg: string;
    description: string;
    apiKey: string;
    enabled: boolean;
    regions: string[];
}

export interface AdminCourierTestResult {
    ok: boolean;
    message: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// WHATSAPP (business messaging)
// ═════════════════════════════════════════════════════════════════════════════

export type WhatsAppQualityScore = 'GREEN' | 'YELLOW' | 'RED';

export type WhatsAppTemplateCategory =
    | 'UTILITY'
    | 'MARKETING'
    | 'AUTHENTICATION';

export type WhatsAppTemplateStatus =
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'PAUSED';

export type WhatsAppConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED';

export type WhatsAppMessageDirection = 'IN' | 'OUT';

export type WhatsAppMessageStatus =
    | 'QUEUED'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'FAILED';

export type WhatsAppOptInStatus = 'SUBSCRIBED' | 'UNSUBSCRIBED';

export type WhatsAppAutomationStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';

export type WhatsAppBroadcastStatus =
    | 'DRAFT'
    | 'SCHEDULED'
    | 'SENDING'
    | 'PAUSED'
    | 'COMPLETED'
    | 'FAILED';

export type WhatsAppCartSessionStatus =
    | 'CREATED'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'OPENED'
    | 'ORDERED'
    | 'EXPIRED'
    | 'FAILED';

export type WhatsAppVerificationStatus =
    | 'VERIFIED'
    | 'UNVERIFIED'
    | 'PENDING';

export type WhatsAppAutomationRecipients =
    | 'CUSTOMER'
    | 'ADMIN_TEAM'
    | 'BOTH';

export interface AdminWhatsAppAccount {
    id: number;
    wabaId: string;
    phoneNumberId: string;
    displayPhone: string;
    businessName: string;
    qualityScore: WhatsAppQualityScore;
    messagingLimit: string;
    isActive: boolean;
    tokenExpiresAt: string | null;
    tokenDaysLeft: number | null;
    verifiedName: string;
    verificationStatus: WhatsAppVerificationStatus;
    updatedAt: string;
}

export interface AdminWhatsAppAccountWrite {
    wabaId: string;
    phoneNumberId: string;
    displayPhone: string;
    businessName?: string;
    accessToken: string;
    appSecret?: string;
    verifyToken: string;
    tokenExpiresAt?: string | null;
}

export interface AdminWhatsAppContact {
    id: number;
    waId: string;
    profileName: string;
    userId: number | null;
    isVerified: boolean;
    optInStatus: WhatsAppOptInStatus;
    tags: string[];
    notes: string;
    lastInboundAt: string | null;
    createdAt: string;
}

export interface AdminWhatsAppContactDetail extends AdminWhatsAppContact {
    conversations: AdminWhatsAppConversation[];
    orders: Array<{
        reference: string;
        total: string;
        status: string;
        createdAt: string;
    }>;
    cartSessions: Array<{
        token: string;
        status: WhatsAppCartSessionStatus;
        createdAt: string;
    }>;
}

export interface AdminWhatsAppContactFilters {
    search?: string;
    optInStatus?: WhatsAppOptInStatus;
    verified?: boolean;
    tag?: string;
}

export interface AdminWhatsAppContactWrite {
    tags?: string[];
    notes?: string;
    optInStatus?: WhatsAppOptInStatus;
}

export interface AdminWhatsAppMessage {
    id: number;
    waMessageId: string | null;
    direction: WhatsAppMessageDirection;
    type: string;
    body: string;
    status: WhatsAppMessageStatus;
    errorMessage: string;
    timestamp: string;
}

export interface AdminWhatsAppConversation {
    id: number;
    contact: AdminWhatsAppContact;
    status: WhatsAppConversationStatus;
    assignedTo: number | null;
    assignedToName: string;
    lastMessageAt: string | null;
    createdAt: string;
    lastMessagePreview: string;
}

export interface AdminWhatsAppConversationDetail
    extends AdminWhatsAppConversation {
    messages: AdminWhatsAppMessage[];
    windowOpen: boolean;
}

export interface AdminWhatsAppConversationFilters {
    tab?: 'all' | 'unassigned' | 'mine' | 'open' | 'resolved';
    search?: string;
    assignedTo?: string | number;
    tag?: string;
}

export interface AdminWhatsAppMessageWrite {
    body: string;
}

export interface AdminWhatsAppAssignWrite {
    userId: number | null;
}

export interface AdminWhatsAppResolveWrite {
    note?: string;
}

export interface AdminWhatsAppTagWrite {
    tag: string;
    action: 'add' | 'remove';
}

export interface AdminWhatsAppNoteWrite {
    text: string;
}

export interface AdminWhatsAppTemplate {
    id: number;
    name: string;
    language: string;
    category: WhatsAppTemplateCategory;
    status: WhatsAppTemplateStatus;
    quality: WhatsAppQualityScore | 'UNKNOWN';
    components: unknown[];
    metaTemplateId: string;
    lastSyncedAt: string | null;
    updatedAt: string;
}

export interface AdminWhatsAppTemplateWrite {
    name: string;
    language: string;
    category: WhatsAppTemplateCategory;
    components: unknown[];
}

export interface AdminWhatsAppTemplateSyncResult {
    added: number;
    updated: number;
    total: number;
}

export interface AdminWhatsAppAutomation {
    id: number;
    name: string;
    trigger: string;
    templateId: number | null;
    templateName: string;
    delayMinutes: number;
    recipients: WhatsAppAutomationRecipients;
    conditions: string;
    status: WhatsAppAutomationStatus;
    messagesSent: number;
    lastTriggered: string | null;
    createdAt: string;
}

export interface AdminWhatsAppAutomationWrite {
    name: string;
    trigger: string;
    templateId: number;
    delayMinutes: number;
    recipients: WhatsAppAutomationRecipients;
    conditions?: string;
}

export interface AdminWhatsAppAutomationToggleWrite {
    note?: string;
}

export interface AdminWhatsAppBroadcast {
    id: number;
    campaignName: string;
    templateName: string;
    audienceLabel: string;
    recipients: number;
    delivered: number;
    read: number;
    replied: number;
    scheduledAt: string | null;
    sentAt: string | null;
    status: WhatsAppBroadcastStatus;
    createdAt: string;
}

export interface AdminWhatsAppBroadcastWrite {
    campaignName: string;
    templateName: string;
    audience: string;
    scheduledAt?: string | null;
}

export interface AdminWhatsAppBroadcastFilters {
    status?: WhatsAppBroadcastStatus;
    search?: string;
}

export interface AdminWhatsAppBroadcastStats {
    recipients: number;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    percentComplete: number;
}

export interface AdminWhatsAppAnalyticsSummary {
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    totalCostKes: string;
    deliveryRate: number;
    readRate: number;
    responseRate: number;
    periodStart: string;
    periodEnd: string;
}

export interface AdminWhatsAppAnalyticsSeries {
    days: Array<{
        day: string;
        sent: number;
        delivered: number;
        read: number;
        replies: number;
    }>;
}

export interface AdminWhatsAppCostBreakdown {
    buckets: Array<{
        name: 'Utility' | 'Marketing' | 'Authentication' | 'Service (Free)';
        value: number;
        color: string;
    }>;
    totalKes: string;
}

export interface AdminWhatsAppBillingSummary {
    month: string;
    totalKes: string;
    utilityKes: string;
    marketingKes: string;
    authKes: string;
    serviceKes: string;
    utilityCount: number;
    marketingCount: number;
    authCount: number;
    serviceCount: number;
    freeServiceUsed: number;
    freeServiceLimit: number;
    lastSyncedAt: string;
}

export interface AdminWhatsAppOtpRequestWrite {
    phone: string;
}

export interface AdminWhatsAppOtpConfirmWrite {
    phone: string;
    code: string;
}

export interface AdminWhatsAppOtpConfirmResult {
    verified: boolean;
    waId: string;
    contactId: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// SOCIAL MEDIA HUB
// ═════════════════════════════════════════════════════════════════════════════

export type AdminSocialPlatform =
    | 'Facebook'
    | 'Instagram'
    | 'TikTok'
    | 'YouTube'
    | 'X';

export interface AdminSocialAccount {
    id: AdminSocialPlatform;
    name: string;
    handle: string;
    connected: boolean;
    avatarBg: string;
}

export interface AdminSocialScheduledPost {
    id: string;
    platforms: AdminSocialPlatform[];
    caption: string;
    scheduledTime: string;
    productTag?: string | null;
    mediaUrl?: string | null;
}

export interface AdminSocialPublishedPost {
    id: string;
    platform: AdminSocialPlatform;
    caption: string;
    publishedAt: string | null;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
}

export interface AdminSocialMedia {
    id: number;
    url: string;
    mediaType: 'IMAGE' | 'VIDEO';
    filename: string;
    sizeBytes: number;
    sortOrder: number;
}

export interface AdminSocialPostWrite {
    caption: string;
    platforms: AdminSocialPlatform[];
    productTag?: string;
    mediaIds?: number[];
    scheduleAt?: string | null;
}

export interface AdminSocialPostCreated {
    id: number;
    status: string;
}

export interface AdminSocialFollowerPoint {
    month: string;
    Facebook: number;
    Instagram: number;
    TikTok: number;
    YouTube: number;
    X: number;
}

export interface AdminSocialEngagementPoint {
    platform: AdminSocialPlatform;
    Reach: number;
    Engagement: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// DIRECT ORDERS (social commerce back-office)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminDirectOrderStatus =
    | 'New'
    | 'Awaiting Payment'
    | 'Paid'
    | 'Awaiting Shipment'
    | 'Shipped'
    | 'Delivered'
    | 'Cancelled'
    | 'Returned';

export type AdminDirectOrderSource = 'whatsapp' | 'admin' | 'phone';

export type AdminDirectContentPlatform =
    | 'TikTok'
    | 'Instagram'
    | 'Facebook'
    | 'YouTube'
    | 'X';

export type AdminDirectContentStatus =
    | 'Draft'
    | 'Scheduled'
    | 'Posted'
    | 'Archived';

export type AdminDirectLiveStatus =
    | 'Scheduled'
    | 'Live'
    | 'Ended'
    | 'Cancelled';

export type AdminDirectCreatorStatus = 'Active' | 'Inactive';

export type AdminDirectProductStatus = 'Active' | 'Draft' | 'Archived';

export interface AdminDirectOrderItem {
    id: number;
    productId: string;
    productName: string;
    sku: string;
    image: string;
    quantity: number;
    price: string;
    subtotal: string;
}

export interface AdminDirectOrder {
    id: string;
    reference: string;

    customerName: string;
    customerPhone: string;
    customerEmail: string;

    source: AdminDirectOrderSource;

    status: AdminDirectOrderStatus;
    backendStatus: string;
    paymentStatus: string;
    paymentMethod: string;

    subtotal: string;
    shipping: string;
    discount: string;
    total: string;

    itemCount: number;
    items: AdminDirectOrderItem[];

    creatorId: number | null;
    creatorName: string;
    commission: string;

    notes: string;

    createdAt: string;
    updatedAt: string;
    deliveredAt: string | null;
}

export interface AdminDirectOrderAdvanceWrite {
    status: AdminDirectOrderStatus | string;
    note?: string;
}

export interface AdminDirectCreator {
    id: number;
    name: string;
    handle: string;
    platform: AdminDirectContentPlatform | string;
    avatar: string;

    phone: string;
    email: string;

    commissionRate: number;
    commissionOwed: string;
    revenue: string;
    ordersCount: number;

    status: AdminDirectCreatorStatus;
    joinedAt: string;
}

export interface AdminDirectCreatorWrite {
    name: string;
    handle?: string;
    platform?: AdminDirectContentPlatform | string;
    avatar?: string;
    phone?: string;
    email?: string;
    commissionRate?: number;
    status?: AdminDirectCreatorStatus;
}

export interface AdminDirectContent {
    id: number;

    title: string;
    caption: string;

    platform: AdminDirectContentPlatform;
    mediaUrl: string;
    thumbnailUrl: string;
    videoUrl: string;

    productId: number | null;
    productName: string;

    creatorId: number | null;
    creatorName: string;

    status: AdminDirectContentStatus;
    scheduledAt: string | null;
    postedAt: string | null;

    views: number;
    likes: number;
    comments: number;
    shares: number;

    createdAt: string;
}

export interface AdminDirectContentWrite {
    title: string;
    caption?: string;
    platform?: AdminDirectContentPlatform;
    mediaUrl?: string;
    thumbnailUrl?: string;
    videoUrl?: string | null;
    productId?: number | null;
    productName?: string;
    creatorId?: number | null;
    status?: AdminDirectContentStatus;
    scheduledAt?: string | null;
}

export interface AdminDirectLive {
    id: number;

    title: string;
    description: string;

    platform: AdminDirectContentPlatform | string;
    hostName: string;
    thumbnailUrl: string;

    status: AdminDirectLiveStatus;
    scheduledAt: string | null;
    startedAt: string | null;
    endedAt: string | null;

    viewers: number;
    peakViewers: number;
    ordersCount: number;
    revenue: string;

    productIds: number[];

    createdAt: string;
}

export interface AdminDirectLiveWrite {
    title: string;
    description?: string;
    platform?: AdminDirectContentPlatform | string;
    hostName?: string;
    thumbnailUrl?: string;
    scheduledAt?: string | null;
    status?: AdminDirectLiveStatus;
    productIds?: number[];
}

export interface AdminDirectProduct {
    id: number;

    name: string;
    sku: string;
    image: string;

    price: string;
    compareAtPrice: string | null;
    stockQuantity: number;

    category: string;
    brand: string;

    commissionRate: number;

    status: AdminDirectProductStatus;
    listedAt: string;

    directSalesCount: number;
    directRevenue: string;
}

export interface AdminDirectProductWrite {
    name: string;
    sku?: string;
    image?: string;
    price: string;
    compareAtPrice?: string | null;
    stockQuantity?: number;
    category?: string;
    brand?: string;
    commissionRate?: number;
    status?: AdminDirectProductStatus;
}

export interface AdminDirectCreateOrderWrite {
    items: Array<{
        productId: string | number;
        quantity: number;
    }>;
    paymentMethod: 'MPESA' | 'COD';
    customerName?: string;
    customerPhone?: string;
    notes?: string;
}

export interface AdminDirectSendCheckoutLinkWrite {
    items?: Array<{
        productId: string | number;
        quantity: number;
    }>;
    message?: string;
    expiresInMinutes?: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// BANNERS & HERO
// ═════════════════════════════════════════════════════════════════════════════

export type {
    Banner,
    BannerWriteInput,
    BannerListQuery,
    BannerStats,
    BannerPlacement,
    BannerStatus,
    BannerAlignment,
    BannerOverlay,
    BannerTrackEvent,
} from './api';

// ═════════════════════════════════════════════════════════════════════════════
// AI & AUTOMATIONS
// ═════════════════════════════════════════════════════════════════════════════

export type AdminAIAutomationStatus = 'Active' | 'Paused' | 'Draft';

export type AdminAIInsightCategory =
    | 'sales'
    | 'inventory'
    | 'customer'
    | 'channel';

export type AdminAIInsightPriority = 'high' | 'medium' | 'low';

export type AdminAIContentType =
    | 'Product Description'
    | 'TikTok Caption'
    | 'WhatsApp Broadcast'
    | 'Social Media Post'
    | 'SEO Meta Description'
    | 'Product Title';

export type AdminAITone =
    | 'Professional'
    | 'Friendly'
    | 'Urgent'
    | 'Luxury'
    | 'Playful';

export type AdminAILanguage = 'English' | 'Swahili' | 'Both';

export type AdminAILength = 'Short' | 'Medium' | 'Long';

export type AdminAIProvider =
    | 'groq'
    | 'openai'
    | 'gemini'
    | 'openrouter'
    | 'custom';

export type AdminAIUsageFeature = 'assistant' | 'content' | 'search';

export interface AdminAIOverview {
    assistant_status: 'Active' | 'Inactive';
    active_automations: number;
    total_automations: number;
    tokens_this_month: number;
    estimated_cost_kes: number;
    usage_by_day: Array<{
        day: string;
        assistant: number;
        content: number;
        search: number;
    }>;
    cost_by_feature: Array<{
        name: string;
        value: number;
        color: string;
    }>;
}

export interface AdminAIConversation {
    id: string;
    title: string;
    updatedAt: string;
    group: 'Today' | 'Yesterday' | 'Last 7 days' | 'Older';
}

export interface AdminAIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    chart?: { label: string; value: number }[] | null;
    table?: { headers: string[]; rows: string[][] } | null;
    link?: { label: string; href: string } | null;
    timestamp: string;
}

export interface AdminAIMessageWrite {
    content: string;
}

export interface AdminAISearchConfig {
    enabled: boolean;
    natural_language: boolean;
    personalized: boolean;
    explain: boolean;
    cross_sell: boolean;
}

export type AdminAISearchConfigWrite = Partial<AdminAISearchConfig>;

export interface AdminAISearchAnalytics {
    top_searches: [string, string][];
    zero_result_searches: [string, string][];
    ai_conversions: number;
    search_to_cart_rate: number;
}

export interface AdminAISearchDataQuality {
    attribute_completeness: number;
    content_quality: number;
    aeo_keywords: number;
}

export interface AdminAIContentRequest {
    product_id: string;
    content_type: AdminAIContentType;
    tone: AdminAITone;
    language: AdminAILanguage;
    length: AdminAILength;
}

export interface AdminAIContentResponse {
    body: string;
    tokens: number;
}

export interface AdminAIContentBulkRequest {
    product_ids: string[];
    content_type: AdminAIContentType;
    tone: AdminAITone;
    language: AdminAILanguage;
    length: AdminAILength;
}

export interface AdminAIContentBulkResponse {
    jobId: string;
}

export interface AdminAIContentDraft {
    id: string;
    product_id: string;
    content_type: string;
    body: string;
    published: boolean;
    created_at: string;
}

export interface AdminAIContentDraftWrite {
    product_id: string;
    content_type: AdminAIContentType;
    body: string;
}

export interface AdminAIAutomation {
    id: string;
    name: string;
    trigger: string;
    trigger_event?: string;
    status: AdminAIAutomationStatus;
    runs: number;
    lastRun: string;
    successRate: number;
    conditions?: Record<string, unknown>;
    timing?: string;
    action_type?: string;
    template?: string;
    variable_map?: string;
    recipients?: string;
    admin_channel?: string;
}

export interface AdminAIAutomationWrite {
    name: string;
    trigger?: string;
    trigger_event?: string;
    status?: AdminAIAutomationStatus;
    conditions?: Record<string, unknown>;
    timing?: string;
    action_type?: string;
    template?: string;
    variable_map?: string;
    recipients?: string;
    admin_channel?: string;
}

export interface AdminAIAutomationTemplate {
    name: string;
    trigger: string;
    action: string;
}

export interface AdminAIAutomationStatusWrite {
    status: AdminAIAutomationStatus;
}

export interface AdminAIInsight {
    id: string;
    category: AdminAIInsightCategory;
    priority: AdminAIInsightPriority;
    text: string;
    actionLabel: string;
    actionLink: string;
}

export interface AdminAIInsightExecuteResponse {
    redirect: string;
}

export interface AdminAISettings {
    enabled: boolean;
    provider: AdminAIProvider;
    model: string;
    base_url: string;
    monthly_budget_kes: number;
    budget_alert: boolean;
    masking: boolean;
    audit_retention_days: number;
    has_api_key: boolean;
}

export interface AdminAISettingsWrite {
    enabled?: boolean;
    provider?: AdminAIProvider;
    model?: string;
    base_url?: string;
    api_key?: string;
    monthly_budget_kes?: number;
    budget_alert?: boolean;
    masking?: boolean;
    audit_retention_days?: number;
}

export interface AdminAIUsage {
    tokens_this_month: number;
    estimated_cost_kes: number;
    daily_average: number;
    assistant_share: number;
    usage_by_day: Array<{
        day: string;
        assistant: number;
        content: number;
        search: number;
    }>;
    cost_by_feature: Array<{
        name: string;
        value: number;
        color: string;
    }>;
}

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS (store-wide configuration)
// ═════════════════════════════════════════════════════════════════════════════

export type AdminCurrency = 'KES' | 'USD' | 'EUR';
export type AdminTimezone = 'Africa/Nairobi' | 'UTC';
export type AdminDateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type AdminWeightUnit = 'kg' | 'g' | 'lb';

export type AdminStoreStatusValue = 'open' | 'closed' | 'paused';

export type AdminMpesaEnvironment = 'sandbox' | 'production';

export type AdminMpesaTransactionStatus =
    | 'pending'
    | 'success'
    | 'failed'
    | 'timeout'
    | 'refunded';

export type AdminShippingProviderKey = 'g4s' | 'fargo' | 'sendy' | 'riders';

export type AdminNotificationChannel = 'email' | 'whatsapp';

export type AdminIntegrationCategory =
    | 'Payments'
    | 'Messaging'
    | 'Social app'
    | 'Social'
    | 'Analytics';

export type AdminEtimsStatus = 'pending' | 'success' | 'failed';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime snapshot — the flat read every admin page gates its UI on
//
// Returned by GET /api/v1/admin/settings/runtime/. This is the ONE call
// the admin frontend makes on mount (plus a re-fetch after any settings
// save). It merges every singleton plus the credential rows, and
// exposes derived flags so pages never have to check two sources.
//
// Field-for-field mirror of the `RuntimeSettings` dataclass in
// `dashboard/settings/services.py`. If you add a field there, add it
// here too — the endpoint returns exactly these keys.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminRuntimeSettings {
    // ── General ──
    currency: string;
    timezone: string;
    date_format: string;
    weight_unit: string;
    business_name: string;
    business_email: string;
    business_phone: string;
    business_address: string;

    // ── Store ──
    store_status: AdminStoreStatusValue;
    store_indexable: boolean;
    store_paused_message: string;

    // ── Checkout ──
    allow_guest_checkout: boolean;
    require_phone: boolean;
    auto_confirm_orders: boolean;
    whatsapp_fallback: boolean;

    // ── Inventory ──
    track_inventory: boolean;
    low_stock_threshold: number;
    allow_backorders: boolean;
    hide_out_of_stock: boolean;

    // ── Reviews ──
    reviews_enabled: boolean;
    require_verified_purchase: boolean;
    auto_publish_reviews: boolean;
    allow_review_photos: boolean;

    // ── Payments ──
    // `mpesa_enabled` is the AND of PaymentSettings.mpesa_enabled and
    // MpesaConfig.enabled — a page never needs to check both.
    mpesa_enabled: boolean;
    min_amount_kes: string;
    max_amount_kes: string;
    transaction_fee_kes: string;
    auto_capture_payments: boolean;
    auto_refund: boolean;

    // ── Shipping ──
    shipping_enabled: boolean;
    free_shipping_threshold_kes: string;
    default_delivery_fee_kes: string;
    local_pickup_enabled: boolean;

    // ── Notifications ──
    email_enabled: boolean;
    whatsapp_enabled: boolean;
    notify_on_new_order: boolean;
    notify_on_payment: boolean;
    notify_on_shipped: boolean;
    notify_on_cancelled: boolean;
    notify_on_low_stock: boolean;
    notify_on_review: boolean;
    admin_alert_email: string;

    // ── Security ──
    session_timeout_minutes: number;
    require_2fa: boolean;

    // ── Tax ──
    vat_enabled: boolean;
    vat_rate: string;
    prices_include_tax: boolean;
    etims_enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-section singletons
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminGeneralSettings {
    business_name: string;
    tagline: string;
    contact_email: string;
    contact_phone: string;
    address: string;
    currency: AdminCurrency;
    timezone: AdminTimezone;
    date_format: AdminDateFormat;
    weight_unit: AdminWeightUnit;
}

export type AdminGeneralSettingsWrite = Partial<AdminGeneralSettings>;

export interface AdminStoreSettings {
    status: AdminStoreStatusValue;
    is_indexable: boolean;
    paused_message: string;
}

export type AdminStoreSettingsWrite = Partial<AdminStoreSettings>;

export interface AdminCheckoutSettings {
    allow_guest_checkout: boolean;
    require_phone: boolean;
    auto_confirm_orders: boolean;
    whatsapp_fallback: boolean;
}

export type AdminCheckoutSettingsWrite = Partial<AdminCheckoutSettings>;

export interface AdminInventorySettings {
    track_inventory: boolean;
    low_stock_threshold: number;
    allow_backorders: boolean;
    hide_out_of_stock: boolean;
}

export type AdminInventorySettingsWrite = Partial<AdminInventorySettings>;

export interface AdminReviewSettings {
    reviews_enabled: boolean;
    require_verified_purchase: boolean;
    auto_publish: boolean;
    allow_photos: boolean;
}

export type AdminReviewSettingsWrite = Partial<AdminReviewSettings>;

export interface AdminPaymentSettings {
    mpesa_enabled: boolean;
    min_amount_kes: string;
    max_amount_kes: string;
    transaction_fee_kes: string;
    auto_capture: boolean;
    auto_refund: boolean;
}

export type AdminPaymentSettingsWrite = Partial<AdminPaymentSettings>;

export interface AdminMpesaStatus {
    enabled: boolean;
    environment: AdminMpesaEnvironment;
    shortcode: string;
    last_rotated_at: string | null;
}

export interface AdminMpesaTransaction {
    id: number;
    order_id: string;
    merchant_request_id: string;
    checkout_request_id: string;
    amount: string;
    phone: string;
    status: AdminMpesaTransactionStatus;
    result_code: string;
    result_desc: string;
    mpesa_receipt: string;
    raw_callback: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface AdminMpesaTransactionFilters {
    status?: AdminMpesaTransactionStatus;
    order_id?: string;
}

export interface AdminShippingSettings {
    shipping_enabled: boolean;
    free_shipping_threshold_kes: string;
    default_delivery_fee_kes: string;
    local_pickup_enabled: boolean;
}

export type AdminShippingSettingsWrite = Partial<AdminShippingSettings>;

export interface AdminShippingProvider {
    id: number;
    key: AdminShippingProviderKey;
    name: string;
    enabled: boolean;
    credentials: Record<string, unknown>;
}

export interface AdminShippingProviderWrite {
    key: AdminShippingProviderKey;
    name: string;
    enabled: boolean;
    credentials?: Record<string, unknown>;
}

export interface AdminDeliveryZone {
    id: number;
    name: string;
    region: string;
    fee_kes: string;
    eta_text: string;
    enabled: boolean;
    display_order: number;
    created_at?: string;
    updated_at?: string;
}

export interface AdminDeliveryZoneWrite {
    name: string;
    region: string;
    fee_kes: string;
    eta_text: string;
    enabled: boolean;
}

export interface AdminNotificationSettings {
    email_enabled: boolean;
    whatsapp_enabled: boolean;

    notify_on_new_order: boolean;
    notify_on_payment: boolean;
    notify_on_shipped: boolean;
    notify_on_cancelled: boolean;
    notify_on_low_stock: boolean;
    notify_on_review: boolean;

    admin_alert_email: string;
}

export type AdminNotificationSettingsWrite = Partial<AdminNotificationSettings>;

export interface AdminWhatsAppStatus {
    phone_number_id: string;
    waba_id: string;
    template_map: Record<string, string>;
}

export interface AdminNotificationLog {
    id: number;
    event: string;
    channel: AdminNotificationChannel;
    recipient: string;
    order_id: string;
    success: boolean;
    error: string;
    payload: Record<string, unknown> | null;
    created_at: string;
}

export interface AdminNotificationLogFilters {
    event?: string;
    channel?: AdminNotificationChannel;
    success?: boolean;
}

export interface AdminSecuritySettings {
    session_timeout_minutes: number;
    require_2fa: boolean;
}

export type AdminSecuritySettingsWrite = Partial<AdminSecuritySettings>;

export interface AdminLoginEvent {
    id: number;
    ip_address: string | null;
    user_agent: string;
    device_label: string;
    location: string;
    created_at: string;
}

export interface AdminActiveSession {
    id: string;
    expires_at: string;
    current: boolean;
}

export interface AdminChangePasswordInput {
    current_password: string;
    new_password: string;
}

export interface AdminTwoFASetup {
    secret: string;
    otpauth_url: string;
    confirmed: boolean;
}

export interface AdminTwoFAVerifyInput {
    code: string;
}

export interface AdminIntegrationStatus {
    id: number;
    key: string;
    name: string;
    category: AdminIntegrationCategory;
    connected: boolean;
    badge: string;
    description: string;
    last_checked_at: string | null;
    last_error: string;
    metadata: Record<string, unknown>;
}

export interface AdminIntegrationFilters {
    category?: AdminIntegrationCategory;
    connected?: boolean;
}

export interface AdminTaxSettings {
    vat_enabled: boolean;
    vat_rate: string;
    prices_include_tax: boolean;
    etims_enabled: boolean;
}

export type AdminTaxSettingsWrite = Partial<AdminTaxSettings>;

export interface AdminEtimsSubmission {
    id: number;
    order_id: string;
    invoice_number: string;
    submitted_at: string | null;
    status: AdminEtimsStatus;
    response: Record<string, unknown> | null;
    created_at: string;
}

export interface AdminEtimsSubmissionFilters {
    status?: AdminEtimsStatus;
    order_id?: string;
}

export interface AdminSettingsAuditLog {
    id: number;
    section: string;
    field_name: string;
    before: string;
    after: string;
    changed_by: number | null;
    changed_by_email: string | null;
    changed_at: string;
    ip_address: string | null;
}

export interface AdminSettingsAuditLogFilters {
    section?: string;
    field_name?: string;
    changed_by?: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// USERS & ROLES (dashboard.users)
//
// Backend prefixes:
//   /api/v1/admin/users/    — admin-only staff management
//   /api/v1/admin/invites/  — admin-only invite management
//   /api/v1/staff-invites/  — public invite lookup + accept
//
// Backs the /admin/users page — three tabs:
//   • Staff Users      — list / edit / suspend / delete / reset password
//   • Roles            — read-only catalogue of the 6 staff roles + Customer
//   • Permission Matrix — 13 modules × 7 roles grid
//
// Key contracts
// -------------
// • Staff members are `authentication.User` rows extended by a
//   `dashboard.users.StaffProfile` OneToOne. This type file models the
//   combined payload as `AdminStaffUser` — the frontend never needs to
//   know about the split.
// • Administrator permissions are immutable. `AdminPermissionMatrixWrite`
//   should never include an `Administrator` toggle — the backend ignores
//   it anyway, but send only the six mutable roles.
// • Invite acceptance is public (no auth). The invitee has no session
//   yet; the accept endpoint creates the User + StaffProfile, logs the
//   invitee in via session cookie, and returns `{ user, role,
//   redirect_to }`. No JWTs are issued — the rest of the admin API
//   authenticates via the same session cookie.
// • `is_valid` on an invite is derived server-side from `status` and
//   `expires_at`. It returns false for anything that isn't a Pending,
//   unexpired invite — including a Pending row whose date has passed.
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Shared enums
// ─────────────────────────────────────────────────────────────────────────────

export type AdminStaffUserStatus = 'Active' | 'Invited' | 'Suspended';

/** The six staff roles. Customers are NOT staff — see `AdminStaffRole`. */
export type AdminStaffUserRole =
    | 'Administrator'
    | 'Manager'
    | 'Sales Staff'
    | 'Inventory Staff'
    | 'Marketing Staff'
    | 'Support Staff';

/** The permission-matrix columns — six staff roles + a customer column. */
export type AdminPermissionRole = AdminStaffUserRole | 'Customer';

/**
 * Lifecycle of a staff invite. Mirrors `dashboard.users.models.InviteStatus`.
 *
 *   PENDING   + not expired → is_valid = true
 *   PENDING   + expired     → is_valid = false
 *   ACCEPTED                → is_valid = false
 *   CANCELLED               → is_valid = false
 *   EXPIRED                 → is_valid = false
 */
export type AdminStaffInviteStatus =
    | 'Pending'
    | 'Accepted'
    | 'Cancelled'
    | 'Expired';

// ─────────────────────────────────────────────────────────────────────────────
// Staff user — what the Staff Users tab renders per row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combined `authentication.User` + `dashboard.users.StaffProfile`.
 *
 * `last_login_at` mirrors Django's `user.last_login` — the two are
 * the same value. It's `null` while the user is still `Invited`
 * (they've never accepted) and reset if the admin revokes and reinvites.
 */
export interface AdminStaffUser {
    id: string;
    name: string;
    email: string;
    role: AdminStaffUserRole;
    status: AdminStaffUserStatus;
    department: string;
    avatar: string;
    last_login_at: string | null;
    date_joined: string;
    dashboard_url: string;
}

/** PATCH payload. Email is immutable — send a new invite to change it. */
export interface AdminStaffUserWrite {
    name?: string;
    role?: AdminStaffUserRole;
    status?: AdminStaffUserStatus;
    department?: string;
    avatar?: string;
}

/** Query params for `adminApi.users.list()`. */
export interface AdminStaffFilters {
    role?: AdminStaffUserRole;
    q?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Role catalogue — Roles tab
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One card on the Roles tab.
 *
 * `color` and `icon` are the frontend's Tailwind class + lucide icon
 * name, seeded from the backend migration — do not edit them on the
 * client, they're the source of truth for the card style.
 */
export interface AdminStaffRole {
    id: string;
    name: AdminPermissionRole;
    description: string;
    scope: string;
    color: string;
    icon: string;
    is_customer: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission matrix
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row of the matrix. `roles` is a map of role → granted.
 *
 * Administrator is always `true` — the backend seeds it and refuses
 * toggles on it. Every other role is user-toggleable.
 */
export interface AdminPermissionRow {
    module: string;
    group: string;
    roles: Record<AdminPermissionRole, boolean>;
}

/** PUT payload — the full matrix in one shot. */
export interface AdminPermissionMatrixWrite {
    permissions: AdminPermissionRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Effective permissions for the current caller
//
// Read by the sidebar on mount to decide which nav items to render.
// Administrators receive every module in the catalogue regardless of
// what's stored in the matrix.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response from `GET /api/v1/admin/users/me/permissions/`.
 *
 * `modules` is a plain list of the module labels the caller's role
 * has been granted — e.g. `["Products & Catalog", "Orders",
 * "Customers & CRM"]`. The sidebar matches these against each nav
 * item's `moduleLabel`.
 */
export interface AdminMyPermissions {
    modules: string[];
    role: AdminStaffUserRole;
    dashboard_url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invites — admin side
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/invites/ — create + email an invite.
 *
 * The backend sets `expires_at = now + STAFF_INVITE_TTL_DAYS` (default
 * 7) and dispatches the email via Celery. The response is the created
 * invite row, not a generic `{detail, invite_id}` envelope.
 */
export interface AdminStaffUserInviteWrite {
    name: string;
    email: string;
    role: AdminStaffUserRole;
    department?: string;
    message?: string;
}

/**
 * GET /api/v1/admin/invites/ — invite list.
 *
 * Without `?status=`, only Pending invites are returned. Cancelled,
 * expired, and accepted rows are kept for the audit trail but aren't
 * part of the default view.
 */
export interface AdminStaffInvite {
    id: string;
    email: string;
    name: string;
    role: AdminStaffUserRole;
    department: string;
    status: AdminStaffInviteStatus;
    invited_by: string | null;
    accepted_by: string | null;
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    cancelled_at: string | null;
    /** Server-computed: Pending AND not yet expired. */
    is_valid: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invites — public acceptance flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff-invites/<token>/ — prefills the register page.
 *
 * Returns 410 Gone if the invite is expired, cancelled, or already
 * accepted. The `valid` flag is always `true` on a 200 response — it
 * exists so the frontend can render a sanity check without
 * re-implementing the validity rules.
 */
export interface AdminInviteLookup {
    valid: boolean;
    email: string;
    name: string;
    role: AdminStaffUserRole;
    department: string;
    invited_by: string | null;
    expires_at: string;
}

/**
 * POST /api/v1/staff-invites/<token>/accept/ — payload.
 *
 * The token is in the URL, not the body. `password_confirm` is
 * optional but recommended; when omitted the backend skips the
 * mismatch check (the frontend should still send it — the UI
 * validates before submitting).
 */
export interface AdminInviteAcceptWrite {
    password: string;
    password_confirm: string;
}

/**
 * POST /api/v1/staff-invites/<token>/accept/ — response.
 *
 * Creates the User + StaffProfile, logs the new staff member in via
 * session cookie, and returns the redirect target computed from their
 * role's landing page.
 *
 * Note: this replaced the earlier JWT response shape. No `access` /
 * `refresh` keys — the rest of the admin API uses session auth.
 */
export interface AdminInviteAcceptResult {
    user: AdminStaffUser;
    role: AdminStaffUserRole;
    redirect_to: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS & ANALYTICS (dashboard.reports)
// ═════════════════════════════════════════════════════════════════════════════

export type ReportRange =
    | 'today'
    | 'yesterday'
    | '7days'
    | '30days'
    | 'this_month'
    | 'last_month'
    | 'custom';

export type ReportTab =
    | 'sales'
    | 'orders'
    | 'customers'
    | 'products'
    | 'inventory'
    | 'payments'
    | 'taxes'
    | 'shipping'
    | 'discounts'
    | 'social';

export type ReportExportFormat = 'CSV' | 'Excel' | 'PDF';

export interface ReportQuery {
    range?: ReportRange;
    start?: string;
    end?: string;
}

export interface ReportSaleRow {
    date: string;
    revenue: number;
    orders: number;
    aov: number;
    topCategory: string;
    refunds: number;
}

export interface ReportSalesResponse {
    range_label: string;
    daily: ReportSaleRow[];
}

export interface ReportOrderRow {
    id: string;
    date: string;
    customer: string;
    items: number;
    total: number;
    status: string;
    payment: string;
    channel: string;
}

export interface ReportOrdersResponse {
    range_label: string;
    rows: ReportOrderRow[];
}

export interface ReportNewVsReturningPoint {
    date: string;
    newCust: number;
    returning: number;
}

export interface ReportTopBuyer {
    customer: string;
    email: string;
    phone: string;
    orders: number;
    spent: number;
    aov: number;
    lastOrder: string;
    county: string;
}

export interface ReportCustomersResponse {
    range_label: string;
    new_vs_returning: ReportNewVsReturningPoint[];
    top_buyers: ReportTopBuyer[];
}

export interface ReportProductRow {
    product: string;
    sku: string;
    qty: number;
    revenue: number;
    returns: number;
    net: number;
    category: string;
    lastSold: string;
}

export interface ReportProductsResponse {
    range_label: string;
    rows: ReportProductRow[];
}

export interface ReportInventoryCounts {
    total_skus: number;
    low: number;
    critical: number;
    out: number;
}

export interface ReportInventoryRow {
    product: string;
    sku: string;
    warehouse: string;
    onHand: number;
    reserved: number;
    available: number;
    reorderPoint: number;
    status: 'In Stock' | 'Low' | 'Critical' | 'Out';
    value: number;
}

export interface ReportInventoryResponse {
    counts: ReportInventoryCounts;
    rows: ReportInventoryRow[];
}

export interface ReportPaymentStream {
    method: string;
    transactions: number;
    volume: number;
    fees: number;
    net: number;
    provider: string;
    successRate: string;
}

export interface ReportPaymentShareSlice {
    name: string;
    value: number;
    color: string;
}

export interface ReportPaymentsResponse {
    range_label: string;
    streams: ReportPaymentStream[];
    share: ReportPaymentShareSlice[];
}

export type ReportTaxStatus = 'Filed' | 'Due' | 'Overdue';

export interface ReportTaxRow {
    period: string;
    taxableSales: number;
    vat16: number;
    net: number;
    dueDate: string;
    status: ReportTaxStatus;
}

export interface ReportTaxesResponse {
    rows: ReportTaxRow[];
}

export interface ReportShippingTotals {
    shipments: number;
    delivered: number;
    in_transit: number;
    failed: number;
}

export interface ReportShippingRow {
    carrier: string;
    shipments: number;
    delivered: number;
    inTransit: number;
    failed: number;
    avgDays: number;
    cost: number;
    onTimeRate: string;
}

export interface ReportShippingResponse {
    totals: ReportShippingTotals;
    rows: ReportShippingRow[];
}

export type ReportDiscountStatus = 'Active' | 'Expired' | 'Scheduled';

export interface ReportDiscountRow {
    code: string;
    type: string;
    uses: number;
    discountGiven: number;
    revenue: number;
    roi: string;
    status: ReportDiscountStatus;
}

export interface ReportDiscountsResponse {
    rows: ReportDiscountRow[];
}

export type ReportSocialPlatform =
    | 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook' | 'WhatsApp';

export type ReportVideoType =
    | 'Unboxing' | 'Review' | 'Demo' | 'Comparison' | 'Tutorial';

export interface ReportSocialSummary {
    videos: number;
    views: number;
    orders: number;
    revenue: number;
    changes: {
        videos: string;
        views: string;
        orders: string;
        revenue: string;
    };
}

export interface ReportSocialFunnelPoint {
    date: string;
    views: number;
    clicks: number;
    orders: number;
    revenue: number;
}

export interface ReportSocialVideo {
    id: string;
    title: string;
    product: string;
    sku: string;
    category: string;
    platform: ReportSocialPlatform;
    videoType: ReportVideoType;
    published: string;
    duration: string;
    views: number;
    likes: number;
    comments: number;
    clicks: number;
    orders: number;
    revenue: number;
    conversionRate: string;
    ctr: string;
    spend: number;
    roas: string;
}

export interface ReportPlatformSummary {
    platform: ReportSocialPlatform;
    videos: number;
    views: number;
    clicks: number;
    orders: number;
    revenue: number;
    spend: number;
    roas: string;
    convRate: string;
}

export interface ReportProductVideoPerf {
    product: string;
    sku: string;
    category: string;
    videos: number;
    views: number;
    orders: number;
    revenue: number;
    bestPlatform: string;
    avgConvRate: string;
}

export interface ReportSocialResponse {
    summary: ReportSocialSummary;
    funnel: ReportSocialFunnelPoint[];
    videos: ReportSocialVideo[];
    platforms: ReportPlatformSummary[];
    product_perf: ReportProductVideoPerf[];
}

export interface ReportExportWrite {
    tab: ReportTab;
    range?: string;
    format: ReportExportFormat;
}

export interface ReportExportResponse {
    ok: boolean;
    id: number;
    filename: string;
}

export interface ReportRefreshWrite {
    tab?: ReportTab;
}

export interface ReportRefreshResponse {
    ok: boolean;
    cleared: string;
    deleted: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS (dashboard.analytics)
// ═════════════════════════════════════════════════════════════════════════════

export type AnalyticsRange = '7days' | '30days' | '90days' | 'year';

export type AnalyticsTab =
    | 'traffic'
    | 'sales'
    | 'customers'
    | 'products'
    | 'channels';

export interface AnalyticsQuery {
    range?: AnalyticsRange;
}

export interface AnalyticsKpi {
    id: string;
    label: string;
    value: string;
    delta: string;
    positive: boolean;
    spark: number[];
    detail: string;
}

export interface AnalyticsSessionsPoint {
    date: string;
    sessions: number;
    visitors: number;
    pageviews: number;
}

export interface AnalyticsSource {
    name: string;
    value: number;
    color: string;
    visits: number;
    orders: number;
    revenue: string;
}

export interface AnalyticsFunnelStage {
    stage: string;
    count: number;
    dropoff: string;
    breakdown: { source: string; users: number }[];
}

export interface AnalyticsDevice {
    device: string;
    users: number;
    fill: string;
    sessions: number;
    convRate: string;
    bounce: string;
}

export interface AnalyticsCounty {
    county: string;
    share: number;
    visitors: number;
    orders: number;
    revenue: string;
}

export interface AnalyticsAbandonedCart {
    id: string;
    customer: string;
    phone: string;
    items: string;
    value: string;
    time: string;
    date: string;
}

export interface AnalyticsAbandonedTrendPoint {
    date: string;
    carts: number;
}

export interface AnalyticsTrafficResponse {
    kpis: AnalyticsKpi[];
    sessions_timeline: AnalyticsSessionsPoint[];
    sources: AnalyticsSource[];
    funnel: AnalyticsFunnelStage[];
    devices: AnalyticsDevice[];
    counties: AnalyticsCounty[];
    abandoned_carts: AnalyticsAbandonedCart[];
    abandoned_trend: AnalyticsAbandonedTrendPoint[];
    error?: string;
}

export interface AnalyticsSalesSummary {
    gross: number;
    net: number;
    refunds: number;
    discounts: number;
    orders: number;
    aov: number;
    revenueGrowth: number;
}

export interface AnalyticsSalesTrendPoint {
    date: string;
    gross: number;
    net: number;
    refunds: number;
}

export interface AnalyticsSalesBreakdownRow {
    name: string;
    revenue: number;
    orders: number;
    units: number;
    growth: number;
    color?: string;
    image?: string;
}

export interface AnalyticsSalesResponse {
    summary: AnalyticsSalesSummary;
    trend: AnalyticsSalesTrendPoint[];
    by_product: AnalyticsSalesBreakdownRow[];
    by_category: AnalyticsSalesBreakdownRow[];
    by_brand: AnalyticsSalesBreakdownRow[];
    error?: string;
}

export interface AnalyticsCustomerMetric {
    id: string;
    label: string;
    value: string;
    delta: string;
    positive: boolean;
    detail: string;
}

export interface AnalyticsNewVsReturningPoint {
    date: string;
    new: number;
    returning: number;
}

export interface AnalyticsTopCustomer {
    id: string;
    name: string;
    email: string;
    orders: number;
    spent: number;
    avatar: string;
    tier: string;
}

export interface AnalyticsCustomersResponse {
    metrics: AnalyticsCustomerMetric[];
    new_vs_returning: AnalyticsNewVsReturningPoint[];
    top_customers: AnalyticsTopCustomer[];
    error?: string;
}

export type AnalyticsProductStatus = 'best' | 'low' | 'out' | 'abandoned';

export interface AnalyticsProductsSummary {
    most_viewed: string;
    most_purchased: string;
    best_seller: string;
    low_performers: number;
    out_of_stock: number;
    abandoned: number;
}

export interface AnalyticsProductPerfRow {
    id: string;
    name: string;
    sku: string;
    image: string;
    views: number;
    purchases: number;
    revenue: number;
    stock: number;
    category: string;
    conversion: string;
    status: AnalyticsProductStatus;
}

export interface AnalyticsProductsResponse {
    summary: AnalyticsProductsSummary;
    rows: AnalyticsProductPerfRow[];
    error?: string;
}

export interface AnalyticsChannelRow {
    name: string;
    share: number;
    visitors: number;
    orders: number;
    revenue: string;
    convRate: string;
    color: string;
    icon: string;
}

export interface AnalyticsChannelTrendPoint {
    date: string;
    whatsapp: number;
    instagram: number;
    facebook: number;
    tiktok: number;
    website: number;
}

export interface AnalyticsSocialActivityRow {
    platform: string;
    metric: string;
    value: string;
    delta: string;
    positive: boolean;
    color: string;
}

export interface AnalyticsAttributionRow {
    platform: string;
    metric: string;
    value: string;
    desc: string;
}

export interface AnalyticsChannelsResponse {
    channels: AnalyticsChannelRow[];
    trend: AnalyticsChannelTrendPoint[];
    social_activity: AnalyticsSocialActivityRow[];
    attribution: AnalyticsAttributionRow[];
    error?: string;
}

export interface AnalyticsRefreshWrite {
    tab?: AnalyticsTab;
}

export interface AnalyticsRefreshResponse {
    ok: boolean;
    cleared: string;
    deleted: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW (dashboard.overview)
// ═════════════════════════════════════════════════════════════════════════════

export type OverviewRange = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface OverviewQuery {
    range?: OverviewRange;
    start?: string;
    end?: string;
}

export interface OverviewKpi {
    id: string;
    title: string;
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    change: number;
    isPositive: boolean;
    sparklineData: { value: number }[];
    /** Lucide icon name, mapped on the client to the actual component. */
    icon: string;
}

export interface OverviewRevenuePoint {
    date: string;
    revenue: number;
    orders: number;
}

export interface OverviewOrderStatusRow {
    name: string;
    value: number;
    color: string;
}

export interface OverviewSalesPeriodRow {
    label: string;
    revenue: number;
    orders: number;
}

export interface OverviewTopCategory {
    name: string;
    revenue: number;
    products: number;
    color: string;
}

export interface OverviewTopProduct {
    id: string;
    name: string;
    sku: string;
    sold: number;
    revenue: number;
    image: string;
    stock: number;
    category: string;
}

export interface OverviewRecentOrder {
    id: string;
    orderNumber: string;
    customer: string;
    amount: number;
    status:
    | 'Pending' | 'Confirmed' | 'Processing' | 'Shipped'
    | 'Delivered' | 'Returned' | 'Cancelled' | 'Failed'
    | string;
    time: string;
}

export interface OverviewRecentCustomer {
    id: string;
    name: string;
    email: string;
    orders: number;
    spent: number;
    joined: string;
    avatar: string;
}

export interface OverviewRecentTransaction {
    id: string;
    ref: string;
    customer: string;
    method: string;
    amount: number;
    status: 'Success' | 'Pending' | 'Failed' | 'Refunded' | string;
    time: string;
}

export interface OverviewLowStockRow {
    id: string;
    name: string;
    sku: string;
    stock: number;
    threshold: number;
    category: string;
    image: string;
}

export interface OverviewPaymentMethodRow {
    name: string;
    amount: number;
    percentage: number;
    color: string;
}

export interface OverviewResponse {
    kpis: OverviewKpi[];
    revenue_chart: OverviewRevenuePoint[];
    order_status: OverviewOrderStatusRow[];
    sales_by_period: {
        Day: OverviewSalesPeriodRow[];
        Week: OverviewSalesPeriodRow[];
        Month: OverviewSalesPeriodRow[];
    };
    top_categories: OverviewTopCategory[];
    top_products: OverviewTopProduct[];
    recent_orders: OverviewRecentOrder[];
    recent_customers: OverviewRecentCustomer[];
    recent_transactions: OverviewRecentTransaction[];
    low_stock: OverviewLowStockRow[];
    payment_methods: OverviewPaymentMethodRow[];
    error?: string;
}

export interface OverviewRefreshWrite {
    range?: string;
}

export interface OverviewRefreshResponse {
    ok: boolean;
    cleared: string;
    deleted: number;
}