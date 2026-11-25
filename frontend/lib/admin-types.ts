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

export interface AdminProductVariant {
    id: number;
    name: string;
    sku: string;
    size: string;
    color: string;
    priceDelta: string;
    stockQuantity: number;
    imageUrl: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminProductVariantWrite {
    name: string;
    sku?: string;
    size?: string;
    color?: string;
    priceDelta?: string | number;
    stockQuantity?: number;
    imageUrl?: string;
    isActive?: boolean;
}

export interface AdminSEO {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
    canonicalUrl: string;
}

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
    serial_number: string;
    imei: string;
    warranty_months: number;
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
    | 'TIMEOUT'
    | 'REVERSED';
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
    verify_token: string;
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

export interface AdminQRVerifyItem {
    id: number | string;
    product_id?: string;
    name: string;
    brand?: string;
    price: string | number;
    quantity: number;
    subtotal: string | number;
    image?: string;
    serial_number?: string;
    imei?: string;
    warranty_months?: number;
}

export interface AdminQRVerifyResponse {
    reference: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    status: string;
    status_label: string;
    payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed';
    payment_status_label: string;
    payment_method: string;
    mpesa_receipt_number: string | null;
    total: string | number;
    created_at: string;
    items: AdminQRVerifyItem[];
    fulfilled: boolean;
}

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

export interface AdminSupplierFull {
    id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
    contactPerson: string;
    paymentTerms: string;
    taxPin: string;
    isActive: boolean;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminSupplierFullWrite {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    contactPerson?: string;
    paymentTerms?: string;
    taxPin?: string;
    isActive?: boolean;
    notes?: string;
}

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

export interface AdminInventoryMovement {
    id: number;
    productId: number;
    variantId: number | null;
    locationId: number | null;
    kind: 'in' | 'out' | 'adjustment' | 'damaged' | 'return' | 'transfer';
    quantity: number;
    unitCost: string;
    reference: string;
    notes: string;
    createdBy: number | null;
    createdAt: string;
}

export interface AdminInventoryMovementWrite {
    productId: number;
    variantId?: number | null;
    locationId?: number | null;
    kind?: 'in' | 'out' | 'adjustment' | 'damaged' | 'return' | 'transfer';
    quantity: number;
    unitCost?: string;
    reference?: string;
    notes?: string;
}

export interface AdminInventorySummaryItem {
    id: number;
    name: string;
    sku: string;
    stock: number;
    threshold: number;
    reorderPoint: number;
}

export interface AdminInventorySummary {
    totalSkus: number;
    outOfStock: AdminInventorySummaryItem[];
    lowStock: AdminInventorySummaryItem[];
    healthy: AdminInventorySummaryItem[];
    stockValue: number;
}

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

export interface AdminReviewFull {
    id: number;
    productId: number | null;
    orderId: number | null;
    customerId: number | null;
    rating: number;
    title: string;
    body: string;
    mediaUrl: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    isUgc: boolean;
    rightsGranted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminReviewFullWrite {
    productId?: number | null;
    orderId?: number | null;
    customerId?: number | null;
    rating?: number;
    title?: string;
    body?: string;
    mediaUrl?: string;
    status?: 'Pending' | 'Approved' | 'Rejected';
    isUgc?: boolean;
    rightsGranted?: boolean;
}

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

export type AdminTransactionStatus =
    | 'Success'
    | 'Pending'
    | 'Failed'
    | 'Reversed';

export type AdminTransactionMethod = 'MPESA' | 'COD';

export type AdminTransactionSource = 'STK' | 'C2B' | 'MANUAL';

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
    orderNumber: string | null;
    amount: string;
    fee: string;
    phoneNumber: string;
    source: AdminTransactionSource;
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
    source?: AdminTransactionSource | '';
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

export interface AdminCompleteOrderItemPayload {
    product_id?: string;
    name: string;
    brand?: string;
    unit_price: string;
    quantity: number;
    image_url?: string;
    serial_number?: string;
    imei?: string;
}

export interface AdminCompleteOrderPayload {
    items: AdminCompleteOrderItemPayload[];
    customer_name?: string;
    customer_phone?: string;
    address?: string;
}

export interface AdminCompleteOrderResult {
    reference: string;
    total: string;
    items_count: number;
}

export interface AdminStickerData {
    order_reference: string;
    item_id: number;
    name: string;
    brand: string;
    quantity: number;
    unit_price: string;
    serial_number: string;
    imei: string;
    customer_name: string;
    customer_phone_last4: string;
    created_at: string;
    qr_payload: string;
}

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

export type AdminReturnStatus =
    | 'REQUESTED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'AWAITING_ITEM'
    | 'ITEM_RECEIVED'
    | 'CLOSED';

export type AdminRefundStatus =
    | 'NONE'
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';

export type AdminRefundMethod =
    | 'original'
    | 'store_credit'
    | 'bank_transfer'
    | 'manual';

export type AdminReturnItemCondition =
    | 'unopened'
    | 'opened'
    | 'damaged'
    | 'defective';

export interface AdminReturnCustomer {
    name: string;
    email: string;
    phone: string;
}

export interface AdminReturnItem {
    id: number;
    productName: string;
    sku: string;
    qty: number;
    price: string;
    image: string;
    condition: AdminReturnItemCondition;
}

export interface AdminReturnRequest {
    id: number;
    code: string;
    orderId: string;
    customer: AdminReturnCustomer;
    reason: string;
    reasonId: number | null;
    notes: string;
    internalNotes: string;
    status: AdminReturnStatus;
    refundStatus: AdminRefundStatus;
    refundMethod: AdminRefundMethod;
    originalAmount: string;
    refundAmount: string;
    address: string;
    tracking: string;
    requestedAt: string;
    resolvedAt: string | null;
    items: AdminReturnItem[];
}

export interface AdminReturnRequestWrite {
    orderId?: string;
    customer?: AdminReturnCustomer;
    reason?: string;
    reasonId?: number | null;
    notes?: string;
    internalNotes?: string;
    status?: AdminReturnStatus;
    refundStatus?: AdminRefundStatus;
    refundMethod?: AdminRefundMethod;
    originalAmount?: string;
    refundAmount?: string;
    address?: string;
    tracking?: string;
    items?: AdminReturnItemWrite[];
}

export interface AdminReturnReason {
    id: number;
    label: string;
    description: string;
    requiresPhoto: boolean;
    active: boolean;
    order: number;
}

export interface AdminReturnReasonWrite {
    label: string;
    description?: string;
    requiresPhoto?: boolean;
    active?: boolean;
    order?: number;
}

export interface AdminRefundRecord {
    id: number;
    returnCode: string;
    orderId: string;
    customer: string;
    amount: string;
    method: AdminRefundMethod;
    status: AdminRefundStatus;
    reference: string;
    createdAt: string;
    completedAt: string | null;
}

export interface AdminReturnStats {
    pending: number;
    approved: number;
    refunded30d: number;
    completed30d: number;
    avgDays: number;
}

export interface AdminReturnHistoryPoint {
    month: string;
    returns: number;
    refunded: number;
    rate: string;
}

export interface AdminReturnSettings {
    returnWindowDays: number;
    autoApproveUnder: string;
    restockingFeePct: string;
    notifyEmail: boolean;
    notifySms: boolean;
    notifyPush: boolean;
}

export interface AdminReturnSettingsWrite {
    returnWindowDays?: number;
    autoApproveUnder?: string;
    restockingFeePct?: string;
    notifyEmail?: boolean;
    notifySms?: boolean;
    notifyPush?: boolean;
}

export interface AdminReturnFilters {
    q?: string;
    status?: AdminReturnStatus | 'ALL';
    refund_status?: AdminRefundStatus | 'ALL';
    sort?: 'recent' | 'oldest' | 'amount_high' | 'amount_low';
}

export interface AdminReturnStatusWrite {
    status: AdminReturnStatus;
}

export interface AdminReturnRefundMethodWrite {
    refund_method: AdminRefundMethod;
}

export interface AdminReturnRefundWrite {
    method?: AdminRefundMethod;
    reference?: string;
    note?: string;
}

export interface AdminReturnPatchWrite {
    internalNotes?: string;
    refundMethod?: AdminRefundMethod;
    status?: AdminReturnStatus;
}

export interface AdminReturnRejectWrite {
    note?: string;
}

export interface AdminReturnItemWrite {
    product_name: string;
    sku?: string;
    qty: number;
    price: string;
    image?: string;
    condition?: AdminReturnItemCondition;
}

export interface AdminReturnCreateWrite {
    order_id: string;
    reason_id?: number | null;
    reason_text?: string;
    notes?: string;
    items: AdminReturnItemWrite[];
}

export interface AdminDirectReturnRequest {
    id: number;
    reference: string;
    orderId: number;
    orderReference: string;
    status: 'Requested' | 'Approved' | 'Rejected' | 'Received' | 'Refunded';
    reason: 'damaged' | 'wrong_item' | 'not_as_described' | 'late_delivery' | 'changed_mind' | 'other';
    reasonDetail: string;
    refundAmount: string;
    restock: boolean;
    restockedAt: string | null;
    resolvedBy: number | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminDirectReturnRequestWrite {
    orderId: number;
    status?: 'Requested' | 'Approved' | 'Rejected' | 'Received' | 'Refunded';
    reason?: 'damaged' | 'wrong_item' | 'not_as_described' | 'late_delivery' | 'changed_mind' | 'other';
    reasonDetail?: string;
    refundAmount?: string;
    restock?: boolean;
}

export type AdminPaymentEnvironment = 'sandbox' | 'production';

export interface AdminPaymentConfig {
    enabled: boolean;
    environment: AdminPaymentEnvironment;
    shortcode: string;
    callback_url: string;
    consumer_key_masked: string;
    consumer_secret_masked: string;
    passkey_masked: string;
    has_consumer_key: boolean;
    has_consumer_secret: boolean;
    has_passkey: boolean;
    min_amount_kes: string;
    max_amount_kes: string;
    transaction_fee_kes: string;
    auto_capture: boolean;
    auto_refund: boolean;
    last_rotated_at: string | null;
}

export interface AdminPaymentConfigWrite {
    enabled?: boolean;
    environment?: AdminPaymentEnvironment;
    shortcode?: string;
    callback_url?: string;
    consumer_key?: string;
    consumer_secret?: string;
    passkey?: string;
    min_amount_kes?: string;
    max_amount_kes?: string;
    transaction_fee_kes?: string;
    auto_capture?: boolean;
    auto_refund?: boolean;
}

export interface AdminPaymentTestResult {
    ok: boolean;
    message: string;
    checked_at: string;
}

export interface AdminPaymentSummary {
    total_records: number;
    success_count: number;
    pending_count: number;
    failed_count: number;
    refund_pending_count: number;
    total_volume: string;
    total_pending: string;
    total_failed: string;
    total_fees: string;
    today_volume: string;
    success_rate: number;
}

export interface AdminPaymentTransactionFilters {
    q?: string;
    status?: AdminTransactionStatus | 'ALL' | '';
    method?: AdminTransactionMethod | 'ALL' | '';
    limit?: number;
}

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

export type WhatsAppMessageType =
    | 'text'
    | 'template'
    | 'interactive'
    | 'image'
    | 'document'
    | 'audio'
    | 'video'
    | 'sticker'
    | 'location'
    | 'contacts'
    | 'product'
    | 'catalog'
    | 'cart'
    | 'order'
    | 'unknown';

export type WhatsAppOptInStatus = 'SUBSCRIBED' | 'UNSUBSCRIBED';

export type WhatsAppAutomationStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';

export type WhatsAppBroadcastStatus =
    | 'DRAFT'
    | 'SCHEDULED'
    | 'SENDING'
    | 'PAUSED'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';

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
    | 'PENDING'
    | 'NOT_VERIFIED';

export type WhatsAppAutomationRecipients =
    | 'CUSTOMER'
    | 'ADMIN_TEAM'
    | 'BOTH';

export type WhatsAppCatalogSyncStatus =
    | 'NOT_SYNCED'
    | 'SYNCING'
    | 'SYNCED'
    | 'OUT_OF_DATE'
    | 'FAILED'
    | 'REJECTED';

export type WhatsAppCatalogReviewStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED';

export type WhatsAppCatalogEligibilityRule =
    | 'ALL_ACTIVE'
    | 'IN_STOCK_ONLY'
    | 'HAS_IMAGE'
    | 'TAGGED_WHATSAPP'
    | 'MANUAL';

export type WhatsAppCatalogDefaultSort =
    | 'PINNED_FIRST'
    | 'POPULAR'
    | 'PRICE_ASC'
    | 'PRICE_DESC'
    | 'NEWEST';

export interface AdminWhatsAppAccount {
    id: number | null;
    isActive: boolean;
    displayPhone: string;
    displayName: string;
    businessName: string;
    about: string;
    address: string;
    email: string;
    website: string;
    vertical: string;
    profilePictureUrl: string;
    phoneNumberId: string;
    wabaId: string;
    businessId: string;
    qualityScore: WhatsAppQualityScore | 'UNKNOWN';
    messagingLimit: string;
    messagingLimitTier: string;
    verificationStatus: WhatsAppVerificationStatus;
    reviewStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
    twoStepPin: boolean;
    officialBusinessAccount: boolean;
    tokenDaysLeft: number | null;
    tokenExpiresAt: string | null;
    webhookUrl: string;
    webhookVerifyToken: string;
    webhookFields: string[];
    lastSyncedAt: string | null;
    lastError: string;
    hasCatalog: boolean;
    qualityHistory: Array<{ date: string; score: string }>;
    healthChecks: Array<{
        id: number;
        at: string;
        ok: boolean;
        latencyMs: number;
        error: string;
    }>;
}

export interface AdminWhatsAppAccountWrite {
    wabaId?: string;
    phoneNumberId?: string;
    displayPhone?: string;
    businessName?: string;
    accessToken?: string;
    appSecret?: string;
    verifyToken?: string;
    about?: string;
    address?: string;
    email?: string;
    website?: string;
    vertical?: string;
    profilePictureUrl?: string;
    webhookUrl?: string;
    webhookVerifyToken?: string;
    webhookFields?: string[];
    tokenExpiresAt?: string | null;
}

export interface AdminWhatsAppCatalogCounts {
    total: number;
    eligible: number;
    synced: number;
    syncing: number;
    outOfDate: number;
    failed: number;
    linked: number;
    unlinked: number;
    inStock: number;
    pinned: number;
    removed: number;
}

export interface AdminWhatsAppCatalog {
    id: number | null;
    name: string;
    metaCatalogId: string;
    connected: boolean;
    autoSync: boolean;
    eligibilityRule: WhatsAppCatalogEligibilityRule;
    syncFrequencyMinutes: number;
    hidePrice: boolean;
    defaultSort: WhatsAppCatalogDefaultSort;
    excludeOutOfStock: boolean;
    lastFullSyncAt: string | null;
    lastSyncAdded: number;
    lastSyncUpdated: number;
    lastSyncFailed: number;
    lastError: string;
    itemCounts: AdminWhatsAppCatalogCounts;
    updatedAt: string | null;
}

export interface AdminWhatsAppCatalogUpdate {
    name?: string;
    autoSync?: boolean;
    eligibilityRule?: WhatsAppCatalogEligibilityRule;
    syncFrequencyMinutes?: number;
    hidePrice?: boolean;
    defaultSort?: WhatsAppCatalogDefaultSort;
    excludeOutOfStock?: boolean;
    connected?: boolean;
}

export interface AdminWhatsAppCatalogCreateWrite {
    name?: string;
}

export interface AdminWhatsAppCatalogItem {
    id: number;
    catalogId: number;
    retailerId: string;
    metaProductId: string;
    storeProductId: number | null;
    storeCategoryId: number | null;
    storeProductName: string | null;
    storeProductSlug: string | null;
    isLinked: boolean;
    isRemoved: boolean;
    isBrowsable: boolean;
    name: string;
    displayTitle: string;
    description: string;
    displayDescription: string;
    price: string;
    salePrice: string | null;
    effectivePrice: string;
    currency: string;
    imageUrl: string;
    customImageUrl: string;
    displayImageUrl: string;
    productUrl: string;
    category: string;
    brand: string;
    tags: string[];
    inStock: boolean;
    stockQuantity: number;
    eligible: boolean;
    pinned: boolean;
    sortOrder: number;
    hidePrice: boolean;
    isPriceHidden: boolean;
    customTitle: string;
    customDescription: string;
    viewCount: number;
    addToCartCount: number;
    removedAt: string | null;
    syncStatus: WhatsAppCatalogSyncStatus;
    reviewStatus: WhatsAppCatalogReviewStatus | null;
    rejectionReason: string;
    lastError: string;
    lastSyncedAt: string | null;
    updatedAt: string;
}

export interface AdminWhatsAppCatalogItemFilters {
    search?: string;
    syncStatus?: WhatsAppCatalogSyncStatus | '';
    category?: string;
    eligibleOnly?: boolean;
    linkedOnly?: boolean;
    unlinkedOnly?: boolean;
}

export interface AdminWhatsAppCatalogItemUpdate {
    eligible?: boolean;
    pinned?: boolean;
    sortOrder?: number;
    hidePrice?: boolean;
    customTitle?: string;
    customDescription?: string;
    customImageUrl?: string;
}

export interface AdminWhatsAppCatalogItemLinkWrite {
    store_product_id?: number;
    store_category_id?: number;
    retailer_id?: string;
    auto_sync_now?: boolean;
}

export interface AdminWhatsAppCatalogItemUnlinkWrite {
    ids: number[];
    remove_item?: boolean;
}

export interface AdminWhatsAppCatalogBulkWrite {
    ids: number[];
    patch: AdminWhatsAppCatalogItemUpdate;
}

export interface AdminWhatsAppCatalogSyncSummary {
    added: number;
    updated: number;
    failed: number;
}

export interface AdminWhatsAppCatalogManualAddWrite {
    product_ids: number[];
}

export interface AdminWhatsAppCatalogManualAddResponse {
    added: number;
    skipped: number;
    item_ids: number[];
}

export interface AdminWhatsAppCatalogReorderWrite {
    ordered_ids: number[];
}

export interface AdminWhatsAppCatalogReorderResponse {
    updated: number;
}

export interface AdminWhatsAppTopProduct {
    id: string;
    name: string;
    units: number;
    revenueKes: number;
}

export interface AdminWhatsAppRecoveryByProduct {
    name: string;
    recovered: number;
}

export interface AdminWhatsAppCommerceStats {
    messagesSentToday: number;
    abandonedCartsRecovered: number;
    ordersFromWhatsApp: number;
    ordersRevenueKes: number;
    averageResponseMin: number;
    productViews: number;
    addToCartRate: number;
    topProducts: AdminWhatsAppTopProduct[];
    recoveryByProduct: AdminWhatsAppRecoveryByProduct[];
}

export interface AdminWhatsAppSettings {
    id?: number;
    businessHours: Record<string, unknown>;
    timezone: string;
    notifications: Record<string, unknown>;
    routing: 'ROUND_ROBIN' | 'LOAD_BASED' | 'MANUAL';
    slaFirstResponseMin: number;
    slaResolutionMin: number;
    optOutKeywords: string[];
    defaultLanguage: string;
    csatEnabled: boolean;
    dataRetentionDays: number;
    welcomeMessage: string;
    awayMessage: string;
}

export interface AdminWhatsAppSettingsUpdate {
    business_hours?: Record<string, unknown>;
    timezone?: string;
    notifications?: Record<string, unknown>;
    routing?: 'ROUND_ROBIN' | 'LOAD_BASED' | 'MANUAL';
    sla_first_response_min?: number;
    sla_resolution_min?: number;
    opt_out_keywords?: string[];
    default_language?: string;
    csat_enabled?: boolean;
    data_retention_days?: number;
    welcome_message?: string;
    away_message?: string;
}

export type AdminWhatsAppTeamRole = 'ADMIN' | 'AGENT' | 'VIEWER';

export interface AdminWhatsAppTeamMember {
    id: number;
    userId: number;
    name: string;
    email: string;
    role: AdminWhatsAppTeamRole;
    online: boolean;
    lastSeenAt: string | null;
    activeConversations: number;
}

export interface AdminWhatsAppTeamMemberWrite {
    userId: number;
    role?: AdminWhatsAppTeamRole;
}

export interface AdminWhatsAppTeamMemberUpdate {
    role?: AdminWhatsAppTeamRole;
    online?: boolean;
}

export interface AdminWhatsAppAuditEntry {
    id: number;
    actor: number | null;
    actorName: string;
    action: string;
    target: string;
    payload: Record<string, unknown>;
    timestamp: string | null;
}

export type AdminWhatsAppNotificationType =
    | 'message'
    | 'template'
    | 'order'
    | 'broadcast'
    | 'system'
    | 'quality';

export interface AdminWhatsAppNotification {
    id: number;
    type: AdminWhatsAppNotificationType;
    title: string;
    body: string;
    linkTab: string;
    read: boolean;
    payload: Record<string, unknown>;
    timestamp: string | null;
}

export interface AdminWhatsAppContact {
    id: number;
    waId: string;
    profileName: string | null;
    email: string;
    userId: number | null;
    tags: string[];
    attributes: Record<string, unknown>;
    notes: string;
    optInStatus: WhatsAppOptInStatus;
    optInSource: string;
    optInAt: string | null;
    lastInboundAt: string | null;
    isVerified: boolean;
    isBlocked: boolean;
    orderCount: number;
    totalSpent: string;
    productAffinity: Record<string, unknown>;
    createdAt: string | null;
}

export interface AdminWhatsAppContactDetail extends AdminWhatsAppContact {
    conversations?: AdminWhatsAppConversation[];
    orders?: Array<{
        reference: string;
        total: string;
        status: string;
        createdAt: string;
    }>;
    cartSessions?: Array<{
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
    profileName?: string;
    email?: string;
    tags?: string[];
    attributes?: Record<string, unknown>;
    notes?: string;
    optInStatus?: WhatsAppOptInStatus;
    isBlocked?: boolean;
    isVerified?: boolean;
}

export interface AdminWhatsAppContactBulkWrite {
    ids: number[];
    patch: Partial<AdminWhatsAppContactWrite>;
}

export interface AdminWhatsAppContactImportWrite {
    rows: Array<Record<string, unknown>>;
}

export interface AdminWhatsAppContactImportResult {
    added: number;
    skipped: number;
}

export interface AdminWhatsAppMessage {
    id: number;
    waMessageId: string | null;
    direction: WhatsAppMessageDirection;
    type: WhatsAppMessageType;
    body: string;
    status: WhatsAppMessageStatus;
    errorMessage: string;
    timestamp: string;
    mediaId: string;
    mediaUrl: string;
    mimeType: string;
    filename: string;
    templateName: string;
    templateParams: string[];
    productRefs: string[];
    cartItems: Array<{
        retailer_id?: string;
        name: string;
        qty: number;
        price: string;
    }>;
    interactiveButtons: Array<{ id?: string; text: string }>;
    replyToId: number | null;
    reactions: Array<{ emoji: string; by?: string }>;
    author: number | null;
    authorName: string | null;
    isInternalNote: boolean;
}

export interface AdminWhatsAppMessageWrite {
    body: string;
    isNote?: boolean;
}

export interface AdminWhatsAppConversation {
    id: number;
    contact: AdminWhatsAppContact;
    status: WhatsAppConversationStatus;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    assignedTo: number | null;
    assignedToName: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string;
    lastInboundAt: string | null;
    firstMessageAt: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    windowOpen: boolean;
    serviceWindowExpiresAt: string | null;
    botPaused: boolean;
    starred: boolean;
    unreadCount: number;
    tags: string[];
    slaFirstResponseDueAt: string | null;
    slaResolutionDueAt: string | null;
    slaBreached: boolean;
    csat: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppConversationDetail extends AdminWhatsAppConversation {
    messages: AdminWhatsAppMessage[];
    notes: string;
}

export interface AdminWhatsAppConversationFilters {
    tab?: 'all' | 'unassigned' | 'mine' | 'open' | 'resolved';
    search?: string;
    assignedTo?: string | number;
    tag?: string;
}

export interface AdminWhatsAppAssignWrite {
    userId: number | null;
}

export interface AdminWhatsAppResolveWrite {
    csat?: number;
    note?: string;
}

export interface AdminWhatsAppTagWrite {
    tags: string[];
}

export interface AdminWhatsAppNoteWrite {
    text?: string;
    note?: string;
}

export interface AdminWhatsAppSendProductsWrite {
    retailerIds: string[];
    headerText?: string;
    body?: string;
}

export interface AdminWhatsAppSendCartWrite {
    items: Array<{
        retailer_id: string;
        name: string;
        qty: number;
        price: string;
    }>;
    checkoutUrl?: string;
}

export type AdminWhatsAppSendMediaWrite =
    | { kind: 'image' | 'video' | 'document'; file: File; caption?: string }
    | { kind: 'image' | 'video' | 'document'; url: string; caption?: string };

export type AdminWhatsAppSendImageWrite =
    | { file: File; caption?: string }
    | { imageUrl: string; caption?: string };

export interface AdminWhatsAppSendInteractiveWrite {
    body: string;
    buttons: Array<{ text: string }>;
}

export interface AdminWhatsAppReactWrite {
    emoji: string;
}

export interface AdminWhatsAppTemplate {
    id: number;
    name: string;
    language: string;
    category: WhatsAppTemplateCategory;
    status: WhatsAppTemplateStatus;
    quality: WhatsAppQualityScore | 'UNKNOWN';
    components: unknown[];
    bodyText: string;
    metaTemplateId: string;
    rejectionReason: string;
    attachedCatalogItemIds: string[];
    hasProductAttachment: boolean;
    isPaused: boolean;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    repliedCount: number;
    version: number;
    lastSyncedAt: string | null;
    createdAt: string | null;
    updatedAt: string;
}

export interface AdminWhatsAppTemplateWrite {
    name: string;
    language?: string;
    category: WhatsAppTemplateCategory;
    components: unknown[];
    attachedCatalogItemIds?: string[];
}

export interface AdminWhatsAppTemplateSyncResult {
    added: number;
    updated: number;
    removed: number;
}

export interface AdminWhatsAppAutomation {
    id: number;
    name: string;
    trigger: string;
    triggerLabel: string;
    templateId: number | null;
    templateName: string;
    delayMinutes: number;
    recipients: WhatsAppAutomationRecipients;
    conditions: string;
    status: WhatsAppAutomationStatus;
    steps: Array<{
        id: number;
        position: number;
        kind: string;
        config: Record<string, unknown>;
    }>;
    messagesSent: number;
    lastTriggeredAt: string | null;
    runs: Array<{
        id: number;
        at: string;
        status: string;
        durationMs: number;
        error: string;
    }>;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppAutomationWrite {
    name: string;
    trigger: string;
    templateId?: number | null;
    templateName?: string;
    delayMinutes: number;
    recipients: WhatsAppAutomationRecipients;
    conditions?: string;
    status?: WhatsAppAutomationStatus;
    steps?: Array<{
        position?: number;
        kind: string;
        config?: Record<string, unknown>;
    }>;
}

export interface AdminWhatsAppAutomationToggleWrite {
    status?: WhatsAppAutomationStatus;
}

export type WhatsAppBroadcastAudience =
    | 'ALL_OPTED_IN'
    | 'VIP'
    | 'REPEAT_BUYERS'
    | 'NAIROBI'
    | 'BOUGHT_PRODUCT'
    | 'VIEWED_NOT_BOUGHT'
    | 'CUSTOM'
    | 'SEGMENT';

export interface AdminWhatsAppBroadcast {
    id: number;
    campaignName: string;
    templateId: number | null;
    templateName: string;
    audience: WhatsAppBroadcastAudience;
    audienceRuleRef: string;
    segmentId: number | null;
    audienceCount: number;
    attachedCatalogItemIds: string[];
    hasProductAttachment: boolean;
    variableMapping: Record<string, unknown>;
    abTest: boolean;
    recipients: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    estimatedCostKes: string;
    actualCostKes: string;
    sentAt: string | null;
    scheduledAt: string | null;
    completedAt: string | null;
    status: WhatsAppBroadcastStatus;
    lastError: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppBroadcastWrite {
    campaignName: string;
    templateName: string;
    audience: WhatsAppBroadcastAudience;
    audienceRuleRef?: string;
    segmentId?: number | null;
    customFilter?: Record<string, unknown>;
    attachedCatalogItemIds?: string[];
    variableMapping?: Record<string, unknown>;
    abTest?: boolean;
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
    pending: number;
}

export interface AdminWhatsAppSegment {
    id: number;
    name: string;
    description: string;
    rules: Array<Record<string, unknown>>;
    count: number;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppSegmentWrite {
    name: string;
    description?: string;
    rules?: Array<Record<string, unknown>>;
}

export interface AdminWhatsAppQuickReply {
    id: number;
    shortcut: string;
    title: string;
    body: string;
    category: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppQuickReplyWrite {
    shortcut: string;
    title: string;
    body: string;
    category?: string;
}

export interface AdminWhatsAppOrderItem {
    product_id: string;
    name: string;
    qty: number;
    priceKes: number;
}

export interface AdminWhatsAppOrder {
    id: number;
    orderNumber: string;
    contactId: number | null;
    contactName: string;
    phone: string;
    contactWaId: string;
    conversationId: number | null;
    checkoutOrderId: number | null;
    items: AdminWhatsAppOrderItem[];
    subtotal: string;
    total: string;
    currency: string;
    status: string;
    paymentMethod: string;
    paymentRef: string;
    deliveryAddress: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppOrderUpdate {
    status?: string;
    payment_method?: string;
    payment_ref?: string;
    delivery_address?: string;
}

export interface AdminWhatsAppWebhookEvent {
    id: number;
    type: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: 'DELIVERED' | 'FAILED' | 'RETRYING';
    attempts: number;
    signatureValid: boolean;
    latencyMs: number;
    error: string;
    receivedAt: string | null;
}

export interface AdminWhatsAppInvoice {
    id: number;
    periodStart: string;
    periodEnd: string;
    amountKes: string;
    currency: string;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
    issuedAt: string;
    pdfUrl: string;
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
        name: string;
        value: number;
        color: string;
    }>;
    total: number;
    currency: string;
}

export interface AdminWhatsAppAnalyticsFunnelStage {
    stage: string;
    count: number;
}

export interface AdminWhatsAppAgentLeaderboardRow {
    id: number;
    userId: number;
    name: string;
    messages: number;
    avgResponseMin: number;
    csat: number;
    slaRate: number;
    resolved: number;
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
    status: string;
    wa_id: string;
}

export interface AdminWhatsAppBotNodeOption {
    id: string;
    label: string;
    next_id?: string;
}

export interface AdminWhatsAppBotNode {
    id: number;
    flowId: number;
    key: string;
    kind: string;
    title: string;
    body: string;
    options: AdminWhatsAppBotNodeOption[];
    config: Record<string, unknown>;
    positionX: number;
    positionY: number;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppBotNodeWrite {
    key: string;
    kind: string;
    title: string;
    body?: string;
    options?: AdminWhatsAppBotNodeOption[];
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
}

export interface AdminWhatsAppBotFlow {
    id: number | null;
    name: string;
    isPublished: boolean;
    entryNodeKey: string;
    nodes: AdminWhatsAppBotNode[];
}

export interface AdminWhatsAppBotFlowWrite {
    name?: string;
    entry_node_key?: string;
    is_published?: boolean;
    nodes?: AdminWhatsAppBotNodeWrite[];
}

export type AdminSocialPlatform =
    | 'Facebook'
    | 'Instagram'
    | 'TikTok'
    | 'YouTube';

export interface AdminSocialAccount {
    id: AdminSocialPlatform;
    name: string;
    handle: string;
    connected: boolean;
    avatarBg: string;
    avatarUrl?: string;
    followers?: number;
}

export interface AdminSocialAccountDetail {
    id: AdminSocialPlatform;
    platform: AdminSocialPlatform;
    handle: string;
    display_name: string;
    platform_user_id: string;
    is_connected: boolean;
    is_token_expired: boolean;
    is_token_expiring_soon: boolean;
    connected_at: string | null;
    token_expires_at: string | null;
    last_synced_at: string | null;
    scopes: string[];
    followers: number;
    avatar_url: string;
    last_error: string;
    created_at: string;
    updated_at: string;
}

export interface AdminSocialAccountCapabilities {
    supports_comments: boolean;
    supports_direct_messages: boolean;
    supports_mentions: boolean;
    supports_demographics: boolean;
    supports_best_times: boolean;
    supports_boost: boolean;
    supports_delete_post: boolean;
    supports_edit_caption: boolean;
    supports_first_comment: boolean;
    supports_stories: boolean;
    supports_reels: boolean;
    supports_shorts: boolean;
    supports_carousel: boolean;
    max_caption_length: number;
    max_media_count: number;
    max_video_duration_sec: number;
    requires_video: boolean;
}

export interface AdminSocialPaginated<T> {
    results: T[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
}

export interface AdminSocialScheduledPost {
    id: string;
    platforms: AdminSocialPlatform[];
    caption: string;
    scheduledTime: string;
    productTag?: string | null;
    mediaUrl?: string | null;
    campaign?: string;
    status?: string;
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
    status?: string;
    errorMessage?: string;
    platformUrl?: string;
    platformPostId?: string;
    impressions?: number;
    saves?: number;
    videoViews?: number;
    watchTimeSec?: number;
    linkClicks?: number;
    profileVisits?: number;
    followerDelta?: number;
    engagementRate?: number;
}

export interface AdminSocialMediaFolder {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    created_at: string;
}

export interface AdminSocialMedia {
    id: number;
    url: string;
    mediaType: 'IMAGE' | 'VIDEO';
    media_type?: 'IMAGE' | 'VIDEO';
    filename: string;
    name?: string;
    sizeBytes: number;
    size?: number;
    sortOrder: number;
    sort_order?: number;
    title?: string;
    tags?: string[];
    folder_id?: number | null;
    width?: number;
    height?: number;
    durationSeconds?: number;
    duration_seconds?: number;
    usedIn?: number[];
    created_at?: string;
}

export interface AdminSocialQueueSlot {
    id: number;
    name: string;
    kind: 'STANDARD' | 'EVERGREEN';
    days: string[];
    timeOfDay: string;
    timezone: string;
    platforms: AdminSocialPlatform[];
    isActive: boolean;
    created_at: string;
}

export interface AdminSocialQueueSlotWrite {
    name: string;
    kind?: 'STANDARD' | 'EVERGREEN';
    days: string[];
    timeOfDay: string;
    timezone?: string;
    platforms: AdminSocialPlatform[];
    isActive?: boolean;
}

export interface AdminSocialEvergreenPost {
    id: number;
    caption: string;
    platforms: AdminSocialPlatform[];
    productTag: string;
    lastUsedAt: string | null;
    useCount: number;
    isActive: boolean;
    created_at: string;
}

export interface AdminSocialEvergreenPostWrite {
    caption: string;
    platforms?: AdminSocialPlatform[];
    productTag?: string;
    isActive?: boolean;
}

export type AdminSocialDraftStatus =
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'SCHEDULED';

export interface AdminSocialDraftComment {
    id: number;
    authorId: number | null;
    authorName: string;
    body: string;
    decision: string;
    created_at: string;
}

export interface AdminSocialDraft {
    id: number;
    title: string;
    caption: string;
    platforms: AdminSocialPlatform[];
    fields: Record<string, unknown>;
    status: AdminSocialDraftStatus;
    authorId: number | null;
    authorName: string;
    reviewerId: number | null;
    reviewerName: string;
    source_post_id: number | null;
    comments: AdminSocialDraftComment[];
    last_edited_at: string;
    created_at: string;
}

export interface AdminSocialDraftWrite {
    title?: string;
    caption?: string;
    platforms?: AdminSocialPlatform[];
    fields?: Record<string, unknown>;
}

export interface AdminSocialDraftCommentWrite {
    body: string;
    decision?: 'APPROVED' | 'REJECTED' | 'CHANGES' | '';
}

export type AdminSocialInboxItemType = 'COMMENT' | 'DM' | 'MENTION';
export type AdminSocialInboxStatus = 'OPEN' | 'RESOLVED' | 'SNOOZED' | 'SPAM';
export type AdminSocialSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface AdminSocialInboxReply {
    id: number;
    authorId: number | null;
    authorName: string;
    body: string;
    isOutbound: boolean;
    created_at: string;
}

export interface AdminSocialInboxItem {
    id: number;
    itemType: AdminSocialInboxItemType;
    status: AdminSocialInboxStatus;
    sentiment: AdminSocialSentiment;
    platform: AdminSocialPlatform;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    body: string;
    permalink: string;
    assignedTo: number | null;
    assignedName: string;
    targetId: number | null;
    postCaption: string;
    replies: AdminSocialInboxReply[];
    receivedAt: string;
    created_at: string;
    updated_at: string;
}

export interface AdminSocialInboxFilters {
    item_type?: AdminSocialInboxItemType;
    status?: AdminSocialInboxStatus;
    platform?: AdminSocialPlatform;
    sentiment?: AdminSocialSentiment;
    assigned_to?: 'me' | 'unassigned';
    search?: string;
    page?: number;
    page_size?: number;
}

export interface AdminSocialTemplate {
    id: number;
    name: string;
    category: string;
    caption: string;
    platforms: AdminSocialPlatform[];
    fields: Record<string, unknown>;
    isShared: boolean;
    createdById: number | null;
    created_at: string;
    updated_at: string;
}

export interface AdminSocialTemplateWrite {
    name: string;
    category?: string;
    caption?: string;
    platforms?: AdminSocialPlatform[];
    fields?: Record<string, unknown>;
    isShared?: boolean;
}

export interface AdminSocialLink {
    id: number;
    shortCode: string;
    destination: string;
    utm: Record<string, string>;
    clicks: number;
    createdById: number | null;
    created_at: string;
    updated_at: string;
}

export interface AdminSocialLinkWrite {
    destination: string;
    utm?: Record<string, string>;
}

export type AdminSocialNotificationType =
    | 'POST_PUBLISHED'
    | 'POST_FAILED'
    | 'TOKEN_EXPIRING'
    | 'TOKEN_EXPIRED'
    | 'APPROVAL_NEEDED'
    | 'APPROVAL_GIVEN'
    | 'NEW_COMMENT'
    | 'NEW_DM'
    | 'NEW_MENTION'
    | 'REPORT_READY';

export interface AdminSocialNotification {
    id: number;
    notificationType: AdminSocialNotificationType;
    title: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: string;
}

export interface AdminSocialNotificationList
    extends AdminSocialPaginated<AdminSocialNotification> {
    unread_count: number;
}

export type AdminSocialTeamRole =
    | 'OWNER'
    | 'ADMIN'
    | 'EDITOR'
    | 'APPROVER'
    | 'VIEWER';

export interface AdminSocialTeamMember {
    id: number;
    userId: number;
    email: string;
    fullName: string;
    role: AdminSocialTeamRole;
    isActive: boolean;
    invited_at: string | null;
    joined_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminSocialTeamMemberWrite {
    email: string;
    role: AdminSocialTeamRole;
}

export interface AdminSocialTeamMemberPatch {
    role?: AdminSocialTeamRole;
    isActive?: boolean;
}

export interface AdminSocialAuditLog {
    id: number;
    actorId: number | null;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, unknown>;
    createdAt: string;
}

export interface AdminSocialReport {
    id: number;
    name: string;
    dateFrom: string;
    dateTo: string;
    platforms: AdminSocialPlatform[];
    metrics: string[];
    branding: Record<string, unknown>;
    format: 'PDF' | 'CSV' | 'PNG';
    fileUrl: string | null;
    createdById: number | null;
    generatedAt: string | null;
    created_at: string;
}

export interface AdminSocialReportWrite {
    name: string;
    dateFrom: string;
    dateTo: string;
    platforms?: AdminSocialPlatform[];
    metrics?: string[];
    branding?: Record<string, unknown>;
    format?: 'PDF' | 'CSV' | 'PNG';
}

export interface AdminSocialKpis {
    total_followers: number;
    reach: number;
    engagement_rate: number;
    posts_published: number;
    unread_inbox: number;
    scheduled_this_week: number;
    failed_posts: number;
}

export interface AdminSocialOverview {
    kpis: AdminSocialKpis;
    expiring_tokens: { platform: AdminSocialPlatform; expires_at: string | null }[];
    upcoming: AdminSocialScheduledPost[];
    recent_activity: AdminSocialAuditLog[];
    top_posts: AdminSocialPublishedPost[];
}

export interface AdminSocialDemographicSnapshot {
    id: number;
    platform: AdminSocialPlatform;
    date: string;
    ageBuckets: Record<string, number>;
    gender: Record<string, number>;
    topCities: { name: string; count: number }[];
    topCountries: { code: string; name: string; count: number }[];
    updated_at: string;
}

export interface AdminSocialBestTimeRow {
    id: number;
    platform: AdminSocialPlatform;
    dayOfWeek: number;
    hour: number;
    score: number;
    sampleSize: number;
    updated_at: string;
}

export interface AdminSocialKpiAnalytics {
    current: {
        reach: number;
        impressions: number;
        likes: number;
        comments: number;
        shares: number;
        link_clicks: number;
        posts: number;
        engagement: number;
        engagement_rate: number;
    };
    previous: {
        reach: number;
        impressions: number;
        likes: number;
        comments: number;
        shares: number;
        link_clicks: number;
        posts: number;
        engagement: number;
        engagement_rate: number;
    };
    deltas: {
        reach: number;
        engagement: number;
        engagement_rate: number;
        link_clicks: number;
        posts: number;
    };
}

export interface AdminSocialPostWrite {
    caption: string;
    platforms: AdminSocialPlatform[];
    productTag?: string;
    firstComment?: string;
    campaign?: string;
    linkUrl?: string;
    linkUtm?: Record<string, string>;
    mediaIds?: number[];
    scheduleAt?: string | null;
}

export interface AdminSocialPostCreated {
    id: number;
    status: string;
}

export interface AdminSocialPostPatch {
    caption?: string;
    first_comment?: string;
    firstComment?: string;
    product_tag?: string;
    productTag?: string;
    scheduled_for?: string;
    scheduleAt?: string;
}

export interface AdminSocialBulkIds {
    ids: (number | string)[];
}

export interface AdminSocialBulkReschedule {
    ids: (number | string)[];
    scheduleAt: string;
}

export interface AdminSocialBoostWrite {
    budget_cents: number;
    duration_days: number;
    audience?: Record<string, unknown>;
}

export interface AdminSocialBoostResult {
    boost_id: string;
    status: string;
    estimated_reach: number;
}

export interface AdminSocialEditCaptionWrite {
    caption: string;
}

export interface InboxReplyCreateBody {
    body: string;
}

export interface AdminSocialFollowerPoint {
    month: string;
    Facebook: number;
    Instagram: number;
    TikTok: number;
    YouTube: number;
}

export interface AdminSocialEngagementPoint {
    platform: AdminSocialPlatform;
    Reach: number;
    Engagement: number;
}

export type AdminDirectOrderStatus =
    | 'New'
    | 'Awaiting Payment'
    | 'Paid'
    | 'Awaiting Shipment'
    | 'Shipped'
    | 'Delivered'
    | 'Cancelled'
    | 'Returned';

export type AdminDirectOrderSource =
    | 'whatsapp'
    | 'phone'
    | 'admin'
    | 'live'
    | 'video_dm'
    | 'bio_link';

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

export interface AdminDirectOrderWrite {
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerId?: number | null;
    source?: AdminDirectOrderSource;
    status?: AdminDirectOrderStatus;
    paymentMethod?: string;
    paymentStatus?: string;
    paymentReference?: string;
    shipping?: string;
    discount?: string;
    courier?: string;
    trackingNumber?: string;
    shippingZone?: string;
    priority?: string;
    assignedTo?: number | null;
    creatorId?: number | null;
    commission?: string;
    campaignId?: number | null;
    attributionId?: number | null;
    notes?: string;
    tags?: string[];
    items: Array<{
        productId?: number;
        variantId?: number | null;
        productName: string;
        sku?: string;
        image?: string;
        qty: number;
        price: string;
        costPrice?: string;
    }>;
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
    followers: number;
    niche: string;
    commissionRate: number;
    commissionOwed: string;
    commissionPaid: string;
    revenue: string;
    salesDriven: number;
    ordersCount: number;
    status: AdminDirectCreatorStatus;
    startDate: string | null;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminDirectCreatorWrite {
    name: string;
    handle: string;
    platform?: AdminDirectContentPlatform | string;
    avatar?: string;
    followers?: number;
    niche?: string;
    commissionRate?: number;
    status?: AdminDirectCreatorStatus;
    startDate?: string | null;
    notes?: string;
}

export interface AdminDirectContent {
    id: number;
    title: string;
    type: string;
    status: AdminDirectContentStatus;
    platform: AdminDirectContentPlatform;
    scheduledAt: string | null;
    script: string;
    caption: string;
    hashtags: string;
    postedUrl: string;
    thumbnailUrl: string;
    videoUrl: string;
    products: string[];
    productName: string;
    views: number;
    likes: number;
    comments: number;
    createdAt: string;
    updatedAt: string;
}

export interface AdminDirectContentWrite {
    title: string;
    type?: string;
    status?: AdminDirectContentStatus;
    platform?: AdminDirectContentPlatform;
    scheduledAt?: string | null;
    script?: string;
    caption?: string;
    hashtags?: string;
    postedUrl?: string;
    thumbnailUrl?: string;
    videoUrl?: string | null;
    products?: string[];
    productName?: string;
    views?: number;
    likes?: number;
    comments?: number;
}

export interface AdminDirectLive {
    id: number;
    title: string;
    scheduledAt: string;
    durationMin: number;
    status: AdminDirectLiveStatus;
    hostName: string;
    products: string[];
    peakViewers: number;
    ordersGenerated: number;
    revenue: string;
    topProduct: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminDirectLiveWrite {
    title: string;
    scheduledAt: string;
    durationMin?: number;
    status?: AdminDirectLiveStatus;
    hostName?: string;
    products?: string[];
    peakViewers?: number;
    ordersGenerated?: number;
    revenue?: string;
    topProduct?: string;
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
    directSalesCount: number;
    directRevenue: string;
    status: AdminDirectProductStatus;
    viral: boolean;
    videoLink: string;
    lowStockThreshold: number;
    linkedToWebsite: boolean;
    costPrice?: string;
    supplierId?: number | null;
    reorderPoint?: number;
    reorderQuantity?: number;
    isBundle?: boolean;
    isPreorder?: boolean;
    preorderEta?: string | null;
    commissionRate?: string;
    tags?: string[];
    seo_title?: string;
    seo_description?: string;
    margin?: string;
    marginPercent?: string;
    variants?: AdminProductVariant[];
    createdAt: string;
    updatedAt: string;
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
    viral?: boolean;
    videoLink?: string;
    lowStockThreshold?: number;
    linkedToWebsite?: boolean;
    costPrice?: number;
    supplierId?: number | null;
    reorderPoint?: number;
    reorderQuantity?: number;
    isBundle?: boolean;
    isPreorder?: boolean;
    preorderEta?: string | null;
    tags?: string[];
    seo_title?: string;
    seo_description?: string;
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

export interface AdminPurchaseOrderItem {
    id: number;
    productId: number | null;
    productName: string;
    quantity: number;
    unitCost: string;
    subtotal: string;
}

export interface AdminPurchaseOrder {
    id: number;
    reference: string;
    supplierId: number;
    supplierName: string;
    status: 'Draft' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled';
    expectedAt: string | null;
    receivedAt: string | null;
    subtotal: string;
    shipping: string;
    total: string;
    notes: string;
    items: AdminPurchaseOrderItem[];
    createdAt: string;
    updatedAt: string;
}

export interface AdminPurchaseOrderWrite {
    supplierId: number;
    status?: 'Draft' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled';
    expectedAt?: string | null;
    shipping?: string;
    notes?: string;
    items?: Array<{
        productId?: number | null;
        productName: string;
        quantity: number;
        unitCost: string;
    }>;
}

export interface AdminLocation {
    id: number;
    name: string;
    kind: 'warehouse' | 'shop' | 'pickup';
    address: string;
    county: string;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminLocationWrite {
    name: string;
    kind?: 'warehouse' | 'shop' | 'pickup';
    address?: string;
    county?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

export interface AdminCustomerFull {
    id: number;
    name: string;
    phone: string;
    email: string;
    county: string;
    estate: string;
    address: string;
    segment: 'New' | 'Repeat' | 'VIP' | 'Wholesale' | 'COD Risk' | 'Inactive';
    tags: string[];
    whatsappOptIn: boolean;
    smsOptIn: boolean;
    emailOptIn: boolean;
    birthday: string | null;
    totalOrders: number;
    lifetimeSpend: string;
    avgOrderValue: string;
    lastOrderAt: string | null;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminCustomerFullWrite {
    name: string;
    phone: string;
    email?: string;
    county?: string;
    estate?: string;
    address?: string;
    segment?: 'New' | 'Repeat' | 'VIP' | 'Wholesale' | 'COD Risk' | 'Inactive';
    tags?: string[];
    whatsappOptIn?: boolean;
    smsOptIn?: boolean;
    emailOptIn?: boolean;
    birthday?: string | null;
    notes?: string;
}

export interface AdminCustomerStatsFull {
    total: number;
    repeat: number;
    vip: number;
    repeatRate: number;
    lifetimeSpend: string;
}

export interface AdminInboxMessage {
    id: number;
    direction: 'in' | 'out';
    body: string;
    attachmentUrl: string;
    sentBy: number | null;
    externalId: string;
    createdAt: string;
}

export interface AdminInboxMessageWrite {
    conversation: number;
    direction?: 'in' | 'out';
    body: string;
    attachmentUrl?: string;
    externalId?: string;
}

export interface AdminInboxConversation {
    id: number;
    channel: 'whatsapp' | 'tiktok_dm' | 'tiktok_comment' | 'instagram_dm' | 'phone' | 'email';
    status: 'open' | 'pending' | 'converted' | 'closed' | 'spam';
    subject: string;
    customerId: number | null;
    contactName: string;
    contactHandle: string;
    assignedTo: number | null;
    convertedOrder: number | null;
    unreadCount: number;
    lastMessageAt: string | null;
    tags: string[];
    messages: AdminInboxMessage[];
    createdAt: string;
    updatedAt: string;
}

export interface AdminInboxConversationWrite {
    channel?: 'whatsapp' | 'tiktok_dm' | 'tiktok_comment' | 'instagram_dm' | 'phone' | 'email';
    status?: 'open' | 'pending' | 'converted' | 'closed' | 'spam';
    subject?: string;
    customerId?: number | null;
    contactName?: string;
    contactHandle?: string;
    assignedTo?: number | null;
    unreadCount?: number;
    tags?: string[];
}

export interface AdminInboxConvertWrite {
    customerName?: string;
    customerPhone?: string;
    source?: AdminDirectOrderSource;
    items: Array<{
        productId?: number;
        productName: string;
        sku?: string;
        image?: string;
        qty: number;
        price: string;
    }>;
    notes?: string;
}

export interface AdminTeamMember {
    id: number;
    userId: number | null;
    name: string;
    email: string;
    phone: string;
    role: 'Owner' | 'Admin' | 'Operations' | 'Finance' | 'Content' | 'Support' | 'Creator';
    status: 'Active' | 'Invited' | 'Suspended';
    permissions: Record<string, unknown>;
    locationId: number | null;
    lastActiveAt: string | null;
    invitedAt: string;
    joinedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminTeamMemberWrite {
    userId?: number | null;
    name: string;
    email: string;
    phone?: string;
    role?: 'Owner' | 'Admin' | 'Operations' | 'Finance' | 'Content' | 'Support' | 'Creator';
    status?: 'Active' | 'Invited' | 'Suspended';
    permissions?: Record<string, unknown>;
    locationId?: number | null;
}

export interface AdminExpense {
    id: number;
    title: string;
    category: 'inventory' | 'shipping' | 'marketing' | 'creator' | 'software' | 'rent' | 'utilities' | 'salaries' | 'tax' | 'other';
    amount: string;
    paidOn: string;
    paymentMethod: string;
    reference: string;
    notes: string;
    receiptUrl: string;
    recordedBy: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminExpenseWrite {
    title: string;
    category?: 'inventory' | 'shipping' | 'marketing' | 'creator' | 'software' | 'rent' | 'utilities' | 'salaries' | 'tax' | 'other';
    amount: string;
    paidOn?: string;
    paymentMethod?: string;
    reference?: string;
    notes?: string;
    receiptUrl?: string;
}

export interface AdminAutomation {
    id: number;
    name: string;
    trigger: string;
    action: string;
    status: 'Draft' | 'Active' | 'Paused';
    channel: string;
    template: string;
    delayMinutes: number;
    conditions: Record<string, unknown>;
    runsCount: number;
    lastRunAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminAutomationWrite {
    name: string;
    trigger: string;
    action: string;
    status?: 'Draft' | 'Active' | 'Paused';
    channel?: string;
    template?: string;
    delayMinutes?: number;
    conditions?: Record<string, unknown>;
}

export interface AdminNotification {
    id: number;
    title: string;
    body: string;
    kind: 'info' | 'success' | 'warning' | 'danger';
    link: string;
    recipientId: number | null;
    readAt: string | null;
    createdAt: string;
}

export interface AdminAuditLog {
    id: number;
    action: string;
    entity: string;
    entityId: string;
    summary: string;
    diff: Record<string, unknown>;
    actorId: number | null;
    actorName: string;
    ipAddress: string | null;
    userAgent: string;
    createdAt: string;
}

export interface AdminAuditLogFilters {
    entity?: string;
    action?: string;
    limit?: number;
    offset?: number;
}

export interface AdminDeliveryZoneFull {
    id: number;
    name: string;
    zone: string;
    counties: string[];
    baseFee: string;
    freeOver: string;
    etaDaysMin: number;
    etaDaysMax: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminDeliveryZoneFullWrite {
    name: string;
    zone: string;
    counties?: string[];
    baseFee?: string;
    freeOver?: string;
    etaDaysMin?: number;
    etaDaysMax?: number;
    isActive?: boolean;
}

export interface AdminCoupon {
    id: number;
    code: string;
    description: string;
    percentOff: string;
    amountOff: string;
    minOrderValue: string;
    startsAt: string | null;
    endsAt: string | null;
    maxUses: number;
    uses: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminCouponWrite {
    code: string;
    description?: string;
    percentOff?: string;
    amountOff?: string;
    minOrderValue?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    maxUses?: number;
    isActive?: boolean;
}

export interface AdminCampaignFull {
    id: number;
    name: string;
    slug: string;
    status: 'Draft' | 'Active' | 'Paused' | 'Ended';
    startsAt: string | null;
    endsAt: string | null;
    budget: string;
    objective: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminCampaignFullWrite {
    name: string;
    slug?: string;
    status?: 'Draft' | 'Active' | 'Paused' | 'Ended';
    startsAt?: string | null;
    endsAt?: string | null;
    budget?: string;
    objective?: string;
    notes?: string;
}

export interface AdminAttributionLink {
    id: number;
    kind: 'link' | 'code' | 'utm';
    code: string;
    label: string;
    url: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    creatorId: number | null;
    campaignId: number | null;
    contentId: number | null;
    liveId: number | null;
    clicks: number;
    conversions: number;
    revenue: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminAttributionLinkWrite {
    kind?: 'link' | 'code' | 'utm';
    code: string;
    label?: string;
    url?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    creatorId?: number | null;
    campaignId?: number | null;
    contentId?: number | null;
    liveId?: number | null;
    isActive?: boolean;
}

export interface AdminPayoutBatch {
    id: number;
    reference: string;
    status: 'Draft' | 'Pending' | 'Approved' | 'Paid' | 'Failed';
    totalAmount: string;
    itemsCount: number;
    payoutMethod: string;
    approvedBy: number | null;
    approvedAt: string | null;
    paidAt: string | null;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminPayoutBatchWrite {
    status?: 'Draft' | 'Pending' | 'Approved' | 'Paid' | 'Failed';
    payoutMethod?: string;
    notes?: string;
    saleIds?: number[];
}

export interface AdminAnalyticsSummaryResponse {
    monthOrders: number;
    monthRevenue: string;
    pendingShipment: number;
    activeCreators: number;
    bySource: Array<{
        source: string;
        count: number;
        revenue: string | null;
    }>;
    byStatus: Array<{
        status: string;
        count: number;
    }>;
    daily: Array<{
        day: string;
        date: string;
        orders: number;
        revenue: string;
    }>;
}

export interface AdminFinanceSummaryResponse {
    grossRevenue: string;
    creatorCommissions: string;
    withholdingTax: string;
    expenses: string;
    netRevenue: string;
}

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
    | 'anthropic'
    | 'custom';

export type AdminAIUsageFeature =
    | 'assistant'
    | 'content'
    | 'search'
    | 'insights'
    | 'automation'
    | 'chart';

export interface AdminAIChartSeries {
    key: string;
    label: string;
    color: string;
}

export type AdminAIChartSpec =
    | {
        type: 'line';
        data: Array<Record<string, number | string>>;
        xKey: string;
        series: AdminAIChartSeries[];
    }
    | {
        type: 'area';
        data: Array<Record<string, number | string>>;
        xKey: string;
        series: AdminAIChartSeries[];
    }
    | {
        type: 'bar';
        data: Array<Record<string, number | string>>;
        xKey: string;
        series: AdminAIChartSeries[];
    }
    | {
        type: 'pie';
        data: Array<{ name: string; value: number; color: string }>;
    }
    | {
        type: 'doughnut';
        data: Array<{ name: string; value: number; color: string }>;
    };

export interface AdminAIOverview {
    assistant_status: 'Active' | 'Inactive';
    active_automations: number;
    total_automations: number;
    automations_enabled: number;
    tokens_this_month: number;
    estimated_cost_kes: number;
    monthly_budget_kes: number;
    budget_used_pct: number;
    active_alerts: number;
    active_insights: number;
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

export type AdminAIConversationStatus = 'active' | 'archived';

export interface AdminAIConversation {
    id: string | number;
    title: string;
    updatedAt: string;
    group: 'Today' | 'Yesterday' | 'Last 7 days' | 'Older';
    status?: AdminAIConversationStatus;
    origin_path?: string;
    origin_module?: string;
    model?: string;
    provider?: string;
    total_tokens_in?: number;
    total_tokens_out?: number;
    total_cost_kes?: number;
    message_count?: number;
    is_pinned?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface AdminAIConversationDetail extends AdminAIConversation {
    messages: AdminAIMessage[];
}

export interface AdminAIConversationCreateWrite {
    title?: string;
    origin_path?: string;
    origin_module?: string;
    model?: string;
}

export interface AdminAIConversationUpdateWrite {
    title?: string;
    status?: AdminAIConversationStatus;
    is_pinned?: boolean;
}

export type AdminAIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type AdminAIMessageStatus =
    | 'ok'
    | 'error'
    | 'streaming'
    | 'cancelled';

export interface AdminAIMessage {
    id: string | number;
    role: AdminAIMessageRole;
    status?: AdminAIMessageStatus;
    content: string;
    chart?: AdminAIChartSpec | null;
    table?: { headers: string[]; rows: string[][] } | null;
    link?: { label: string; href: string } | null;
    quickReplies?: string[] | null;
    quick_replies?: string[] | null;
    toolName?: string;
    toolArgs?: Record<string, unknown> | null;
    isVerified?: boolean;
    dataSources?: string[];
    missingData?: string[];
    errorMessage?: string;
    tokens_in?: number;
    tokens_out?: number;
    latencyMs?: number;
    model?: string;
    tool_calls?: AdminAIToolCall[];
    timestamp: string;
    created_at?: string;
}

export interface AdminAIMessageWrite {
    content: string;
    context?: {
        path?: string;
        label?: string;
        description?: string;
    };
}

export interface AdminAIAttachmentInput {
    id?: string;
    name: string;
    size: number;
    type: string;
    preview?: string;
}

export interface AdminAIProvenanceItem {
    label: string;
    detail?: string;
    href?: string;
    count?: number;
}

export interface AdminAIMessageAction {
    id: string;
    label: string;
    tone?: 'default' | 'danger' | 'primary';
    href?: string;
    prompt?: string;
    requiresConfirmation?: boolean;
    params?: Record<string, unknown>;
}

export interface AdminAIToolCallInline {
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    params?: Record<string, unknown>;
    resultSummary?: string;
    durationMs?: number;
}

export interface AdminAIPendingAction {
    id: string;
    tool: string;
    title: string;
    description: string;
    params: Record<string, unknown>;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    preview?: Array<{ label: string; value: string }>;
}

export interface AdminAIActionExecuteWrite {
    tool: string;
    params?: Record<string, unknown>;
    confirm?: boolean;
    confirmation_token?: string;
}

export interface AdminAIActionExecuteResponse {
    success: boolean;
    message: string;
    result: Record<string, unknown>;
}

export interface AdminAIDigestItem {
    label: string;
    value: string;
    delta?: number;
    tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
    href?: string;
}

export interface AdminAIDigestResponse {
    items: AdminAIDigestItem[];
    generatedAt: string;
}

export interface AdminAIConversationExportResponse {
    content: string;
    filename: string;
    mimeType: string;
}

export interface AdminAIMessageFeedbackWrite {
    feedback: 'up' | 'down';
}

export interface AdminAIMessageFeedbackResponse {
    messageId: number | string;
    feedback: 'up' | 'down';
}

export type AdminAIToolCallStatus = 'ok' | 'error' | 'timeout';

export interface AdminAIToolCall {
    id: number;
    tool_name: string;
    arguments: Record<string, unknown> | null;
    result_summary: string;
    row_count: number;
    duration_ms: number;
    status: AdminAIToolCallStatus;
    error_message: string;
    created_at: string;
}

export interface AdminAIToolSchema {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface AdminAIToolPreviewWrite {
    name: string;
    args?: Record<string, unknown>;
}

export interface AdminAIToolPreviewResponse {
    items: unknown[];
    summary?: string;
    note?: string;
    chart?: AdminAIChartSpec;
    table?: { headers: string[]; rows: string[][] };
    link?: { label: string; href: string };
    [key: string]: unknown;
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
    content_type: AdminAIContentType | string;
    tone: string;
    language: string;
    length: string;
    model: string;
    tokens_in?: number;
    tokens_out?: number;
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
    count: number;
}

export type AdminAIAutomationKind =
    | 'low_stock'
    | 'abandoned_cart'
    | 'pending_order'
    | 'failed_payment'
    | 'return_refund'
    | 'sales_summary'
    | 'newsletter_perf'
    | 'unusual_change'
    | 'custom';

export type AdminAIAutomationScheduleKind =
    | 'interval'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'event'
    | 'manual';

export type AdminAIAutomationRunStatus =
    | 'queued'
    | 'running'
    | 'success'
    | 'failed'
    | 'skipped'
    | 'cancelled';

export type AdminAIAutomationTriggeredBy =
    | 'schedule'
    | 'manual'
    | 'event'
    | 'api';

export interface AdminAIAutomation {
    id: string | number;
    name: string;
    trigger: string;
    action: string;
    status: AdminAIAutomationStatus;
    runs: number;
    successRate: number;
    lastRun: string;
}

export interface AdminAIAutomationRun {
    id: number;
    automation: number;
    status: AdminAIAutomationRunStatus;
    triggeredBy: AdminAIAutomationTriggeredBy;
    triggeredByUser: number | null;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number;
    summary: string;
    output: Record<string, unknown>;
    itemsAffected: number;
    errorMessage: string;
    errorTrace: string;
    requestId: string;
    tokensIn: number;
    tokensOut: number;
    costKes: number;
    createdAt: string;
    startedRelative: string;
}

export interface AdminAIAutomationExtended extends AdminAIAutomation {
    kind: AdminAIAutomationKind;
    description: string;
    triggerConfig: Record<string, unknown>;
    actionConfig: Record<string, unknown>;
    isEnabled: boolean;
    scheduleKind: AdminAIAutomationScheduleKind;
    scheduleIntervalMinutes: number;
    scheduleCron: string;
    timezone: string;
    nextRunAt: string | null;
    cooldownMinutes: number;
    maxRunsPerDay: number;
    requiresApproval: boolean;
    createdBy: number | null;
    owner: number | null;
    runsFailed: number;
    lastRunAt: string | null;
    lastRunStatus: string;
    lastError: string;
    recentRuns: AdminAIAutomationRun[];
    createdAt: string;
    updatedAt: string;
}

export interface AdminAIAutomationWrite {
    name: string;
    kind?: AdminAIAutomationKind;
    description?: string;
    trigger?: string;
    action?: string;
    trigger_config?: Record<string, unknown>;
    action_config?: Record<string, unknown>;
    status?: AdminAIAutomationStatus;
    is_enabled?: boolean;
    schedule_kind?: AdminAIAutomationScheduleKind;
    schedule_interval_minutes?: number;
    schedule_cron?: string;
    timezone?: string;
    cooldown_minutes?: number;
    max_runs_per_day?: number;
    requires_approval?: boolean;
}

export interface AdminAIAutomationTemplate {
    name: string;
    kind?: AdminAIAutomationKind;
    trigger: string;
    action: string;
}

export interface AdminAIAutomationStatusWrite {
    status: AdminAIAutomationStatus;
    is_enabled?: boolean;
}

export interface AdminAIAutomationRunRequest {
    confirm?: boolean;
    dryRun?: boolean;
    params?: Record<string, unknown>;
}

export type AdminAIAlertSeverity = 'high' | 'medium' | 'low';

export type AdminAIAlertCategory =
    | 'inventory'
    | 'orders'
    | 'payments'
    | 'customers'
    | 'returns'
    | 'messages';

export type AdminAIAlertSource = 'automation' | 'manual' | 'system';

export interface AdminAIAlert {
    id: string | number;
    severity: AdminAIAlertSeverity;
    category: AdminAIAlertCategory;
    source: AdminAIAlertSource;
    title: string;
    description: string;
    href: string;
    actionLabel: string;
    count: number;
    isActive: boolean;
    isDismissed: boolean;
    dismissedAt?: string | null;
    acknowledgedAt?: string | null;
    snoozedUntil?: string | null;
    expiresAt?: string | null;
    automation?: number | null;
    timestamp: string;
    created_at?: string;
    updated_at?: string;
}

export interface AdminAIAlertFilters {
    severity?: AdminAIAlertSeverity | 'all';
    category?: AdminAIAlertCategory | 'all';
}

export interface AdminAIAlertDismissWrite {
    reason?: string;
}

export interface AdminAIAlertSnoozeWrite {
    minutes: number;
}

export interface AdminAIInsight {
    id: string | number;
    category: AdminAIInsightCategory;
    priority: AdminAIInsightPriority;
    text: string;
    actionLabel: string;
    href: string;
    action?: { kind: string; payload?: Record<string, unknown> } | null;
    evidence?: Record<string, unknown>;
    isDismissed?: boolean;
    dismissedAt?: string | null;
    viewedAt?: string | null;
    executedAt?: string | null;
    expiresAt?: string | null;
    automation?: number | null;
    created_at?: string;
    updated_at?: string;
}

export interface AdminAIInsightExecuteResponse {
    redirect: string;
}

export interface AdminAIInsightExecuteWrite {
    confirm?: boolean;
    params?: Record<string, unknown>;
}

export interface AdminAISettings {
    enabled: boolean;
    provider: AdminAIProvider;
    model: string;
    base_url: string;
    masking: boolean;
    mask_fields: string[];
    allow_write_actions: boolean;
    require_confirmation_for_destructive: boolean;
    budget_alert: boolean;
    monthly_budget_kes: number;
    monthly_token_cap: number;
    audit_retention_days: number;
    conversation_retention_days: number;
    temperature: number;
    max_output_tokens: number;
    streaming_enabled: boolean;
    system_prompt: string;
    allowed_modules: string[];
    cache_ttl_seconds: number;
    has_api_key: boolean;
    updated_at: string;
}

export interface AdminAISettingsWrite {
    enabled?: boolean;
    provider?: AdminAIProvider;
    model?: string;
    base_url?: string;
    api_key?: string;
    masking?: boolean;
    mask_fields?: string[];
    allow_write_actions?: boolean;
    require_confirmation_for_destructive?: boolean;
    budget_alert?: boolean;
    monthly_budget_kes?: number;
    monthly_token_cap?: number;
    audit_retention_days?: number;
    conversation_retention_days?: number;
    temperature?: number;
    max_output_tokens?: number;
    streaming_enabled?: boolean;
    system_prompt?: string;
    allowed_modules?: string[];
    cache_ttl_seconds?: number;
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

export interface AdminAIUsageLogRow {
    id: number;
    feature: AdminAIUsageFeature | string;
    provider: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costKes: number;
    user: number | null;
    conversation: number | null;
    requestId: string;
    latencyMs: number;
    cacheHit: boolean;
    createdAt: string;
    timestamp: string;
}

export type AdminAIAuditAction =
    | 'chat'
    | 'query'
    | 'tool_call'
    | 'write'
    | 'destructive'
    | 'automation_run'
    | 'automation_toggle'
    | 'settings_update'
    | 'alert_dismiss'
    | 'insight_execute'
    | 'conversation_clear'
    | 'export';

export interface AdminAIAuditLog {
    id: number;
    user: number | null;
    userDisplay: string;
    action: AdminAIAuditAction | string;
    tool: string;
    args: Record<string, unknown> | null;
    resultSize: number;
    requestId: string;
    ipAddress: string | null;
    userAgent: string;
    path: string;
    permissionSnapshot: Record<string, unknown>;
    wasConfirmed: boolean;
    isVerified: boolean;
    createdAt: string;
    timestamp: string;
}

export interface AdminAIAuditLogFilters {
    action?: AdminAIAuditAction | 'all';
    user?: number;
    limit?: number;
}

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

export interface AdminRuntimeSettings {
    currency: string;
    timezone: string;
    date_format: string;
    weight_unit: string;
    business_name: string;
    business_email: string;
    business_phone: string;
    business_address: string;
    store_status: AdminStoreStatusValue;
    store_indexable: boolean;
    store_paused_message: string;
    allow_guest_checkout: boolean;
    require_phone: boolean;
    auto_confirm_orders: boolean;
    whatsapp_fallback: boolean;
    track_inventory: boolean;
    low_stock_threshold: number;
    allow_backorders: boolean;
    hide_out_of_stock: boolean;
    reviews_enabled: boolean;
    require_verified_purchase: boolean;
    auto_publish_reviews: boolean;
    allow_review_photos: boolean;
    mpesa_enabled: boolean;
    min_amount_kes: string;
    max_amount_kes: string;
    transaction_fee_kes: string;
    auto_capture_payments: boolean;
    auto_refund: boolean;
    shipping_enabled: boolean;
    free_shipping_threshold_kes: string;
    default_delivery_fee_kes: string;
    local_pickup_enabled: boolean;
    email_enabled: boolean;
    whatsapp_enabled: boolean;
    notify_on_new_order: boolean;
    notify_on_payment: boolean;
    notify_on_shipped: boolean;
    notify_on_cancelled: boolean;
    notify_on_low_stock: boolean;
    notify_on_review: boolean;
    admin_alert_email: string;
    session_timeout_minutes: number;
    require_2fa: boolean;
    vat_enabled: boolean;
    vat_rate: string;
    prices_include_tax: boolean;
    etims_enabled: boolean;
}

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

export type AdminStaffUserStatus = 'Active' | 'Invited' | 'Suspended';

export type AdminStaffUserRole =
    | 'Administrator'
    | 'Manager'
    | 'Sales Staff'
    | 'Inventory Staff'
    | 'Marketing Staff'
    | 'Support Staff';

export type AdminPermissionRole = AdminStaffUserRole | 'Customer';

export type AdminStaffInviteStatus =
    | 'Pending'
    | 'Accepted'
    | 'Cancelled'
    | 'Expired';

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

export interface AdminStaffUserWrite {
    name?: string;
    role?: AdminStaffUserRole;
    status?: AdminStaffUserStatus;
    department?: string;
    avatar?: string;
}

export interface AdminStaffFilters {
    role?: AdminStaffUserRole;
    q?: string;
}

export interface AdminStaffRole {
    id: string;
    name: AdminPermissionRole;
    description: string;
    scope: string;
    color: string;
    icon: string;
    is_customer: boolean;
}

export interface AdminPermissionRow {
    module: string;
    group: string;
    roles: Record<AdminPermissionRole, boolean>;
}

export interface AdminPermissionMatrixWrite {
    permissions: AdminPermissionRow[];
}

export interface AdminMyPermissions {
    modules: string[];
    role: AdminStaffUserRole;
    dashboard_url: string;
}

export interface AdminStaffUserInviteWrite {
    name: string;
    email: string;
    role: AdminStaffUserRole;
    department?: string;
    message?: string;
}

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
    is_valid: boolean;
}

export interface AdminInviteAcceptWrite {
    password: string;
    password_confirm: string;
}

export interface AdminInviteAcceptResult {
    user: AdminStaffUser;
    role: AdminStaffUserRole;
    redirect_to: string;
}

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
    cart_abandonment: AnalyticsCartAbandonment;
    abandoned_carts: AnalyticsAbandonedCart[];
    abandoned_trend: AnalyticsAbandonedTrendPoint[];
    error?: string;
}
export interface AnalyticsCartAbandonment {
    rate: number;
    potential_lost: number;
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

export type AdminMetaCampaignType =
    | 'product_promotion'
    | 'discount'
    | 'seasonal'
    | 'new_product'
    | 'retention'
    | 'abandoned_cart'
    | 'newsletter'
    | 'social';

export type AdminMetaCampaignStatus =
    | 'draft'
    | 'scheduled'
    | 'sending'
    | 'paused'
    | 'completed'
    | 'failed';

export type AdminMetaCampaignAudienceSource =
    | 'all'
    | 'whatsapp_segment'
    | 'newsletter_list'
    | 'newsletter_segment';

export type AdminMetaCampaignChannel = 'whatsapp' | 'email' | 'social';

export type AdminMetaCampaignDispatchStatus =
    | 'pending'
    | 'sent'
    | 'failed'
    | 'paused';

export interface AdminMetaCampaignDispatch {
    id: string;
    channel: AdminMetaCampaignChannel;
    status: AdminMetaCampaignDispatchStatus;
    external_ref_id: string;
    result: Record<string, unknown>;
    error: string;
    sent_at: string | null;
    created_at: string;
}

export interface AdminMetaCampaign {
    id: string;
    name: string;
    campaign_type: AdminMetaCampaignType;
    audience_source: AdminMetaCampaignAudienceSource;
    audience_ref_id: string;
    audience_size_cached: number;
    status: AdminMetaCampaignStatus;
    scheduled_at: string | null;
    channels: AdminMetaCampaignChannel[];
    content: Record<string, unknown>;
    dispatches: AdminMetaCampaignDispatch[];
    created_at: string;
    updated_at: string;
}

export interface AdminMetaCampaignWrite {
    name: string;
    campaign_type: AdminMetaCampaignType;
    audience_source?: AdminMetaCampaignAudienceSource;
    audience_ref_id?: string;
    scheduled_at?: string | null;
    channels: AdminMetaCampaignChannel[];
    content?: Record<string, unknown>;
}

export interface AdminMetaCampaignAnalyticsTotals {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    failed: number;
    revenue: number;
}

export interface AdminMetaCampaignAnalyticsChannel
    extends AdminMetaCampaignAnalyticsTotals {
    channel: AdminMetaCampaignChannel;
    status: AdminMetaCampaignDispatchStatus;
    external_ref_id: string;
}

export interface AdminMetaCampaignAnalytics {
    totals: AdminMetaCampaignAnalyticsTotals;
    per_channel: AdminMetaCampaignAnalyticsChannel[];
}
export type AdminPosterStatus = 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'EXPIRED';

export interface AdminPoster {
    id: number;
    placement: string;
    order: number;
    headline: string;
    subheadline: string;
    desktop_image: string | null;
    mobile_image: string | null;
    cta_text: string;
    cta_href: string;
    brand_name: string;
    sponsor_label: string;
    status: AdminPosterStatus;
    is_published: boolean;
    start_at: string | null;
    end_at: string | null;
    impression_count: number;
    click_count: number;
    created_at: string;
    updated_at: string;
}

export interface AdminPosterWrite {
    placement?: string;
    order?: number;
    headline: string;
    subheadline?: string;
    cta_text?: string;
    cta_href?: string;
    brand_name?: string;
    sponsor_label?: string;
    is_published?: boolean;
    start_at?: string | null;
    end_at?: string | null;
}

export interface AdminPosterFilters {
    placement?: string;
    status?: AdminPosterStatus | 'ALL';
    search?: string;
}
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