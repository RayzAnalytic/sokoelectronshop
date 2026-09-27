'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    TrendingUp,
    TrendingDown,
    Download,
    ArrowUpRight,
    AlertTriangle,
    X,
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from 'recharts';

// --- TYPES ---
type DateRange = 'Today' | '7d' | '30d' | '90d' | 'Custom';
type RevenueTab = 'Revenue' | 'Orders';

interface KPI {
    id: string;
    title: string;
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    change: number;
    isPositive: boolean;
    sparklineData: { value: number }[];
}

interface Product {
    id: string;
    name: string;
    sku: string;
    sold: number;
    revenue: number;
    image: string;
    stock: number;
    category: string;
}

interface Order {
    id: string;
    orderNumber: string;
    customer: string;
    amount: number;
    status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
    time: string;
}

// --- COLORS (blue-950 as primary) ---
const BLUE = '#172554';       // blue-950
const BLUE_LIGHT = '#1e3a8a'; // blue-900 (hover)
const GREEN = '#059669';
const RED = '#dc2626';
const AMBER = '#d97706';
const INDIGO = '#4f46e5';

// --- MOCK DATA ---
function makeKpi(id: string, title: string, value: number, prefix: string, suffix: string, decimals: number, change: number, isPositive: boolean, spark: number[]): KPI {
    return { id, title, value, prefix, suffix, decimals, change, isPositive, sparklineData: spark.map(v => ({ value: v })) };
}

const INITIAL_KPIS: Record<DateRange, KPI[]> = {
    Today: [
        makeKpi('revenue', 'Total Revenue', 68400, 'KES ', '', 0, 5.2, true, [10, 12, 15, 14, 18, 22, 25]),
        makeKpi('orders', 'Orders', 184, '', '', 0, 3.8, true, [2, 4, 3, 5, 6, 8, 10]),
        makeKpi('customers', 'Customers', 1250, '', '', 0, 4.1, true, [15, 18, 20, 22, 25, 28, 30]),
        makeKpi('conversion', 'Conversion Rate', 3.85, '', '%', 2, 0.5, true, [3.5, 3.6, 3.7, 3.6, 3.8, 3.85, 3.85]),
    ],
    '7d': [
        makeKpi('revenue', 'Total Revenue', 485200, 'KES ', '', 0, 12.4, true, [32, 45, 41, 58, 52, 65, 78]),
        makeKpi('orders', 'Orders', 1420, '', '', 0, 8.1, true, [12, 15, 14, 18, 16, 22, 25]),
        makeKpi('customers', 'Customers', 8940, '', '', 0, -2.4, false, [45, 42, 48, 43, 40, 39, 38]),
        makeKpi('conversion', 'Conversion Rate', 3.42, '', '%', 2, 1.2, true, [2.8, 3.0, 2.9, 3.2, 3.1, 3.3, 3.42]),
    ],
    '30d': [
        makeKpi('revenue', 'Total Revenue', 2145000, 'KES ', '', 0, 18.5, true, [40, 48, 55, 62, 70, 85, 95]),
        makeKpi('orders', 'Orders', 6240, '', '', 0, 14.2, true, [50, 55, 60, 68, 75, 82, 90]),
        makeKpi('customers', 'Customers', 34200, '', '', 0, 9.6, true, [30, 35, 40, 45, 52, 60, 70]),
        makeKpi('conversion', 'Conversion Rate', 3.21, '', '%', 2, -0.4, false, [3.4, 3.3, 3.2, 3.3, 3.2, 3.21, 3.21]),
    ],
    '90d': [
        makeKpi('revenue', 'Total Revenue', 6480000, 'KES ', '', 0, 24.1, true, [60, 70, 85, 95, 110, 130, 150]),
        makeKpi('orders', 'Orders', 18900, '', '', 0, 19.8, true, [100, 115, 130, 145, 160, 180, 200]),
        makeKpi('customers', 'Customers', 98500, '', '', 0, 15.3, true, [80, 95, 110, 125, 140, 160, 185]),
        makeKpi('conversion', 'Conversion Rate', 3.15, '', '%', 2, 0.8, true, [3.0, 3.1, 3.0, 3.1, 3.15, 3.15, 3.15]),
    ],
    Custom: [
        makeKpi('revenue', 'Total Revenue', 1250000, 'KES ', '', 0, 10.0, true, [20, 30, 40, 50, 60, 70, 80]),
        makeKpi('orders', 'Orders', 3500, '', '', 0, 7.5, true, [30, 35, 40, 45, 50, 55, 60]),
        makeKpi('customers', 'Customers', 18000, '', '', 0, 5.0, true, [25, 30, 35, 40, 45, 50, 55]),
        makeKpi('conversion', 'Conversion Rate', 3.30, '', '%', 2, 1.0, true, [3.1, 3.2, 3.2, 3.3, 3.3, 3.3, 3.3]),
    ],
};

const REVENUE_CHART_DATA: Record<DateRange, { date: string; revenue: number; orders: number }[]> = {
    Today: [
        { date: '00:00', revenue: 4200, orders: 12 },
        { date: '04:00', revenue: 1800, orders: 5 },
        { date: '08:00', revenue: 12400, orders: 32 },
        { date: '12:00', revenue: 18900, orders: 48 },
        { date: '16:00', revenue: 21000, orders: 55 },
        { date: '20:00', revenue: 10100, orders: 32 },
    ],
    '7d': [
        { date: 'Mon', revenue: 65000, orders: 180 },
        { date: 'Tue', revenue: 59000, orders: 160 },
        { date: 'Wed', revenue: 80000, orders: 220 },
        { date: 'Thu', revenue: 81000, orders: 230 },
        { date: 'Fri', revenue: 56000, orders: 150 },
        { date: 'Sat', revenue: 95000, orders: 270 },
        { date: 'Sun', revenue: 109200, orders: 310 },
    ],
    '30d': [
        { date: 'Week 1', revenue: 450000, orders: 1300 },
        { date: 'Week 2', revenue: 520000, orders: 1500 },
        { date: 'Week 3', revenue: 580000, orders: 1680 },
        { date: 'Week 4', revenue: 595000, orders: 1760 },
    ],
    '90d': [
        { date: 'Month 1', revenue: 1950000, orders: 5600 },
        { date: 'Month 2', revenue: 2150000, orders: 6200 },
        { date: 'Month 3', revenue: 2380000, orders: 7100 },
    ],
    Custom: [
        { date: 'Day 1', revenue: 120000, orders: 340 },
        { date: 'Day 5', revenue: 210000, orders: 580 },
        { date: 'Day 10', revenue: 310000, orders: 890 },
        { date: 'Day 15', revenue: 610000, orders: 1690 },
    ],
};

const ORDER_STATUS_DATA = [
    { name: 'Pending', value: 340, color: AMBER },
    { name: 'Processing', value: 520, color: BLUE },
    { name: 'Shipped', value: 890, color: INDIGO },
    { name: 'Delivered', value: 3450, color: GREEN },
    { name: 'Cancelled', value: 120, color: RED },
];

const TOP_PRODUCTS: Product[] = [
    { id: 'p1', name: 'Apex Ultra X1 Pro Smartphone 5G', sku: 'APX-X1-5G', sold: 420, revenue: 3775800, image: '/phone.jpeg', stock: 14, category: 'Smartphones' },
    { id: 'p2', name: 'Zenith StudioBook Pro 16 Laptop', sku: 'ZNT-SB16-L', sold: 185, revenue: 2773150, image: '/Lenovo.jpeg', stock: 3, category: 'Laptops' },
    { id: 'p3', name: 'Dell UltraSharp 27" 4K Hub Monitor', sku: 'DLL-U27-4K', sold: 310, revenue: 1395000, image: '/dellmonitor.jpeg', stock: 5, category: 'Displays' },
    { id: 'p4', name: 'Wireless Mechanical Keyboard K2', sku: 'MCH-K2-WL', sold: 650, revenue: 844350, image: '/phone.jpeg', stock: 24, category: 'Accessories' },
    { id: 'p5', name: 'Ergonomic Office Chair Executive', sku: 'ERG-CHR-01', sold: 95, revenue: 1424050, image: '/Lenovo.jpeg', stock: 2, category: 'Furniture' },
];

const RECENT_ORDERS: Order[] = [
    { id: 'ord-109', orderNumber: '#ORD-8942', customer: 'Amina Mwangi', amount: 9899.00, status: 'Delivered', time: '10 mins ago' },
    { id: 'ord-108', orderNumber: '#ORD-8941', customer: 'Brian Kiprono', amount: 1499.00, status: 'Processing', time: '25 mins ago' },
    { id: 'ord-107', orderNumber: '#ORD-8940', customer: 'Wanjiru Kamau', amount: 450.00, status: 'Shipped', time: '1 hour ago' },
    { id: 'ord-106', orderNumber: '#ORD-8939', customer: 'Kevin Ochieng', amount: 899.00, status: 'Pending', time: '2 hours ago' },
    { id: 'ord-105', orderNumber: '#ORD-8938', customer: 'Fatuma Hassan', amount: 2450.00, status: 'Delivered', time: '3 hours ago' },
    { id: 'ord-104', orderNumber: '#ORD-8937', customer: 'David Mutua', amount: 120.00, status: 'Cancelled', time: '4 hours ago' },
    { id: 'ord-103', orderNumber: '#ORD-8936', customer: 'Grace Njeri', amount: 3200.00, status: 'Processing', time: '5 hours ago' },
    { id: 'ord-102', orderNumber: '#ORD-8935', customer: 'Juma Otieno', amount: 750.00, status: 'Delivered', time: '6 hours ago' },
];

const LOW_STOCK_PRODUCTS = [
    { id: 'p2', name: 'Zenith StudioBook Pro 16 Laptop', sku: 'ZNT-SB16-L', stock: 3, threshold: 5, category: 'Laptops', image: '/Lenovo.jpeg' },
    { id: 'p5', name: 'Ergonomic Office Chair Executive', sku: 'ERG-CHR-01', stock: 2, threshold: 5, category: 'Furniture', image: '/Lenovo.jpeg' },
    { id: 'p9', name: 'USB-C Multi-Port Hub Pro Adapter', sku: 'HUB-C-PRO', stock: 4, threshold: 10, category: 'Accessories', image: '/phone.jpeg' },
    { id: 'p12', name: 'Wireless Noise Cancelling Earbuds', sku: 'AUD-NC-E9', stock: 1, threshold: 8, category: 'Audio', image: '/phone.jpeg' },
];

const PAYMENT_METHODS = [
    { name: 'M-Pesa', amount: 3120000, percentage: 65, color: GREEN },
    { name: 'Stripe', amount: 1104000, percentage: 23, color: BLUE },
    { name: 'Airtel Money', amount: 384000, percentage: 8, color: AMBER },
    { name: 'Cash on Delivery', amount: 192000, percentage: 4, color: INDIGO },
];

const STATUS_STYLES: Record<string, string> = {
    Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Processing: 'bg-blue-50 text-blue-950 border-blue-100',
    Shipped: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    Pending: 'bg-amber-50 text-amber-700 border-amber-100',
    Cancelled: 'bg-red-50 text-red-600 border-red-100',
};

export default function AdminDashboard() {
    const [dateRange, setDateRange] = useState<DateRange>('7d');
    const [isLoading, setIsLoading] = useState(true);
    const [revenueTab, setRevenueTab] = useState<RevenueTab>('Revenue');

    const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [restockProduct, setRestockProduct] = useState<any | null>(null);
    const [restockQty, setRestockQty] = useState(10);

    useEffect(() => {
        setIsLoading(true);
        const t = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(t);
    }, [dateRange]);

    const formatKES = (val: number) =>
        new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);

    const handleRestock = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Added ${restockQty} units to ${restockProduct?.name}`);
        setRestockProduct(null);
        setRestockQty(10);
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans pb-8">

            {/* PAGE HEADER */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
                        <p className="text-[13px] text-slate-500 mt-0.5">Overview of your store performance</p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            {(['Today', '7d', '30d', '90d', 'Custom'] as DateRange[]).map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={`px-2.5 py-2 rounded text-[13px] font-medium transition ${
                                        dateRange === range
                                            ? 'bg-white text-blue-950 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => alert('Exporting report…')}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white text-[13px] font-medium px-3 py-2 rounded-md transition"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {INITIAL_KPIS[dateRange].map((kpi) => (
                        <div
                            key={kpi.id}
                            onClick={() => setSelectedKpi(kpi)}
                            className="bg-white border border-slate-200 rounded-md p-2 hover:border-blue-950 transition cursor-pointer flex flex-col justify-between"
                        >
                            {isLoading ? (
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                                    <div className="h-5 bg-slate-100 rounded w-3/4" />
                                    <div className="h-8 bg-slate-100 rounded w-full mt-2" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-medium text-slate-500 truncate">{kpi.title}</p>
                                            <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">
                                                {kpi.prefix}{kpi.value.toLocaleString(undefined, { minimumFractionDigits: kpi.decimals || 0, maximumFractionDigits: kpi.decimals || 0 })}{kpi.suffix}
                                            </h3>
                                        </div>
                                        <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold px-2 py-0.5 rounded ${
                                            kpi.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                        }`}>
                                            {kpi.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                            {kpi.change > 0 ? `+${kpi.change}%` : `${kpi.change}%`}
                                        </span>
                                    </div>

                                    <div className="h-9 mt-2 -mx-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={kpi.sparklineData}>
                                                <Line
                                                    type="monotone"
                                                    dataKey="value"
                                                    stroke={kpi.isPositive ? GREEN : RED}
                                                    strokeWidth={1.5}
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* ROW: Revenue + Orders by Status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                    {/* Revenue */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-md p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[13px] font-semibold text-slate-900">Revenue & Orders Overview</h2>
                                <p className="text-[13px] text-slate-500">Performance metrics across selected period</p>
                            </div>
                            <div className="inline-flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                                {(['Revenue', 'Orders'] as RevenueTab[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setRevenueTab(tab)}
                                        className={`px-2.5 py-2 rounded text-[13px] font-medium transition ${
                                            revenueTab === tab ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="h-64 bg-slate-100 rounded animate-pulse" />
                        ) : (
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={REVENUE_CHART_DATA[dateRange]}>
                                        <defs>
                                            <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                                                <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} tickLine={false} />
                                        <YAxis
                                            stroke="#94a3b8"
                                            fontSize={13}
                                            tickLine={false}
                                            tickFormatter={(val) => (revenueTab === 'Revenue' ? `${val / 1000}k` : val)}
                                        />
                                        <Tooltip
                                            formatter={(value: any) => [
                                                revenueTab === 'Revenue' ? formatKES(Number(value)) : `${value} orders`,
                                                revenueTab,
                                            ]}
                                            contentStyle={{
                                                backgroundColor: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '6px',
                                                color: '#0f172a',
                                                fontSize: '13px',
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey={revenueTab === 'Revenue' ? 'revenue' : 'orders'}
                                            stroke={BLUE}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#fillBlue)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Orders by Status */}
                    <div className="bg-white border border-slate-200 rounded-md p-2 space-y-2">
                        <div>
                            <h2 className="text-[13px] font-semibold text-slate-900">Orders by Status</h2>
                            <p className="text-[13px] text-slate-500">Distribution of current workflow</p>
                        </div>

                        {isLoading ? (
                            <div className="h-56 bg-slate-100 rounded animate-pulse" />
                        ) : (
                            <div className="h-56 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={ORDER_STATUS_DATA}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {ORDER_STATUS_DATA.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: any) => [`${value} orders`, 'Count']}
                                            contentStyle={{
                                                backgroundColor: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '6px',
                                                color: '#0f172a',
                                                fontSize: '13px',
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[15px] font-bold text-slate-900">5,090</span>
                                    <span className="text-[13px] text-slate-500">Total</span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                            {ORDER_STATUS_DATA.map((item) => (
                                <div key={item.name} className="flex items-center gap-2 text-[13px]">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-600 truncate">{item.name}</span>
                                    <span className="font-semibold text-slate-900 ml-auto">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ROW: Top Products + Recent Orders */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                    {/* Top Products */}
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[13px] font-semibold text-slate-900">Top Selling Products</h2>
                                <p className="text-[13px] text-slate-500">Best performing items by revenue</p>
                            </div>
                            <Link href="/admin/products" className="text-[13px] font-medium text-blue-950 hover:underline">
                                View all
                            </Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px]">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-500">
                                        <th className="py-2 px-2 font-medium">Product</th>
                                        <th className="py-2 px-2 font-medium">SKU</th>
                                        <th className="py-2 px-2 font-medium text-right">Sold</th>
                                        <th className="py-2 px-2 font-medium text-right">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {TOP_PRODUCTS.map((p) => (
                                        <tr
                                            key={p.id}
                                            onClick={() => setSelectedProduct(p)}
                                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                                        >
                                            <td className="py-2 px-2 flex items-center gap-2">
                                                <img src={p.image} alt={p.name} className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0" />
                                                <span className="font-medium text-slate-900 line-clamp-1">{p.name}</span>
                                            </td>
                                            <td className="py-2 px-2 text-slate-500 font-mono">{p.sku}</td>
                                            <td className="py-2 px-2 text-right text-slate-700">{p.sold}</td>
                                            <td className="py-2 px-2 text-right font-semibold text-slate-900">{formatKES(p.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Orders */}
                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[13px] font-semibold text-slate-900">Recent Orders</h2>
                                <p className="text-[13px] text-slate-500">Latest store transactions</p>
                            </div>
                            <Link href="/admin/orders" className="text-[13px] font-medium text-blue-950 hover:underline">
                                View all
                            </Link>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {RECENT_ORDERS.map((ord) => (
                                <div key={ord.id} className="py-2 flex items-center justify-between text-[13px]">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-900">{ord.orderNumber}</span>
                                            <span className="text-slate-400">•</span>
                                            <span className="text-slate-600 truncate">{ord.customer}</span>
                                        </div>
                                        <p className="text-[13px] text-slate-400 mt-0.5">{ord.time}</p>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                        <p className="font-semibold text-slate-900">${ord.amount.toFixed(2)}</p>
                                        <span className={`inline-block px-2 py-0.5 rounded text-[13px] font-medium border ${STATUS_STYLES[ord.status]}`}>
                                            {ord.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ROW: Low Stock + Payment Methods */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                    {/* Low Stock */}
                    <div className="bg-white border border-slate-200 rounded-md p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <div>
                                    <h2 className="text-[13px] font-semibold text-slate-900">Low Stock Alerts</h2>
                                    <p className="text-[13px] text-slate-500">Products needing restock</p>
                                </div>
                            </div>
                            <span className="text-[13px] font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                                {LOW_STOCK_PRODUCTS.length} items
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {LOW_STOCK_PRODUCTS.map((item) => (
                                <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0" />
                                        <div className="min-w-0">
                                            <h4 className="font-medium text-slate-900 line-clamp-1">{item.name}</h4>
                                            <p className="text-[13px] text-slate-400 truncate">SKU: {item.sku} · Threshold: {item.threshold}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded border border-red-200 text-[13px]">
                                            {item.stock} left
                                        </span>
                                        <button
                                            onClick={() => setRestockProduct(item)}
                                            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-2 rounded-md text-[13px] transition"
                                        >
                                            Restock
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="bg-white border border-slate-200 rounded-md p-2 space-y-2">
                        <div>
                            <h2 className="text-[13px] font-semibold text-slate-900">Payment Method Breakdown</h2>
                            <p className="text-[13px] text-slate-500">Volume distribution across gateways</p>
                        </div>

                        <div className="h-56 w-full pt-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={PAYMENT_METHODS} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                                    <XAxis type="number" stroke="#94a3b8" fontSize={13} tickLine={false} tickFormatter={(v) => `${v / 1000000}M`} />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={13} tickLine={false} width={90} />
                                    <Tooltip
                                        formatter={(value: any) => [formatKES(Number(value)), 'Volume']}
                                        contentStyle={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            color: '#0f172a',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                                        {PAYMENT_METHODS.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </main>

            {/* KPI MODAL */}
            {selectedKpi && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-md max-w-md w-full p-3 space-y-3 shadow-xl relative">
                        <button
                            onClick={() => setSelectedKpi(null)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div>
                            <span className="text-[13px] font-semibold text-blue-950 uppercase tracking-wide">
                                {selectedKpi.title} Breakdown
                            </span>
                            <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">
                                {selectedKpi.prefix}{selectedKpi.value.toLocaleString()}{selectedKpi.suffix}
                            </h3>
                            <p className="text-[13px] text-slate-500 mt-0.5">
                                Detailed trend for {dateRange}.
                            </p>
                        </div>

                        <div className="h-40 w-full bg-white border border-slate-200 rounded-md p-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={selectedKpi.sparklineData}>
                                    <defs>
                                        <linearGradient id="fillKpi" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                                            <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} fill="url(#fillKpi)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="space-y-2 text-[13px]">
                            <div className="flex justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-500">Change</span>
                                <span className={`font-semibold ${selectedKpi.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {selectedKpi.isPositive ? `+${selectedKpi.change}%` : `${selectedKpi.change}%`} vs previous cycle
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-100">
                                <span className="text-slate-500">Data Interval</span>
                                <span className="font-medium text-slate-900">Real-time ({dateRange})</span>
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                onClick={() => setSelectedKpi(null)}
                                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-md text-[13px] transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRODUCT DRAWER */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white border-l border-slate-200 w-full max-w-md h-full p-3 overflow-y-auto shadow-xl flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-[13px] font-semibold text-slate-900">Product Details</h3>
                                <button
                                    onClick={() => setSelectedProduct(null)}
                                    className="text-slate-400 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="w-full h-40 rounded-md bg-slate-100 border border-slate-200 overflow-hidden">
                                    <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <span className="text-[13px] font-semibold text-blue-950 uppercase tracking-wide">
                                        {selectedProduct.category}
                                    </span>
                                    <h2 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedProduct.name}</h2>
                                    <p className="text-[13px] text-slate-500 font-mono mt-0.5">SKU: {selectedProduct.sku}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white border border-slate-200 p-2 rounded-md">
                                        <p className="text-[13px] text-slate-500">Units Sold</p>
                                        <p className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedProduct.sold}</p>
                                    </div>
                                    <div className="bg-white border border-slate-200 p-2 rounded-md">
                                        <p className="text-[13px] text-slate-500">Revenue</p>
                                        <p className="text-[15px] font-bold text-slate-900 mt-0.5">{formatKES(selectedProduct.revenue)}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 text-[13px]">
                                    <div className="flex justify-between py-2 border-b border-slate-100">
                                        <span className="text-slate-500">Inventory</span>
                                        <span className={`font-semibold ${selectedProduct.stock <= 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {selectedProduct.stock} units
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-slate-100">
                                        <span className="text-slate-500">Listing ID</span>
                                        <span className="font-mono text-slate-900">{selectedProduct.id}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setRestockProduct(selectedProduct);
                                    setSelectedProduct(null);
                                }}
                                className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-md text-[13px] transition"
                            >
                                Restock
                            </button>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 px-3 rounded-md text-[13px] transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RESTOCK MODAL */}
            {restockProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-md max-w-md w-full p-3 space-y-3 shadow-xl relative">
                        <button
                            onClick={() => setRestockProduct(null)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div>
                            <h3 className="text-[13px] font-semibold text-slate-900">Restock Inventory</h3>
                            <p className="text-[13px] text-slate-500 mt-0.5">
                                Add units to <span className="font-medium text-slate-900">{restockProduct.name}</span>
                            </p>
                        </div>

                        <form onSubmit={handleRestock} className="space-y-3">
                            <div>
                                <label className="block text-[13px] font-medium text-slate-700 mb-1">Units to add</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={restockQty}
                                    onChange={(e) => setRestockQty(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                                />
                                <p className="text-[13px] text-slate-400 mt-1">Current stock: {restockProduct.stock} units</p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setRestockProduct(null)}
                                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-md text-[13px] transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-md text-[13px] transition"
                                >
                                    Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}