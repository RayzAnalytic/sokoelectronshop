export const API_BASE = (() => {
    const env = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (env) return env.replace(/\/$/, '');
    if (
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1')
    ) {
        return 'http://localhost:8000';
    }
    return '';
})();

const ACCESS_KEY = 'razestore.access';
const REFRESH_KEY = 'razestore.refresh';

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

function withTrailingSlash(path: string): string {
    const [base, ...queryParts] = path.split('?');
    const query = queryParts.length > 0 ? `?${queryParts.join('?')}` : '';
    return base.endsWith('/') ? base + query : `${base}/${query}`;
}

type AuthListener = (authenticated: boolean) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthChange(): void {
    const authed = !!getAccessToken();
    authListeners.forEach((cb) => {
        try {
            cb(authed);
        } catch {
        }
    });
}

export function subscribeAuth(listener: AuthListener): () => void {
    authListeners.add(listener);
    try {
        listener(!!getAccessToken());
    } catch {
    }
    return () => {
        authListeners.delete(listener);
    };
}

export function getAccessToken(): string | null {
    if (!isBrowser()) return null;
    try {
        return window.localStorage.getItem(ACCESS_KEY);
    } catch {
        return null;
    }
}

export function getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    try {
        return window.localStorage.getItem(REFRESH_KEY);
    } catch {
        return null;
    }
}

export function setTokens(access: string, refresh?: string): void {
    if (!isBrowser()) return;
    try {
        window.localStorage.setItem(ACCESS_KEY, access);
        if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
        notifyAuthChange();
    } catch {
    }
}

export function clearTokens(): void {
    if (!isBrowser()) return;
    try {
        window.localStorage.removeItem(ACCESS_KEY);
        window.localStorage.removeItem(REFRESH_KEY);
        notifyAuthChange();
    } catch {
    }
}

export type Role = 'OWNER' | 'STAFF' | 'CUSTOMER';
export type Status = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface Me {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    name?: string;
    phone: string;
    role: Role;
    status: Status;
    is_email_verified: boolean;
    redirect_to: string;
    joined_at?: string;
    username?: string;
    default_address?: Address | null;
}

export interface RegisterPayload {
    email: string;
    phone: string;
    password: string;
    confirm_password?: string;
}

export interface AuthSuccessResponse {
    user: Me;
    redirect_to: string;
}

export interface JWTLoginResponse extends AuthSuccessResponse {
    access: string;
    refresh: string;
}

export interface RegisterSuccessResponse extends AuthSuccessResponse {
    access: string;
    refresh: string;
    verify_required: boolean;
}

export interface VerifyEmailResult {
    user: Me;
    redirect_to: string;
    already_verified: boolean;
}

export interface ResendVerificationResult {
    detail: string;
    resend_in: number;
}

export interface VerifyResetTokenResult {
    valid: boolean;
}

export interface InviteVerifyResult {
    valid: boolean;
    email: string;
    role: 'STAFF' | 'OWNER';
    invited_name: string;
    invited_by: string;
    expires_at?: string;
}

export interface StaffInviteAcceptPayload {
    token: string;
    phone: string;
    password: string;
    confirm_password?: string;
}

export type DecimalString = string;

export interface Paginated<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface CatalogCategory {
    id: number;
    name: string;
    slug: string;
    description: string;
    href: string;
    icon: string;
    productCount: number;
    itemCount: string;
    image: string;
    is_active: boolean;
}

export interface CatalogCategoryRef {
    id: number;
    name: string;
    slug: string;
}

export interface CatalogBrand {
    id: number;
    name: string;
    slug: string;
    logo: string;
    is_active: boolean;
}

export interface CatalogBrandRef {
    id: number;
    name: string;
    slug: string;
}

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface CatalogProduct {
    id: string;
    name: string;
    slug: string;
    brand: string;
    category: string;
    images: string[];
    price: DecimalString;
    compareAtPrice: DecimalString | null;
    stock: StockStatus;
    stockQuantity: number;
    rating: DecimalString;
    reviewCount: number;
    featured: boolean;
    bestSeller: boolean;
    salesVolume: string;
    createdAt: string;
    promoEndDate: string | null;
    discountPercentage: number | null;
    description: string;
}

export interface CatalogProductDetail extends CatalogProduct {
    features: string[];
    specs: Record<string, string>;
    relatedProducts: CatalogProduct[];
}

export interface CatalogNewArrival {
    id: string;
    slug: string;
    name: string;
    brand: string;
    category: string;
    price: DecimalString;
    compareAtPrice: DecimalString | null;
    stockStatus: StockStatus;
    stockQuantity: number;
    images: string[];
    description: string;
    rating: DecimalString;
    reviewCount: number;
    createdAt: string;
}

export interface CatalogBestSeller {
    id: string;
    slug: string;
    stockQuantity: number;
    bestSeller: boolean;
    brand: string;
    name: string;
    description: string;
    price: DecimalString;
    previousPrice: DecimalString | null;
    rating: DecimalString;
    reviewCount: number;
    stockStatus: StockStatus;
    images: string[];
    category: string;
}

export interface CatalogRelatedProduct {
    id: string;
    name: string;
    brand: string;
    price: DecimalString;
    images: string[];
}

export interface CatalogBestSellerDetail {
    product: CatalogBestSeller;
    related: CatalogRelatedProduct[];
}

export interface CatalogDealCard {
    id: string;
    productId: string;
    slug: string;
    discountCode: string;
    name: string;
    brand: string;
    category: string;
    price: DecimalString;
    originalPrice: DecimalString;
    discountPct: number;
    inStock: boolean;
    stockCount: number;
    image: string;
    description: string;
    features: string[];
    specs: Record<string, string>;
    startDate: string;
    endDate: string | null;
    promotionType: string;
    rating: DecimalString;
    reviewCount: number;
}

export interface CatalogReview {
    id: number;
    author: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    verified: boolean;
}

export interface CatalogReviewInput {
    author: string;
    rating: number;
    title?: string;
    body: string;
}

export interface CatalogCategoryPage {
    category: CatalogCategory;
    products: CatalogProduct[];
}

export interface AIChatProduct {
    id: string;
    name: string;
    brand: string;
    category: string;
    price: DecimalString;
    compareAtPrice: DecimalString | null;
    images: string[];
    stock: StockStatus;
    url: string;
}

export interface AIChatRequest {
    message: string;
    session_id?: string | null;
}

export interface AIChatResponse {
    session_id: string;
    message: string;
    products: AIChatProduct[];
    chips: string[];
    requires_auth: boolean;
}

export type BannerPlacement = 'HOME_HERO' | 'CATEGORY_HERO' | 'PROMO_STRIP';
export type BannerStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';
export type BannerAlignment = 'LEFT' | 'CENTER' | 'RIGHT';
export type BannerOverlay = 'NONE' | 'DARK' | 'LIGHT' | 'GRADIENT';

export interface Banner {
    id: number;
    name: string;
    placement: BannerPlacement;
    order: number;
    badge: string;
    headline: string;
    description: string;
    desktop_image: string;
    tablet_image: string;
    mobile_image: string;
    primary_cta_text: string;
    primary_cta_href: string;
    secondary_cta_text: string;
    secondary_cta_href: string;
    text_alignment: BannerAlignment;
    overlay_style: BannerOverlay;
    overlay_opacity: number;
    status: BannerStatus;
    start_at: string | null;
    end_at: string | null;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cvr: number;
    created_at: string;
    updated_at: string;
}

export type BannerWriteInput = Omit<
    Banner,
    | 'id'
    | 'impressions'
    | 'clicks'
    | 'conversions'
    | 'ctr'
    | 'cvr'
    | 'created_at'
    | 'updated_at'
> & {
    id?: number;
};

export interface BannerListQuery {
    q?: string;
    placement?: BannerPlacement | 'ALL';
    status?: BannerStatus | 'ALL';
    sort?: 'order' | 'recent' | 'name' | 'ctr';
}

export interface BannerStats {
    active: number;
    total: number;
    impressions: number;
    clicks: number;
    conversions: number;
}

export type BannerTrackEvent = 'impression' | 'click' | 'conversion';

export type StoreOpenStatus = 'open' | 'closed' | 'paused';

export interface StoreStatus {
    status: StoreOpenStatus;
    paused_message: string;
    business_name: string;
    tagline: string;
    currency: string;
    timezone: string;
    contact_email: string;
    contact_phone: string;
    address: string;
}

export interface WhatsapfloatQuickAction {
    id: number;
    label: string;
    message: string;
    icon: string;
}

export interface WhatsapfloatConfig {
    enabled: boolean;
    phoneNumber: string;
    displayNumber: string;
    shopName: string;
    hoursLabel: string;
    defaultMessage: string;
    quickActions: WhatsapfloatQuickAction[];
}

export type WhatsAppQuickAction = WhatsapfloatQuickAction;
export type WhatsAppConfig = WhatsapfloatConfig;

export interface WhatsAppProductLink {
    productId: string;
    productName: string;
    productUrl: string;
    whatsappUrl: string;
    message: string;
}

export interface WhatsAppOrderLink {
    reference: string;
    whatsappUrl: string;
    message: string;
}

export type WhatsAppCartHandoffStatus =
    | 'sent'
    | 'fallback'
    | 'unverified'
    | 'disabled';

export interface WhatsAppCartHandoffItem {
    productId: string;
    quantity: number;
}

export interface WhatsAppCartHandoffRequest {
    items: WhatsAppCartHandoffItem[];
    delivery: DeliveryMethod;
    coupon?: string | null;
    notes?: string | null;
}

export interface WhatsAppCartHandoffResponse {
    status: WhatsAppCartHandoffStatus;
    session_token?: string;
    checkout_url?: string;
    message: string;
}

export type WhatsAppCartSessionStatus =
    | 'CREATED'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'OPENED'
    | 'ORDERED'
    | 'EXPIRED'
    | 'FAILED';

export type WhatsAppDeliveryMethod = DeliveryMethod;

export interface WhatsAppCartSessionItem {
    product_id: string;
    variant_id: string;
    name: string;
    brand: string;
    image: string;
    variant_label: string;
    unit_price: string;
    compare_at_price: string | null;
    quantity: number;
}

export interface WhatsAppCartSession {
    token: string;
    status: WhatsAppCartSessionStatus;
    delivery_method: WhatsAppDeliveryMethod;
    coupon_code: string;
    cart_snapshot: {
        items: WhatsAppCartSessionItem[];
    };
    order: string | null;
    created_at: string;
    expires_at: string;
}

export type NewsletterSubscribeStatus =
    | 'subscribed'
    | 'already_subscribed'
    | 'reactivated';

export type NewsletterSource =
    | 'Footer Popup'
    | 'Checkout'
    | 'WhatsApp Opt-in'
    | 'Manual Import';

export interface NewsletterSubscribePayload {
    email: string;
    name?: string;
    source?: NewsletterSource;
}

export interface NewsletterSubscribeResponse {
    detail: string;
    status: NewsletterSubscribeStatus;
}

export interface NewsletterUnsubscribeResponse {
    detail: string;
}

export interface ProductsQuery {
    search?: string;
    category?: string;
    brand?: string;
    price_range?:
    | '0-10000'
    | '10000-50000'
    | '50000-100000'
    | '100000-plus'
    | 'All';
    stock?: StockStatus | 'All';
    sort_by?: 'featured' | 'price-low' | 'price-high' | 'rating' | 'newest';
    page?: number;
    page_size?: number;
}

export interface CategoryPageQuery {
    q?: string;
    stock?: 'all' | 'in-stock' | 'low-stock';
    sort?: 'featured' | 'price-low' | 'price-high' | 'newest' | 'rating';
}

export interface NewArrivalsQuery {
    search?: string;
    category?: string;
    brand?: string;
    min_price?: number | string;
    max_price?: number | string;
    stock?: StockStatus | 'All';
    sort_by?: 'newest' | 'price-low' | 'price-high' | 'rating';
    limit?: number;
    window_days?: number;
}

export interface BestSellingQuery {
    search?: string;
    category?: string;
    brand?: string;
    price_range?:
    | 'under-5000'
    | '5000-20000'
    | '20000-50000'
    | 'over-50000'
    | 'All';
    stock?: StockStatus | 'All';
    sort_by?: 'best-selling' | 'price-low-high' | 'price-high-low' | 'rating';
    limit?: number;
}

export type DealSortBy =
    | 'Featured Deals'
    | 'Biggest Discount'
    | 'Price: Low to High'
    | 'Price: High to Low'
    | 'Ending Soon';

export interface SpecialDealsQuery {
    search?: string;
    category?: string;
    brand?: string;
    min_price?: number | string;
    max_price?: number | string;
    availability?: 'In Stock' | 'Out of Stock' | 'All';
    discount_level?: 10 | 15 | 20 | 'All';
    sort_by?: DealSortBy;
}

export type DeliveryMethod = 'express' | 'standard' | 'pickup' | 'nationwide';

export type CheckoutSource = 'web' | 'whatsapp' | 'admin' | 'phone';

export interface CheckoutAddressPayload {
    street: string;
    town: string;
    county: string;
    postal_code?: string;
}

export interface CheckoutItemPayload {
    productId?: string;
    name: string;
    brand?: string;
    price: number;
    quantity: number;
    image?: string;
}

export interface CheckoutTotalsPayload {
    subtotal: number;
    discount?: number;
    shipping?: number;
    tax?: number;
    total: number;
}

export interface CheckoutPayload {
    email: string;
    phone: string;
    full_name: string;
    address: CheckoutAddressPayload;
    delivery_method: DeliveryMethod;
    estimated_delivery?: string;
    coupon?: string | null;
    notes?: string | null;
    items: CheckoutItemPayload[];
    totals: CheckoutTotalsPayload;
    source?: CheckoutSource;
    channel_meta?: Record<string, unknown>;
}

export interface Address {
    id: number;
    label: string;
    full_name: string;
    phone: string;
    street: string;
    town: string;
    county: string;
    postal_code: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface AddressInput {
    label: string;
    full_name: string;
    phone: string;
    street: string;
    town: string;
    county: string;
    postal_code?: string;
    is_default?: boolean;
}

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'returned'
    | 'cancelled'
    | 'failed';

export type OrderPaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';

export type OrderPaymentMethod = 'MPESA' | 'COD';

export interface OrderItem {
    id: number;
    product_id: string;
    name: string;
    brand: string;
    price: string;
    quantity: number;
    image: string;
    serial_number: string;
    imei: string;
    warranty_months: number;
}

export interface OrderStatusEvent {
    id: number;
    status: string;
    from_status: string;
    to_status: OrderStatus;
    note: string;
    actor_label: string;
    created_at: string;
}

export interface OrderPreviewItem {
    image: string;
    name: string;
    quantity: number;
}

export interface OrderListRow {
    id: string;
    reference: string;
    status: OrderStatus;
    payment_status: OrderPaymentStatus;
    total: string;
    currency: string;
    item_count: number;
    preview_items: OrderPreviewItem[];
    created_at: string;
}

export interface OrderDetail {
    id: string;
    reference: string;
    status: OrderStatus;
    payment_status: OrderPaymentStatus;
    payment_method: OrderPaymentMethod;
    payment_reference: string;
    mpesa_receipt: string;
    email: string;
    phone: string;
    full_name: string;
    address_street: string;
    address_town: string;
    address_county: string;
    address_postal_code: string;
    delivery_method: DeliveryMethod;
    estimated_delivery: string;
    courier: string;
    tracking_number: string;
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    total: string;
    currency: string;
    tax_enabled: boolean;
    prices_include_tax: boolean;
    coupon: string;
    notes: string;
    verify_token: string;
    items: OrderItem[];
    timeline: OrderStatusEvent[];
    created_at: string;
    updated_at: string;
    paid_at: string | null;
}

export interface OrderReorderItem {
    variant_id: string;
    product_id: string;
    name: string;
    brand: string;
    image: string;
    slug: string;
    unit_price: string;
    quantity: number;
}

export interface OrderLifecycleResult {
    status: OrderStatus;
}

export type NotificationType =
    | 'order'
    | 'shipping'
    | 'promo'
    | 'security'
    | 'system'
    | 'review';

export interface NotificationRow {
    id: number;
    type: NotificationType;
    title: string;
    body: string;
    href: string;
    metadata: Record<string, unknown>;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
}

export interface ProfileData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    whatsapp_updates: boolean;
    email_promotions: boolean;
    sms_promotions: boolean;
    newsletter: boolean;
    deletion_requested_at: string | null;
    joined_at: string;
}

export interface ProfileUpdateInput {
    first_name?: string;
    last_name?: string;
    phone?: string;
}

export interface PreferencesInput {
    whatsapp_updates?: boolean;
    email_promotions?: boolean;
    sms_promotions?: boolean;
    newsletter?: boolean;
}

export type ReviewStatus = 'published' | 'pending' | 'rejected';

export interface ReviewProductSnapshot {
    id: string;
    name: string;
    slug: string;
    image: string;
    brand: string;
}

export interface ReviewRow {
    id: number;
    product: ReviewProductSnapshot;
    variant_label: string;
    rating: number;
    title: string;
    body: string;
    images: string[];
    status: ReviewStatus;
    rejection_reason: string;
    is_verified_purchase: boolean;
    order_reference: string;
    created_at: string;
    updated_at: string;
    moderated_at: string | null;
}

export interface ReviewWriteInput {
    product_id?: string;
    product_name?: string;
    product_slug?: string;
    product_image?: string;
    product_brand?: string;
    variant_label?: string;
    order_reference?: string;
    rating?: number;
    title?: string;
    body?: string;
    images?: string[];
}

export interface PendingReviewItem {
    order_reference: string;
    delivered_at: string;
    product_id: string;
    product_name: string;
    product_image: string;
    product_brand: string;
    quantity: number;
}

export type WishlistStock = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface WishlistProductSnapshot {
    id: string;
    name: string;
    slug: string;
    brand: string;
    image: string;
    rating: number;
    review_count: number;
}

export interface WishlistRow {
    id: number;
    added_at: string;
    variant_id: string;
    variant_name: string;
    variant_image: string;
    unit_price: string;
    compare_at_price: string | null;
    stock: WishlistStock;
    stock_count: number;
    discount_percent: number;
    rating: number;
    review_count: number;
    product_id: string;
    product_name: string;
    product_slug: string;
    product_brand: string;
    product_image: string;
    product: WishlistProductSnapshot;
}

export interface WishlistAddInput {
    product_id: string;
    variant_id: string;
    product_name: string;
    product_slug?: string;
    product_brand?: string;
    product_image?: string;
    variant_name?: string;
    variant_image?: string;
    unit_price: number;
    compare_at_price?: number | null;
    stock?: WishlistStock;
    stock_count?: number;
    discount_percent?: number;
    rating?: number;
    review_count?: number;
}

export interface WishlistCheckResult {
    in_wishlist: boolean;
    wishlist_item_id: number | null;
}

export interface WishlistBatchCheckResult {
    in_wishlist: Record<string, boolean>;
}

export interface WishlistBatchAddResult {
    added: number;
    skipped: number;
}

export interface CartItem {
    id: number;
    productId: string;
    variantId: string;
    name: string;
    brand: string;
    image: string;
    variantLabel: string;
    unitPrice: DecimalString;
    compareAtPrice: DecimalString | null;
    quantity: number;
    stock: StockStatus;
    stockCount: number;
    lineTotal: DecimalString;
    addedAt: string;
}

export interface Cart {
    id: number | null;
    items: CartItem[];
    itemCount: number;
    totalUnits: number;
    subtotal: DecimalString;
    updatedAt: string | null;
}

export interface CartItemAddInput {
    productId: string;
    variantId?: string;
    name: string;
    brand?: string;
    image?: string;
    variantLabel?: string;
    unitPrice: number | string;
    compareAtPrice?: number | string | null;
    quantity?: number;
    stock?: StockStatus;
    stockCount?: number;
}

export interface CartItemQtyInput {
    quantity: number;
}

export interface CartMergeItemInput {
    productId?: string;
    product_id?: string;
    variantId?: string;
    variant_id?: string;
    name: string;
    brand?: string;
    image?: string;
    variantLabel?: string;
    variant_label?: string;
    unitPrice?: number | string;
    unit_price?: number | string;
    compareAtPrice?: number | string | null;
    compare_at_price?: number | string | null;
    quantity?: number;
    stock?: string;
    stockCount?: number;
    stock_count?: number;
}

export interface CartMergeInput {
    items: CartMergeItemInput[];
}

export interface CartSnapshotItem {
    product_id: string;
    variant_id: string;
    name: string;
    brand: string;
    image: string;
    variant_label: string;
    unit_price: string;
    compare_at_price: string | null;
    quantity: number;
}

export interface CartSnapshot {
    items: CartSnapshotItem[];
}

export type PaymentStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'SUCCESS'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMEOUT';

export interface PaymentSnapshotItem {
    productId?: string;
    name: string;
    brand?: string;
    price: string;
    quantity: number;
    image?: string;
}

export interface PaymentSnapshot {
    email: string;
    phone: string;
    full_name: string;
    address_street: string;
    address_town: string;
    address_county: string;
    address_postal_code: string;
    delivery_method: DeliveryMethod;
    estimated_delivery: string;
    coupon: string | null;
    notes: string | null;
    items: PaymentSnapshotItem[];
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    total: string;
}

export interface Payment {
    id: string;
    status: PaymentStatus;
    amount: string;
    phone_number: string;
    order_reference: string;
    payment_method: OrderPaymentMethod;
    user: number | null;
    snapshot: PaymentSnapshot | null;
    result_code: number | null;
    result_description: string;
    mpesa_receipt_number: string;
    created_at: string;
    updated_at: string;
    currency?: string;
    checkout_request_id?: string | null;
    merchant_request_id?: string | null;
    paid_at?: string | null;
}

export interface StkPushPayload {
    order_reference?: string;
    amount: number;
    phone_number: string;
    metadata?: Record<string, string>;
    checkout: CheckoutPayload;
}

export interface CheckoutTaxConfig {
    enabled: boolean;
    rate: string;
    prices_include_tax: boolean;
}

export interface CheckoutRules {
    allow_guest_checkout: boolean;
    require_phone: boolean;
    whatsapp_fallback: boolean;
    mpesa_enabled: boolean;
    min_amount_kes: string;
    max_amount_kes: string;
    transaction_fee_kes: string;
}

export interface CheckoutConfig {
    counties: string[];
    currency: string;
    delivery_fees: {
        express_guest: string;
        express_member: string;
        standard: string;
        pickup: string;
    };
    your_express_fee: string;
    free_delivery_threshold: string;
    shipping_enabled: boolean;
    local_pickup_enabled: boolean;
    tax: CheckoutTaxConfig;
    delivery_days: Record<DeliveryMethod, number>;
    checkout: CheckoutRules;
    tax_rate?: string;
}

export interface CouponValidateResult {
    valid: boolean;
    code?: string;
    percent_off?: string;
    message: string;
}

export interface ShippingRate {
    id: number;
    method: string;
    methodId: number;
    methodName: string;
    price: DecimalString;
    eta: string;
    freeShippingThreshold: DecimalString | null;
}

export interface ShippingZone {
    id: number;
    name: string;
    region: string;
    counties: string[];
    rates: ShippingRate[];
}

export interface OrderCreateInput {
    checkout: CheckoutPayload;
    payment_method?: OrderPaymentMethod;
}

export interface OrderCreateResult {
    reference: string;
    status: OrderStatus;
    payment_status: OrderPaymentStatus;
    payment_method: OrderPaymentMethod;
    source: CheckoutSource;
    total: string;
    created_at: string;
}

export interface AbandonOrderResult {
    reference: string;
    status: OrderStatus;
}

export interface ClaimGuestOrdersResult {
    claimed: number;
}

export interface GoogleCallbackPayload {
    access: string;
    refresh: string;
    redirect_to: string;
    next: string;
    user: Me;
}

export type ApiErrorCode =
    | 'error'
    | 'missing_idempotency_key'
    | 'invalid_phone'
    | 'pricing_mismatch'
    | 'coupon_error'
    | 'checkout_error'
    | 'mpesa_error'
    | 'reconcile_error'
    | 'not_abandonable'
    | 'missing_reference'
    | 'invalid_snapshot'
    | 'claim_failed'
    | 'invalid_status'
    | 'cart_error';

const STOCK_ERROR_PATTERN =
    /(?:only\s+\d+\s+of\s+.+\s+left\s+in\s+stock|no\s+longer\s+available)/i;

export class ApiError extends Error {
    status: number;
    data: unknown;
    code: ApiErrorCode | string | null;

    constructor(status: number, data: unknown) {
        super(ApiError._extractMessage(status, data));

        Object.setPrototypeOf(this, ApiError.prototype);

        this.name = 'ApiError';
        this.status = status;
        this.data = data;
        this.code = ApiError._extractCode(data);
    }

    static _extractMessage(status: number, data: unknown): string {
        if (data && typeof data === 'object') {
            const record = data as Record<string, unknown>;
            for (const key of ['detail', 'message', 'error'] as const) {
                const val = record[key];
                if (typeof val === 'string' && val.trim()) return val;
            }
            const firstFieldError = Object.values(record).find(
                (v) =>
                    Array.isArray(v) &&
                    v.length > 0 &&
                    typeof v[0] === 'string',
            ) as string[] | undefined;
            if (firstFieldError) return firstFieldError[0];
        }
        if (typeof data === 'string' && data.trim()) return data;
        return `Request failed with status ${status}`;
    }

    static _extractCode(data: unknown): string | null {
        if (
            data &&
            typeof data === 'object' &&
            'code' in data &&
            typeof (data as { code: unknown }).code === 'string'
        ) {
            return (data as { code: string }).code;
        }
        return null;
    }

    isStockError(): boolean {
        if (this.code === 'insufficient_stock') return true;
        return STOCK_ERROR_PATTERN.test(this.message);
    }

    isPricingError(): boolean {
        return this.code === 'pricing_mismatch';
    }

    isCouponError(): boolean {
        return this.code === 'coupon_error';
    }

    isInvalidPhone(): boolean {
        return this.code === 'invalid_phone';
    }

    isCheckoutError(): boolean {
        return this.code === 'checkout_error';
    }

    isMpesaError(): boolean {
        return this.code === 'mpesa_error';
    }

    isAbortError(): boolean {
        return this.name === 'AbortError';
    }
}

export function isInsufficientStockError(err: unknown): boolean {
    return err instanceof ApiError && err.isStockError();
}

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie
        .split('; ')
        .find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

let csrfReady: Promise<void> | null = null;

export async function ensureCsrf(): Promise<void> {
    if (csrfReady) return csrfReady;
    csrfReady = (async () => {
        try {
            await fetch(`${API_BASE}${withTrailingSlash('/api/v1/auth/csrf/')}`, {
                method: 'GET',
                credentials: 'include',
            });
        } catch {
        }
    })();
    return csrfReady;
}

export type HttpMethod =
    | 'GET'
    | 'HEAD'
    | 'OPTIONS'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE';

export type RequestOptions = {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
};

const SAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'HEAD', 'OPTIONS']);

let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    try {
        const res = await fetch(
            `${API_BASE}${withTrailingSlash('/api/v1/auth/token/refresh/')}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh }),
            },
        );

        if (!res.ok) {
            clearTokens();
            return null;
        }

        const data = (await res.json()) as { access: string; refresh?: string };
        setTokens(data.access, data.refresh);
        return data.access;
    } catch {
        return null;
    }
}

export async function request<T>(
    path: string,
    opts: RequestOptions = {},
): Promise<T> {
    const method: HttpMethod = opts.method ?? 'GET';
    const isUnsafe = !SAFE_METHODS.has(method);
    const url = `${API_BASE}${withTrailingSlash(path)}`;

    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(opts.headers ?? {}),
    };

    let body: BodyInit | undefined;
    if (opts.body !== undefined && opts.body !== null) {
        const isForm =
            typeof FormData !== 'undefined' && opts.body instanceof FormData;

        if (isForm) {
            body = opts.body as FormData;
        } else if (typeof opts.body === 'string') {
            body = opts.body;
        } else if (
            typeof Blob !== 'undefined' &&
            opts.body instanceof Blob
        ) {
            body = opts.body;
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(opts.body);
        }
    }

    const access = getAccessToken();
    if (access) headers['Authorization'] = `Bearer ${access}`;

    if (isUnsafe && !access) {
        await ensureCsrf();
        const token = readCookie('csrftoken');
        if (token) headers['X-CSRFToken'] = token;
    }

    let res = await fetch(url, {
        method,
        headers,
        body,
        credentials: 'include',
        signal: opts.signal,
    });

    if (res.status === 401 && getRefreshToken()) {
        if (!refreshInFlight) {
            refreshInFlight = doRefresh().finally(() => {
                refreshInFlight = null;
            });
        }
        const newAccess = await refreshInFlight;

        if (newAccess) {
            headers['Authorization'] = `Bearer ${newAccess}`;
            res = await fetch(url, {
                method,
                headers,
                body,
                credentials: 'include',
                signal: opts.signal,
            });
        }
    }

    if (res.status === 204) return undefined as T;

    const contentType = res.headers.get('content-type') ?? '';
    const data: unknown = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : await res.text();

    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
}

export async function uploadRequest<T>(
    path: string,
    file: File,
    fieldName = 'file',
    signal?: AbortSignal,
): Promise<T> {
    const form = new FormData();
    form.append(fieldName, file);

    const headers: Record<string, string> = {
        Accept: 'application/json',
    };

    const access = getAccessToken();
    if (access) {
        headers['Authorization'] = `Bearer ${access}`;
    } else {
        await ensureCsrf();
        const token = readCookie('csrftoken');
        if (token) headers['X-CSRFToken'] = token;
    }

    const res = await fetch(`${API_BASE}${withTrailingSlash(path)}`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        headers,
        signal,
    });

    if (res.status === 204) return undefined as T;

    const contentType = res.headers.get('content-type') ?? '';
    const data: unknown = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : await res.text();

    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
}

function toQuery(params: object = {}): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '' || v === 'All') continue;
        sp.set(k, String(v));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
}

export const api = {

    getAccessToken,
    getRefreshToken,
    setTokens,
    clearTokens,
    subscribeAuth,

    me: async (): Promise<Me | null> => {
        try {
            return await request<Me>('/api/v1/auth/me/');
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                return null;
            }
            throw err;
        }
    },

    register: async (
        payload: RegisterPayload,
    ): Promise<RegisterSuccessResponse> => {
        const res = await request<RegisterSuccessResponse>(
            '/api/v1/auth/register/',
            { method: 'POST', body: payload },
        );
        if (res.access) setTokens(res.access, res.refresh);
        return res;
    },

    verifyEmail: (code: string) =>
        request<VerifyEmailResult>('/api/v1/auth/verify-email/', {
            method: 'POST',
            body: { code },
        }),

    resendVerification: () =>
        request<ResendVerificationResult>(
            '/api/v1/auth/resend-verification/',
            { method: 'POST', body: {} },
        ),

    login: async (
        email: string,
        password: string,
        remember = false,
    ): Promise<AuthSuccessResponse> => {
        const res = await request<JWTLoginResponse>('/api/v1/auth/login/', {
            method: 'POST',
            body: { email, password, remember },
        });
        setTokens(res.access, res.refresh);
        return { user: res.user, redirect_to: res.redirect_to };
    },

    logout: async (): Promise<void> => {
        const refresh = getRefreshToken();
        try {
            await request<void>('/api/v1/auth/logout/', {
                method: 'POST',
                body: refresh ? { refresh } : {},
            });
        } catch {
        }
        clearTokens();
    },

    changePassword: (currentPassword: string, newPassword: string) =>
        request<{ detail: string }>('/api/v1/auth/change-password/', {
            method: 'POST',
            body: {
                current_password: currentPassword,
                new_password: newPassword,
            },
        }),

    forgotPassword: (email: string) =>
        request<{ detail: string }>('/api/v1/auth/forgot-password/', {
            method: 'POST',
            body: { email },
        }),

    verifyResetToken: (token: string, signal?: AbortSignal) =>
        request<VerifyResetTokenResult>(
            `/api/v1/auth/verify-reset-token/?token=${encodeURIComponent(token)}`,
            { signal },
        ),

    resetPassword: (
        token: string,
        newPassword: string,
        confirmPassword?: string,
    ) =>
        request<{ detail: string }>('/api/v1/auth/reset-password/', {
            method: 'POST',
            body: {
                token,
                new_password: newPassword,
                ...(confirmPassword !== undefined
                    ? { confirm_password: confirmPassword }
                    : {}),
            },
        }),

    googleLoginUrl: (next?: string): string => {
        const base = `${API_BASE}${withTrailingSlash('/api/v1/auth/google/')}`;
        if (!next) return base;
        return `${base}?next=${encodeURIComponent(next)}`;
    },

    handleGoogleCallback: (): GoogleCallbackPayload | null => {
        if (!isBrowser()) return null;

        const rawHash =
            window.location.hash.startsWith('#')
                ? window.location.hash.slice(1)
                : window.location.hash;

        if (!rawHash) return null;

        const params = new URLSearchParams(rawHash);
        const access = params.get('access');
        const refresh = params.get('refresh');
        const redirectTo = params.get('redirect_to') || '/pages/account';
        const next = params.get('next') || redirectTo;
        const userRaw = params.get('user');

        if (!access) return null;

        let user: Me;
        try {
            user = userRaw ? (JSON.parse(userRaw) as Me) : ({} as Me);
        } catch {
            user = {} as Me;
        }

        setTokens(access, refresh ?? undefined);

        try {
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, cleanUrl);
        } catch {
        }

        return {
            access,
            refresh: refresh ?? '',
            redirect_to: redirectTo,
            next,
            user,
        };
    },

    verifyInvite: (token: string, signal?: AbortSignal) =>
        request<InviteVerifyResult>(
            `/api/v1/auth/invite/verify/?token=${encodeURIComponent(token)}`,
            { signal },
        ),

    acceptInvite: async (
        payload: StaffInviteAcceptPayload,
    ): Promise<AuthSuccessResponse> => {
        const res = await request<JWTLoginResponse>(
            '/api/v1/auth/invite/accept/',
            { method: 'POST', body: payload },
        );
        setTokens(res.access, res.refresh);
        return { user: res.user, redirect_to: res.redirect_to };
    },

    notificationsUnreadCount: (signal?: AbortSignal) =>
        request<{ unread: number }>(
            '/api/v1/account/notifications/unread-count/',
            { signal },
        ),
};

export const storeStatusApi = {
    get: (signal?: AbortSignal) =>
        request<StoreStatus>('/api/v1/store-status/', { signal }),

    getSafe: async (signal?: AbortSignal): Promise<StoreStatus> => {
        try {
            return await storeStatusApi.get(signal);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw err;
            }
            return {
                status: 'open',
                paused_message: '',
                business_name: 'Razestore',
                tagline: '',
                currency: 'KES',
                timezone: 'Africa/Nairobi',
                contact_email: '',
                contact_phone: '',
                address: '',
            };
        }
    },
};

export const catalogApi = {
    categories: {
        list: (signal?: AbortSignal) =>
            request<CatalogCategory[]>('/api/catalog/categories/', { signal }),

        detail: (
            slug: string,
            query: CategoryPageQuery = {},
            signal?: AbortSignal,
        ) =>
            request<CatalogCategoryPage>(
                `/api/catalog/categories/${encodeURIComponent(slug)}/${toQuery(query)}`,
                { signal },
            ),
    },

    brands: {
        list: (signal?: AbortSignal) =>
            request<CatalogBrand[]>('/api/catalog/brands/', { signal }),
    },

    products: {
        list: (query: ProductsQuery = {}, signal?: AbortSignal) =>
            request<Paginated<CatalogProduct>>(
                `/api/catalog/products/${toQuery(query)}`,
                { signal },
            ),

        detail: (id: string, signal?: AbortSignal) =>
            request<CatalogProductDetail>(
                `/api/catalog/products/${encodeURIComponent(id)}/`,
                { signal },
            ),

        related: (id: string, signal?: AbortSignal) =>
            request<CatalogProduct[]>(
                `/api/catalog/products/${encodeURIComponent(id)}/related/`,
                { signal },
            ),

        reviews: {
            list: (id: string, signal?: AbortSignal) =>
                request<CatalogReview[]>(
                    `/api/catalog/products/${encodeURIComponent(id)}/reviews/`,
                    { signal },
                ),

            create: (id: string, payload: CatalogReviewInput) =>
                request<CatalogReview>(
                    `/api/catalog/products/${encodeURIComponent(id)}/reviews/`,
                    { method: 'POST', body: payload },
                ),
        },
    },

    newArrivals: {
        list: (query: NewArrivalsQuery = {}, signal?: AbortSignal) =>
            request<CatalogNewArrival[]>(
                `/api/catalog/new-arrivals/${toQuery(query)}`,
                { signal },
            ),

        detail: (id: string, signal?: AbortSignal) =>
            request<CatalogNewArrival>(
                `/api/catalog/new-arrivals/${encodeURIComponent(id)}/`,
                { signal },
            ),
    },

    bestSelling: {
        list: (query: BestSellingQuery = {}, signal?: AbortSignal) =>
            request<CatalogBestSeller[]>(
                `/api/catalog/best-selling/${toQuery(query)}`,
                { signal },
            ),

        detail: (id: string, signal?: AbortSignal) =>
            request<CatalogBestSellerDetail>(
                `/api/catalog/best-selling/${encodeURIComponent(id)}/`,
                { signal },
            ),

        related: (id: string, signal?: AbortSignal) =>
            request<CatalogRelatedProduct[]>(
                `/api/catalog/best-selling/${encodeURIComponent(id)}/related/`,
                { signal },
            ),

        reviews: {
            list: (id: string, signal?: AbortSignal) =>
                request<CatalogReview[]>(
                    `/api/catalog/best-selling/${encodeURIComponent(id)}/reviews/`,
                    { signal },
                ),

            create: (id: string, payload: CatalogReviewInput) =>
                request<CatalogReview>(
                    `/api/catalog/best-selling/${encodeURIComponent(id)}/reviews/`,
                    { method: 'POST', body: payload },
                ),
        },
    },

    specialDeals: {
        list: (query: SpecialDealsQuery = {}, signal?: AbortSignal) =>
            request<CatalogDealCard[]>(
                `/api/catalog/special-deals/${toQuery(query)}`,
                { signal },
            ),

        detail: (productId: string, signal?: AbortSignal) =>
            request<CatalogDealCard>(
                `/api/catalog/special-deals/${encodeURIComponent(productId)}/`,
                { signal },
            ),

        categories: (signal?: AbortSignal) =>
            request<CatalogCategoryRef[]>(
                '/api/catalog/special-deals/categories/',
                { signal },
            ),

        brands: (signal?: AbortSignal) =>
            request<CatalogBrandRef[]>(
                '/api/catalog/special-deals/brands/',
                { signal },
            ),
    },
};

export const aiApi = {
    chat: (payload: AIChatRequest, signal?: AbortSignal) =>
        request<AIChatResponse>('/api/ai/chat/', {
            method: 'POST',
            body: payload,
            signal,
        }),
};

export const bannersApi = {
    hero: (signal?: AbortSignal) =>
        request<Banner[]>('/api/v1/banners/hero/', { signal }),

    track: (id: number, event: BannerTrackEvent, signal?: AbortSignal) =>
        request<{ ok: boolean }>(
            `/api/v1/banners/${id}/track/${event}/`,
            { method: 'POST', signal },
        ),
};

export const whatsapfloatApi = {
    config: (signal?: AbortSignal) =>
        request<WhatsapfloatConfig>('/api/whatsapp/config/', { signal }),
};

export const whatsappApi = {
    productLink: (productId: string, signal?: AbortSignal) =>
        request<WhatsAppProductLink>(
            `/api/whatsapp/product/${encodeURIComponent(productId)}/`,
            { signal },
        ),

    orderLink: (reference: string, signal?: AbortSignal) =>
        request<WhatsAppOrderLink>(
            `/api/whatsapp/order/${encodeURIComponent(reference)}/`,
            { signal },
        ),

    cartHandoff: (payload: WhatsAppCartHandoffRequest) =>
        request<WhatsAppCartHandoffResponse>('/api/v1/whatsapp/cart-handoff/', {
            method: 'POST',
            body: payload,
        }),

    cartSession: (token: string, signal?: AbortSignal) =>
        request<WhatsAppCartSession>(
            `/api/v1/whatsapp/sessions/${encodeURIComponent(token)}/`,
            { signal },
        ),
};

export const newsletterApi = {
    subscribe: (
        payload: string | NewsletterSubscribePayload,
        signal?: AbortSignal,
    ) => {
        const body: NewsletterSubscribePayload =
            typeof payload === 'string'
                ? { email: payload, source: 'Footer Popup' }
                : { source: 'Footer Popup', ...payload };

        return request<NewsletterSubscribeResponse>(
            '/api/v1/newsletter/subscribe/',
            { method: 'POST', body, signal },
        );
    },

    unsubscribe: (
        payload: { email: string } | { token: string },
        signal?: AbortSignal,
    ) =>
        request<NewsletterUnsubscribeResponse>(
            '/api/v1/newsletter/unsubscribe/',
            { method: 'POST', body: payload, signal },
        ),
};

export const shippingApi = {
    zones: (signal?: AbortSignal) =>
        request<ShippingZone[]>(
            '/api/v1/dashboard/shipping/public/zones/',
            { signal },
        ),

    zone: (id: number, signal?: AbortSignal) =>
        request<ShippingZone>(
            `/api/v1/dashboard/shipping/public/zones/${id}/`,
            { signal },
        ),
};

export const checkoutApi = {
    config: (signal?: AbortSignal) =>
        request<CheckoutConfig>('/api/v1/checkout/config/', { signal }),

    validateCoupon: (code: string, subtotal: number) =>
        request<CouponValidateResult>(
            '/api/v1/checkout/validate-coupon/',
            { method: 'POST', body: { code, subtotal } },
        ),

    createOrder: (
        payload: OrderCreateInput,
        idempotencyKey: string,
        signal?: AbortSignal,
    ) =>
        request<OrderCreateResult>('/api/v1/checkout/orders/', {
            method: 'POST',
            body: payload,
            headers: { 'Idempotency-Key': idempotencyKey },
            signal,
        }),

    abandonOrder: (reference: string, signal?: AbortSignal) =>
        request<AbandonOrderResult>(
            '/api/v1/checkout/orders/abandon/',
            { method: 'POST', body: { reference }, signal },
        ),
};

export const cartApi = {
    get: (signal?: AbortSignal) =>
        request<Cart>('/api/v1/checkout/cart/', { signal }),

    addItem: (payload: CartItemAddInput) =>
        request<Cart>('/api/v1/checkout/cart/items/', {
            method: 'POST',
            body: payload,
        }),

    updateQty: (itemId: number, quantity: number) =>
        request<Cart>(`/api/v1/checkout/cart/items/${itemId}/`, {
            method: 'PATCH',
            body: { quantity } satisfies CartItemQtyInput,
        }),

    removeItem: (itemId: number) =>
        request<Cart>(`/api/v1/checkout/cart/items/${itemId}/`, {
            method: 'DELETE',
        }),

    clear: () =>
        request<void>('/api/v1/checkout/cart/', { method: 'DELETE' }),

    merge: (items: CartMergeItemInput[]) =>
        request<Cart>('/api/v1/checkout/cart/merge/', {
            method: 'POST',
            body: { items } satisfies CartMergeInput,
        }),

    snapshot: (signal?: AbortSignal) =>
        request<CartSnapshot>('/api/v1/checkout/cart/snapshot/', { signal }),

    restore: (snapshot: CartSnapshot) =>
        request<Cart>('/api/v1/checkout/cart/restore/', {
            method: 'POST',
            body: snapshot,
        }),
};

export const paymentsApi = {
    stkPush: (payload: StkPushPayload, idempotencyKey: string) =>
        request<Payment>('/api/v1/checkout/payments/stk-push/', {
            method: 'POST',
            body: payload,
            headers: { 'Idempotency-Key': idempotencyKey },
        }),

    detail: (id: string, signal?: AbortSignal) =>
        request<Payment>(`/api/v1/checkout/payments/${id}/`, { signal }),

    byReference: (orderReference: string, signal?: AbortSignal) =>
        request<Payment>(
            `/api/v1/checkout/payments/by-reference/${encodeURIComponent(orderReference)}/`,
            { signal },
        ),

    cancel: (id: string) =>
        request<void>(`/api/v1/checkout/payments/${id}/cancel/`, {
            method: 'POST',
        }),
};

export const accountApi = {
    overview: (signal?: AbortSignal) =>
        request<{
            user: {
                id: number;
                email: string;
                first_name: string;
                last_name: string;
                phone: string;
                joined_at: string | null;
            };
            default_address: Address | null;
            stats: {
                total_orders: number;
                in_transit: number;
                pending: number;
                wishlist_count: number;
                unread_notifications: number;
                pending_reviews: number;
            };
            recent_orders: {
                id: string;
                date: string;
                status: string;
                itemCount: number;
                total: string;
                currency: string;
            }[];
            currency: string;
        }>('/api/v1/account/overview/', { signal }),

    claimGuestOrders: (signal?: AbortSignal) =>
        request<ClaimGuestOrdersResult>(
            '/api/v1/checkout/orders/claim-guest/',
            { method: 'POST', signal },
        ),

    orders: {
        list: (signal?: AbortSignal) =>
            request<OrderListRow[]>('/api/v1/account/orders/', { signal }),

        detail: (reference: string, signal?: AbortSignal) =>
            request<OrderDetail>(
                `/api/v1/account/orders/${encodeURIComponent(reference)}/`,
                { signal },
            ),

        reorder: (reference: string, signal?: AbortSignal) =>
            request<OrderReorderItem[]>(
                `/api/v1/account/orders/${encodeURIComponent(reference)}/reorder/`,
                { method: 'POST', signal },
            ),

        reject: (reference: string, reason = '') =>
            request<OrderLifecycleResult>(
                `/api/v1/account/orders/${encodeURIComponent(reference)}/reject/`,
                { method: 'POST', body: { reason } },
            ),

        claim: (reference: string) =>
            request<OrderLifecycleResult>(
                `/api/v1/account/orders/${encodeURIComponent(reference)}/claim/`,
                { method: 'POST' },
            ),

        downloadPdf: async (
            reference: string,
            signal?: AbortSignal,
        ): Promise<Blob> => {
            const headers: Record<string, string> = {};
            const access = getAccessToken();
            if (access) headers['Authorization'] = `Bearer ${access}`;

            const res = await fetch(
                `${API_BASE}${withTrailingSlash(
                    `/api/v1/account/orders/${encodeURIComponent(reference)}/pdf/`,
                )}`,
                {
                    credentials: 'include',
                    headers,
                    signal,
                },
            );
            if (!res.ok) {
                throw new ApiError(res.status, {
                    detail: `Could not download receipt: ${res.status}`,
                });
            }
            return res.blob();
        },
    },

    addresses: {
        list: (signal?: AbortSignal) =>
            request<Address[]>('/api/v1/account/addresses/', { signal }),

        create: (payload: AddressInput) =>
            request<Address>('/api/v1/account/addresses/', {
                method: 'POST',
                body: payload,
            }),

        detail: (id: number, signal?: AbortSignal) =>
            request<Address>(`/api/v1/account/addresses/${id}/`, { signal }),

        update: (id: number, payload: Partial<AddressInput>) =>
            request<Address>(`/api/v1/account/addresses/${id}/`, {
                method: 'PATCH',
                body: payload,
            }),

        remove: (id: number) =>
            request<void>(`/api/v1/account/addresses/${id}/`, {
                method: 'DELETE',
            }),

        setDefault: (id: number) =>
            request<Address>(`/api/v1/account/addresses/${id}/set-default/`, {
                method: 'POST',
            }),
    },

    notifications: {
        list: (signal?: AbortSignal) =>
            request<NotificationRow[]>('/api/v1/account/notifications/', {
                signal,
            }),

        markRead: (id: number) =>
            request<NotificationRow>(
                `/api/v1/account/notifications/${id}/read/`,
                { method: 'POST' },
            ),

        remove: (id: number) =>
            request<void>(`/api/v1/account/notifications/${id}/`, {
                method: 'DELETE',
            }),

        markAllRead: () =>
            request<{ updated: number }>(
                '/api/v1/account/notifications/read-all/',
                { method: 'POST' },
            ),

        clearAll: () =>
            request<{ deleted: number }>(
                '/api/v1/account/notifications/clear/',
                { method: 'POST' },
            ),

        unreadCount: (signal?: AbortSignal) =>
            request<{ unread: number }>(
                '/api/v1/account/notifications/unread-count/',
                { signal },
            ),
    },

    profile: {
        get: (signal?: AbortSignal) =>
            request<ProfileData>('/api/v1/account/settings/', { signal }),

        update: (payload: ProfileUpdateInput) =>
            request<ProfileData>('/api/v1/account/settings/', {
                method: 'PATCH',
                body: payload,
            }),

        getPreferences: (signal?: AbortSignal) =>
            request<PreferencesInput>(
                '/api/v1/account/settings/preferences/',
                { signal },
            ),

        updatePreferences: (payload: PreferencesInput) =>
            request<PreferencesInput>(
                '/api/v1/account/settings/preferences/',
                { method: 'PATCH', body: payload },
            ),

        delete: () =>
            request<void>('/api/v1/account/settings/', {
                method: 'DELETE',
            }),
    },

    reviews: {
        list: (signal?: AbortSignal) =>
            request<ReviewRow[]>('/api/v1/account/reviews/', { signal }),

        create: (payload: ReviewWriteInput) =>
            request<ReviewRow>('/api/v1/account/reviews/', {
                method: 'POST',
                body: payload,
            }),

        detail: (id: number, signal?: AbortSignal) =>
            request<ReviewRow>(`/api/v1/account/reviews/${id}/`, { signal }),

        update: (id: number, payload: Partial<ReviewWriteInput>) =>
            request<ReviewRow>(`/api/v1/account/reviews/${id}/`, {
                method: 'PATCH',
                body: payload,
            }),

        remove: (id: number) =>
            request<void>(`/api/v1/account/reviews/${id}/`, {
                method: 'DELETE',
            }),

        pending: (signal?: AbortSignal) =>
            request<PendingReviewItem[]>(
                '/api/v1/account/reviews/pending/',
                { signal },
            ),

        uploadImage: (file: File, signal?: AbortSignal) =>
            uploadRequest<{ url: string }>(
                '/api/v1/account/reviews/uploads/',
                file,
                'file',
                signal,
            ),
    },

    wishlist: {
        list: (signal?: AbortSignal) =>
            request<WishlistRow[]>('/api/v1/account/wishlist/', { signal }),

        add: (payload: WishlistAddInput) =>
            request<WishlistRow>('/api/v1/account/wishlist/', {
                method: 'POST',
                body: payload,
            }),

        check: (variantId: string, signal?: AbortSignal) =>
            request<WishlistCheckResult>(
                `/api/v1/account/wishlist/check/?variant_id=${encodeURIComponent(variantId)}`,
                { signal },
            ),

        checkBatch: (variantIds: string[], signal?: AbortSignal) =>
            request<WishlistBatchCheckResult>(
                '/api/v1/account/wishlist/check-batch/',
                { method: 'POST', body: { variant_ids: variantIds }, signal },
            ),

        bulkAdd: (items: WishlistAddInput[]) =>
            request<WishlistBatchAddResult>(
                '/api/v1/account/wishlist/bulk-add/',
                { method: 'POST', body: { items } },
            ),

        remove: (id: number) =>
            request<void>(`/api/v1/account/wishlist/${id}/`, {
                method: 'DELETE',
            }),

        removeByVariant: (variantId: string) =>
            request<void>(
                `/api/v1/account/wishlist/by-variant/${encodeURIComponent(variantId)}/`,
                { method: 'DELETE' },
            ),

        clearAll: () =>
            request<{ deleted: number }>(
                '/api/v1/account/wishlist/clear/',
                { method: 'DELETE' },
            ),
    },
};

const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set([
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'TIMEOUT',
]);

export interface PollPaymentOptions {
    signal?: AbortSignal;
    onPoll?: (payment: Payment) => void;
    intervalMs?: number;
    timeoutMs?: number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        if (!signal) return;
        const onAbort = () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export async function pollPayment(
    paymentId: string,
    options: PollPaymentOptions = {},
): Promise<Payment> {
    const {
        signal,
        onPoll,
        intervalMs = 3000,
        timeoutMs = 180_000,
    } = options;

    const startedAt = Date.now();
    let last: Payment | null = null;

    while (true) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        try {
            last = await paymentsApi.detail(paymentId, signal);
            onPoll?.(last);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw err;
            }
        }

        if (last && TERMINAL_PAYMENT_STATUSES.has(last.status)) {
            return last;
        }

        if (Date.now() - startedAt >= timeoutMs) {
            throw new ApiError(408, {
                detail: 'Timed out waiting for payment confirmation.',
            });
        }

        await sleep(intervalMs, signal);
    }
}
