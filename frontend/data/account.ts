// ─────────────────────────────────────────────────────────────
// CUSTOMER ACCOUNT DATA
// Replace with real auth/session data when you wire your backend
// ─────────────────────────────────────────────────────────────

export type OrderStatus = 'Pending' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled';
export type PaymentMethod = 'M-Pesa' | 'Airtel Money' | 'Stripe' | 'Cash on Delivery';

export interface OrderItem {
    productId: string;
    name: string;
    brand: string;
    image: string;
    price: number;
    quantity: number;
}

export interface Order {
    id: string;             // e.g. ORD-2026-04812
    date: string;           // ISO
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    paymentRef: string;     // M-Pesa code, Stripe charge id, etc.
    subtotal: number;
    shipping: number;
    vat: number;
    total: number;
    items: OrderItem[];
    shippingAddress: {
        name: string;
        phone: string;
        street: string;
        town: string;
        county: string;
        postalCode?: string;
    };
    trackingNumber?: string;
    courier?: string;
    estimatedDelivery?: string;
    timeline: { status: OrderStatus; date: string; note?: string }[];
}

export const currentUser = {
    id: 'cust_001',
    firstName: 'Wanjiru',
    lastName: 'Kamau',
    email: 'wanjiru.kamau@gmail.com',
    phone: '+254712345678',
    joinedAt: '2025-03-14',
    loyaltyPoints: 1240,
    addresses: [
        {
            id: 'addr_1',
            label: 'Home',
            name: 'Wanjiru Kamau',
            phone: '+254712345678',
            street: 'Riverside Drive, Block C, Apt 4B',
            town: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00100',
            isDefault: true,
        },
        {
            id: 'addr_2',
            label: 'Office',
            name: 'Wanjiru Kamau',
            phone: '+254712345678',
            street: 'Westlands Business Park, 5th Floor',
            town: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00800',
            isDefault: false,
        },
    ],
    preferences: {
        whatsappUpdates: true,
        emailPromotions: true,
        smsPromotions: false,
        newsletter: true,
    },
};

export const orders: Order[] = [
    {
        id: 'ORD-2026-04812',
        date: '2026-09-18T10:24:00Z',
        status: 'Delivered',
        paymentMethod: 'M-Pesa',
        paymentRef: 'SLK7X9P2QM',
        subtotal: 38999,
        shipping: 300,
        vat: 6240,
        total: 45539,
        items: [
            {
                productId: 'prd_44210',
                name: 'Sony WH-1000XM5 Wireless Headphones',
                brand: 'Sony',
                image: '/Headphone.jpeg',
                price: 38999,
                quantity: 1,
            },
        ],
        shippingAddress: {
            name: 'Wanjiru Kamau',
            phone: '+254712345678',
            street: 'Riverside Drive, Block C, Apt 4B',
            town: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00100',
        },
        trackingNumber: 'SNDY-448192',
        courier: 'Sendy',
        estimatedDelivery: '2026-09-20',
        timeline: [
            { status: 'Pending', date: '2026-09-18T10:24:00Z', note: 'Order received' },
            { status: 'Confirmed', date: '2026-09-18T10:26:00Z', note: 'Payment confirmed via M-Pesa' },
            { status: 'Packed', date: '2026-09-18T15:10:00Z' },
            { status: 'Shipped', date: '2026-09-19T08:00:00Z', note: 'Handed to Sendy courier' },
            { status: 'Delivered', date: '2026-09-20T13:45:00Z', note: 'Signed by W. Kamau' },
        ],
    },
    {
        id: 'ORD-2026-04694',
        date: '2026-09-10T16:02:00Z',
        status: 'Shipped',
        paymentMethod: 'M-Pesa',
        paymentRef: 'SLK2M8N4VP',
        subtotal: 154999,
        shipping: 0,
        vat: 24799,
        total: 179798,
        items: [
            {
                productId: 'prd_new_02',
                name: 'Samsung Galaxy S24 Ultra 5G 512GB',
                brand: 'Samsung',
                image: '/smartphone2.jpeg',
                price: 154999,
                quantity: 1,
            },
        ],
        shippingAddress: {
            name: 'Wanjiru Kamau',
            phone: '+254712345678',
            street: 'Westlands Business Park, 5th Floor',
            town: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00800',
        },
        trackingNumber: 'GLV-8820149',
        courier: 'Glovo',
        estimatedDelivery: '2026-09-23',
        timeline: [
            { status: 'Pending', date: '2026-09-10T16:02:00Z' },
            { status: 'Confirmed', date: '2026-09-10T16:03:00Z', note: 'M-Pesa payment confirmed' },
            { status: 'Packed', date: '2026-09-11T09:30:00Z' },
            { status: 'Shipped', date: '2026-09-11T14:00:00Z', note: 'Out for delivery with Glovo' },
        ],
    },
    {
        id: 'ORD-2026-04510',
        date: '2026-08-29T11:45:00Z',
        status: 'Delivered',
        paymentMethod: 'Stripe',
        paymentRef: 'ch_3QxR8kL2aBc9XyZ',
        subtotal: 89999,
        shipping: 300,
        vat: 14400,
        total: 104699,
        items: [
            {
                productId: 'prod_8f29s7',
                name: 'Samsung 55" Crystal UHD 4K Smart TV',
                brand: 'Samsung',
                image: '/tvs.jpeg',
                price: 89999,
                quantity: 1,
            },
        ],
        shippingAddress: {
            name: 'Wanjiru Kamau',
            phone: '+254712345678',
            street: 'Riverside Drive, Block C, Apt 4B',
            town: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00100',
        },
        trackingNumber: 'SNDY-440112',
        courier: 'Sendy',
        estimatedDelivery: '2026-08-31',
        timeline: [
            { status: 'Pending', date: '2026-08-29T11:45:00Z' },
            { status: 'Confirmed', date: '2026-08-29T11:47:00Z', note: 'Card payment confirmed' },
            { status: 'Packed', date: '2026-08-29T17:00:00Z' },
            { status: 'Shipped', date: '2026-08-30T08:00:00Z' },
            { status: 'Delivered', date: '2026-08-31T12:20:00Z' },
        ],
    },
    {
        id: 'ORD-2026-04489',
        date: '2026-08-22T09:10:00Z',
        status: 'Cancelled',
        paymentMethod: 'M-Pesa',
        paymentRef: 'SLK5H2J7RK',
        subtotal: 24500,
        shipping: 300,
        vat: 3920,
        total: 28720,
        items: [
            {
                productId: 'prd_new_07',
                name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
                brand: 'Keychron',
                image: '/slimkeyboard.jpeg',
                price: 24500,
                quantity: 1,
            },
        ],
        shippingAddress: {
            name: 'Wanjiru Kamau',
            phone: '+254712345678',
            street: 'Riverside Drive, Block C, Apt 4B',
            town: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00100',
        },
        timeline: [
            { status: 'Pending', date: '2026-08-22T09:10:00Z' },
            { status: 'Cancelled', date: '2026-08-22T10:30:00Z', note: 'Cancelled by customer. Refund issued.' },
        ],
    },
];

export const formatKES = (n: number) => `KES ${n.toLocaleString()}`;

export const statusColor = (status: OrderStatus): string => {
    switch (status) {
        case 'Delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Shipped': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'Packed': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'Confirmed': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
        case 'Pending': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
    }
};