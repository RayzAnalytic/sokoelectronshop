'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Settings,
  Send,
  Search,
  Clock,
  CheckCircle2,
  X,
  ExternalLink,
  Trash2,
  CheckSquare,
  Square,
  ShoppingBag,
  DollarSign,
  Phone,
  Users,
  LayoutTemplate,
  Package,
  Bell,
  Zap,
  UserCircle,
  ChevronRight,
  CheckCheck,
  Repeat,
  ToggleLeft,
  ToggleRight,
  MessageCircle,
  Activity,
  CreditCard,
  Shield,
  UserPlus,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
type WhatsAppOrderStatus = 'New' | 'Replied' | 'Converted' | 'Lost';

interface WhatsAppOrderItem {
  id: string;
  name: string;
  image: string;
  quantity: number;
  price: number;
}

interface WhatsAppOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  items: WhatsAppOrderItem[];
  total: number;
  status: WhatsAppOrderStatus;
  lastMessageTime: string;
  rawMessage: string;
  internalNotes?: string;
}

type WhatsAppModule =
  | 'orders'
  | 'account'
  | 'conversations'
  | 'contacts'
  | 'templates'
  | 'products'
  | 'notifications'
  | 'automation';

type ConversationStatus = 'Open' | 'Pending' | 'Resolved' | 'Archived';
type ContactTag = 'VIP' | 'Lead' | 'Customer' | 'Blocked' | 'New';
type NotificationType = 'Order' | 'Payment' | 'Stock' | 'System' | 'Message';

interface WhatsAppAccount {
  id: string;
  businessName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
  status: 'Connected' | 'Disconnected' | 'Pending';
  qualityRating: 'High' | 'Medium' | 'Low';
  messagingLimit: string;
  verifiedName: string;
  connectedAt: string;
  webhookUrl: string;
}

interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'image' | 'document' | 'order';
}

interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  status: ConversationStatus;
  assignedTo?: string;
  tags: ContactTag[];
  messages: ChatMessage[];
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  tags: ContactTag[];
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
  createdAt: string;
  optedIn: boolean;
  notes?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: 'Marketing' | 'Utility' | 'Authentication';
  language: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  headerType: 'None' | 'Text' | 'Image' | 'Document';
  headerContent?: string;
  body: string;
  footer?: string;
  buttons: { type: string; text: string }[];
  variables: string[];
  updatedAt: string;
}

interface WhatsAppProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  currency: string;
  catalogId: string;
  sku: string;
  stock: number;
  status: 'Active' | 'Draft' | 'Out of Stock';
  retailerId: string;
  url: string;
  description: string;
}

interface WhatsAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionTarget?: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  executions: number;
  lastRun: string;
  description: string;
}

// ============================================================
// INITIAL DATA
// ============================================================
const INITIAL_WHATSAPP_ORDERS: WhatsAppOrder[] = [
  {
    id: 'wa-101',
    customerName: 'Brian Kiprop',
    customerPhone: '+254 712 345 678',
    items: [
      { id: 'p1', name: 'Smart Home Wi-Fi Router AX3000', image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=200&auto=format&fit=crop&q=80', quantity: 1, price: 6500 },
      { id: 'p2', name: 'Cat6 Ethernet Cable (10m)', image: 'https://images.unsplash.com/photo-1615840287214-7ff58936c4cf?w=200&auto=format&fit=crop&q=80', quantity: 2, price: 800 },
    ],
    total: 8100,
    status: 'New',
    lastMessageTime: '10 mins ago',
    rawMessage: 'Hello! I would like to order:\n- 1x Smart Home Wi-Fi Router AX3000 (KES 6,500)\n- 2x Cat6 Ethernet Cable (10m) (KES 800)\nTotal: KES 8,100\nDeliver to: Westlands, Nairobi.',
    internalNotes: 'Customer asked if same-day boda delivery is available.',
  },
  {
    id: 'wa-102',
    customerName: 'Amina Mohamed',
    customerPhone: '+254 733 987 654',
    items: [
      { id: 'p3', name: 'Wireless Ergonomic Mechanical Keyboard', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200&auto=format&fit=crop&q=80', quantity: 1, price: 4500 },
    ],
    total: 4500,
    status: 'Replied',
    lastMessageTime: '45 mins ago',
    rawMessage: 'Hi, is this keyboard compatible with Mac OS as well? Interested in buying one.',
    internalNotes: 'Sent compatibility details and payment link via WhatsApp.',
  },
  {
    id: 'wa-103',
    customerName: 'Kevin Otieno',
    customerPhone: '+254 722 111 222',
    items: [
      { id: 'p4', name: 'UltraWide 29" Gaming Monitor', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=200&auto=format&fit=crop&q=80', quantity: 1, price: 28000 },
      { id: 'p5', name: 'Adjustable Desk Monitor Arm', image: 'https://images.unsplash.com/photo-1616627561950-9f746e330187?w=200&auto=format&fit=crop&q=80', quantity: 1, price: 3500 },
    ],
    total: 31500,
    status: 'Converted',
    lastMessageTime: '3 hours ago',
    rawMessage: 'Order cart checkout via WhatsApp button:\n- 1x UltraWide 29" Gaming Monitor\n- 1x Adjustable Desk Monitor Arm\nTotal: KES 31,500',
    internalNotes: 'Converted into formal order #SOKO-9921. Paid via M-Pesa STK.',
  },
  {
    id: 'wa-104',
    customerName: 'Wanjiku Mwangi',
    customerPhone: '+254 700 555 444',
    items: [
      { id: 'p6', name: 'USB-C Multiport Hub 7-in-1', image: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=200&auto=format&fit=crop&q=80', quantity: 1, price: 2200 },
    ],
    total: 2200,
    status: 'Lost',
    lastMessageTime: 'Yesterday',
    rawMessage: 'Checking on stock availability for USB hub. Looking for gray color.',
    internalNotes: 'Item was out of stock in gray. Customer decided not to proceed.',
  },
];

const INITIAL_ACCOUNT: WhatsAppAccount = {
  id: 'acc-1',
  businessName: 'SokoFlow Electronics',
  phoneNumber: '+254 700 000 000',
  phoneNumberId: '102938475610293',
  wabaId: 'WABA-8472910384',
  accessToken: 'EAAG...xK9z',
  verifyToken: 'sokoflow_verify_2024',
  status: 'Connected',
  qualityRating: 'High',
  messagingLimit: 'Unlimited',
  verifiedName: 'SokoFlow Electronics Ltd',
  connectedAt: 'Jan 12, 2024',
  webhookUrl: 'https://api.sokoflow.com/webhooks/whatsapp',
};

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    contactId: 'c-1',
    contactName: 'Brian Kiprop',
    contactPhone: '+254 712 345 678',
    lastMessage: 'Great, I will send the M-Pesa shortly.',
    lastMessageTime: '2 mins ago',
    unread: 2,
    status: 'Open',
    tags: ['Customer'],
    messages: [
      { id: 'm1', direction: 'inbound', body: 'Hello! I would like to order the Wi-Fi router.', timestamp: '10:12', status: 'read', type: 'text' },
      { id: 'm2', direction: 'outbound', body: 'Hi Brian! Great choice. The AX3000 is KES 6,500. Would you like to add anything else?', timestamp: '10:14', status: 'read', type: 'text' },
      { id: 'm3', direction: 'inbound', body: 'Yes, add 2 Cat6 cables please.', timestamp: '10:15', status: 'read', type: 'text' },
      { id: 'm4', direction: 'outbound', body: 'Total: KES 8,100. Sending the payment link now.', timestamp: '10:16', status: 'read', type: 'text' },
      { id: 'm5', direction: 'inbound', body: 'Great, I will send the M-Pesa shortly.', timestamp: '10:18', status: 'delivered', type: 'text' },
    ],
  },
  {
    id: 'conv-2',
    contactId: 'c-2',
    contactName: 'Amina Mohamed',
    contactPhone: '+254 733 987 654',
    lastMessage: 'Thanks for the info!',
    lastMessageTime: '45 mins ago',
    unread: 0,
    status: 'Pending',
    assignedTo: 'Faith K.',
    tags: ['Lead'],
    messages: [
      { id: 'm1', direction: 'inbound', body: 'Hi, is this keyboard compatible with Mac OS?', timestamp: '09:30', status: 'read', type: 'text' },
      { id: 'm2', direction: 'outbound', body: 'Yes it is! Full macOS support with Cmd key mapping.', timestamp: '09:45', status: 'read', type: 'text' },
      { id: 'm3', direction: 'inbound', body: 'Thanks for the info!', timestamp: '09:46', status: 'read', type: 'text' },
    ],
  },
];

const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'c-1',
    name: 'Brian Kiprop',
    phone: '+254 712 345 678',
    email: 'brian.k@example.com',
    location: 'Westlands, Nairobi',
    tags: ['Customer'],
    totalOrders: 4,
    totalSpent: 24500,
    lastOrderDate: '2024-01-15',
    createdAt: '2023-08-12',
    optedIn: true,
    notes: 'Prefers boda delivery in the morning.',
  },
  {
    id: 'c-2',
    name: 'Amina Mohamed',
    phone: '+254 733 987 654',
    email: 'amina.m@example.com',
    location: 'Mombasa',
    tags: ['Lead'],
    totalOrders: 0,
    totalSpent: 0,
    createdAt: '2024-01-10',
    optedIn: true,
  },
  {
    id: 'c-3',
    name: 'Kevin Otieno',
    phone: '+254 722 111 222',
    location: 'Kileleshwa, Nairobi',
    tags: ['VIP', 'Customer'],
    totalOrders: 12,
    totalSpent: 187000,
    lastOrderDate: '2024-01-18',
    createdAt: '2023-03-04',
    optedIn: true,
  },
];

const INITIAL_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-1',
    name: 'order_confirmation',
    category: 'Utility',
    language: 'en_US',
    status: 'Approved',
    headerType: 'Text',
    headerContent: 'Order Confirmed',
    body: 'Hi {{1}}, your order {{2}} has been confirmed. Total: KES {{3}}. We will notify you when it ships.',
    footer: 'SokoFlow Electronics',
    buttons: [{ type: 'URL', text: 'Track Order' }],
    variables: ['customer_name', 'order_id', 'total'],
    updatedAt: 'Jan 10, 2024',
  },
  {
    id: 'tpl-2',
    name: 'cart_recovery',
    category: 'Marketing',
    language: 'en_US',
    status: 'Approved',
    headerType: 'Image',
    headerContent: 'https://example.com/cart.jpg',
    body: 'Hi {{1}}, you left {{2}} item(s) in your cart worth KES {{3}}. Complete your order now and get 5% off!',
    footer: 'Reply STOP to opt out',
    buttons: [{ type: 'URL', text: 'Resume Cart' }],
    variables: ['customer_name', 'item_count', 'cart_total'],
    updatedAt: 'Jan 08, 2024',
  },
  {
    id: 'tpl-3',
    name: 'payment_reminder',
    category: 'Utility',
    language: 'en_US',
    status: 'Pending',
    headerType: 'None',
    body: 'Hi {{1}}, this is a friendly reminder that your order {{2}} is awaiting payment of KES {{3}}.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Pay Now' }],
    variables: ['customer_name', 'order_id', 'amount'],
    updatedAt: 'Jan 14, 2024',
  },
];

const INITIAL_PRODUCTS: WhatsAppProduct[] = [
  {
    id: 'wp-1',
    name: 'Smart Home Wi-Fi Router AX3000',
    image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=200&auto=format&fit=crop&q=80',
    price: 6500,
    currency: 'KES',
    catalogId: 'cat-001',
    sku: 'RTR-AX3000',
    stock: 42,
    status: 'Active',
    retailerId: 'ret-001',
    url: 'https://sokoflow.com/p/router-ax3000',
    description: 'Dual-band Wi-Fi 6 router',
  },
  {
    id: 'wp-2',
    name: 'Wireless Ergonomic Mechanical Keyboard',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200&auto=format&fit=crop&q=80',
    price: 4500,
    currency: 'KES',
    catalogId: 'cat-001',
    sku: 'KBD-ERG-01',
    stock: 18,
    status: 'Active',
    retailerId: 'ret-002',
    url: 'https://sokoflow.com/p/keyboard-erg',
    description: 'Mac/Windows compatible',
  },
  {
    id: 'wp-3',
    name: 'UltraWide 29" Gaming Monitor',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=200&auto=format&fit=crop&q=80',
    price: 28000,
    currency: 'KES',
    catalogId: 'cat-002',
    sku: 'MON-UW-29',
    stock: 0,
    status: 'Out of Stock',
    retailerId: 'ret-003',
    url: 'https://sokoflow.com/p/monitor-uw29',
    description: '2560x1080 IPS panel',
  },
];

const INITIAL_NOTIFICATIONS: WhatsAppNotification[] = [
  { id: 'n-1', type: 'Order', title: 'New WhatsApp order', message: 'Brian Kiprop placed an order worth KES 8,100', timestamp: '10 mins ago', read: false, actionLabel: 'View Order', actionTarget: 'wa-101' },
  { id: 'n-2', type: 'Payment', title: 'Payment received', message: 'KES 31,500 M-Pesa payment confirmed for #SOKO-9921', timestamp: '3 hours ago', read: false, actionLabel: 'View', actionTarget: 'wa-103' },
  { id: 'n-3', type: 'Stock', title: 'Low stock alert', message: 'UltraWide 29" Gaming Monitor is now out of stock', timestamp: '5 hours ago', read: true },
  { id: 'n-4', type: 'Message', title: 'Unread conversation', message: 'Amina Mohamed is waiting for a reply', timestamp: '45 mins ago', read: true, actionLabel: 'Open Chat', actionTarget: 'conv-2' },
  { id: 'n-5', type: 'System', title: 'Template approved', message: 'order_confirmation template was approved by Meta', timestamp: 'Yesterday', read: true },
];

const INITIAL_AUTOMATIONS: AutomationRule[] = [
  { id: 'auto-1', name: 'Welcome new contact', trigger: 'New contact added', action: 'Send welcome template', enabled: true, executions: 342, lastRun: '2 mins ago', description: 'Sends a welcome message with catalog link to every new WhatsApp contact.' },
  { id: 'auto-2', name: 'Abandoned cart recovery', trigger: 'Cart idle for 30 mins', action: 'Send cart_recovery template', enabled: true, executions: 87, lastRun: '18 mins ago', description: 'Recovers abandoned carts with a 5% discount incentive.' },
  { id: 'auto-3', name: 'Order status updates', trigger: 'Order status changed', action: 'Send tracking template', enabled: true, executions: 1204, lastRun: '1 min ago', description: 'Notifies customer each time their order moves to a new stage.' },
  { id: 'auto-4', name: 'Payment reminders', trigger: 'Unpaid order > 1 hour', action: 'Send payment_reminder template', enabled: false, executions: 0, lastRun: 'Never', description: 'Nudges customers with pending payments once per day.' },
  { id: 'auto-5', name: 'VIP thank-you', trigger: 'Order > KES 50,000', action: 'Send thank-you + loyalty points', enabled: true, executions: 23, lastRun: '4 hours ago', description: 'Sends a personalized thank-you to high-value customers.' },
];

const STATUS_TABS = ['All', 'New', 'Replied', 'Converted', 'Lost'] as const;

// ============================================================
// MAIN PAGE
// ============================================================
export default function WhatsAppOrdersPage() {
  const [orders, setOrders] = useState<WhatsAppOrder[]>(INITIAL_WHATSAPP_ORDERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeOrder, setActiveOrder] = useState<WhatsAppOrder | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // module state
  const [activeModule, setActiveModule] = useState<WhatsAppModule>('orders');
  const [account, setAccount] = useState<WhatsAppAccount>(INITIAL_ACCOUNT);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [templates, setTemplates] = useState<MessageTemplate[]>(INITIAL_TEMPLATES);
  const [waProducts, setWaProducts] = useState<WhatsAppProduct[]>(INITIAL_PRODUCTS);
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>(INITIAL_NOTIFICATIONS);
  const [automations, setAutomations] = useState<AutomationRule[]>(INITIAL_AUTOMATIONS);

  const [waNumber, setWaNumber] = useState('+254 700 000 000');
  const [cartTemplate, setCartTemplate] = useState(
    'Hello! I would like to place an order for the following cart items:\n{items}\nTotal: KES {total}\nCustomer Name: {customer_name}'
  );
  const [inquiryTemplate, setInquiryTemplate] = useState('Hello, I have a product inquiry regarding:');

  const [broadcastAudience, setBroadcastAudience] = useState('All Customers');
  const [broadcastMessage, setBroadcastMessage] = useState(
    '🔥 Weekend Flash Sale! Enjoy up to 20% off on all electronics. Tap to shop now: https://example.com'
  );
  const [broadcastSchedule, setBroadcastSchedule] = useState('Now');

  const anyModalOpen = isSettingsOpen || isBroadcastOpen || isCreateOrderOpen || activeOrder !== null;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreateOrderOpen) setIsCreateOrderOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isBroadcastOpen) setIsBroadcastOpen(false);
        else if (activeOrder) setActiveOrder(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen, isCreateOrderOpen, isSettingsOpen, isBroadcastOpen, activeOrder]);

  const toast = (msg: string) => setToastMessage(msg);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.rawMessage.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const todayCount = orders.length;
    const convertedCount = orders.filter((o) => o.status === 'Converted').length;
    const pendingCount = orders.filter((o) => o.status === 'New' || o.status === 'Replied').length;
    const totalRevenue = orders.filter((o) => o.status === 'Converted').reduce((sum, o) => sum + o.total, 0);
    return { todayCount, convertedCount, pendingCount, totalRevenue };
  }, [orders]);

  const updateStatus = (id: string, newStatus: WhatsAppOrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const updated = { ...o, status: newStatus };
        if (activeOrder && activeOrder.id === id) setActiveOrder(updated);
        return updated;
      })
    );
    toast(`Marked ${newStatus.toLowerCase()}`);
  };

  const deleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (activeOrder?.id === id) setActiveOrder(null);
    toast('Order deleted');
  };

  const allSelected = filteredOrders.length > 0 && selectedIds.length === filteredOrders.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filteredOrders.map((o) => o.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const bulkDelete = () => {
    setOrders((prev) => prev.filter((o) => !selectedIds.includes(o.id)));
    setSelectedIds([]);
    toast('Selected orders deleted');
  };

  const confirmCreateOrder = () => {
    if (!activeOrder) return;
    updateStatus(activeOrder.id, 'Converted');
    setIsCreateOrderOpen(false);
    toast(`Formal order created from ${activeOrder.customerName}'s chat`);
  };

  const sendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBroadcastOpen(false);
    toast('Broadcast dispatched');
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingsOpen(false);
    toast('WhatsApp settings saved');
  };

  const statusBadge = (s: WhatsAppOrderStatus) =>
    s === 'Converted'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'New'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Replied'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : 'bg-slate-100 text-slate-500 border-slate-200';

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const moduleTabs: { key: WhatsAppModule; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'orders', label: 'Orders', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'conversations', label: 'Conversations', icon: <MessageCircle className="w-3.5 h-3.5" />, badge: conversations.reduce((s, c) => s + c.unread, 0) },
    { key: 'contacts', label: 'Contacts', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'templates', label: 'Templates', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
    { key: 'products', label: 'Products', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="w-3.5 h-3.5" />, badge: unreadNotifications },
    { key: 'automation', label: 'Automation', icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'account', label: 'Account', icon: <UserCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              WhatsApp commerce
              <span className="inline-flex items-center gap-1 text-[13px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-sm">
                <MessageSquare className="w-3 h-3" />
                Cart button feed
              </span>
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Orders, conversations, catalog and automations driven by the WhatsApp checkout button
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              onClick={() => setIsBroadcastOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Send className="w-3.5 h-3.5" />
              Broadcast
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {/* MODULE NAV */}
        <div className="bg-white border border-slate-200 rounded-sm p-0.5 flex items-center gap-0.5 overflow-x-auto">
          {moduleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveModule(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${activeModule === tab.key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 rounded-sm text-[13px] ${activeModule === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ORDERS MODULE */}
        {activeModule === 'orders' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard label="Total inquiries" value={stats.todayCount.toString()} icon={<MessageSquare className="w-4 h-4" />} tint="bg-emerald-50 text-emerald-700" />
              <StatCard label="Converted" value={stats.convertedCount.toString()} icon={<CheckCircle2 className="w-4 h-4" />} tint="bg-emerald-50 text-emerald-700" />
              <StatCard label="Pending reply" value={stats.pendingCount.toString()} icon={<Clock className="w-4 h-4" />} tint="bg-amber-50 text-amber-700" />
              <StatCard label="WhatsApp revenue" value={`KES ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} tint="bg-blue-50 text-blue-950" mono />
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
                {STATUS_TABS.map((status) => {
                  const count = status === 'All' ? orders.length : orders.filter((o) => o.status === status).length;
                  const isActive = statusFilter === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                        }`}
                    >
                      {status}
                      <span className={`px-1.5 rounded-sm text-[13px] ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative flex-1 lg:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, phone, or message…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
                <button
                  onClick={bulkDelete}
                  className="bg-red-600 hover:bg-red-500 px-2.5 py-2 rounded-sm text-[13px] font-medium inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete selected
                </button>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">Cart inquiries · {filteredOrders.length}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 w-10">
                        <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                          {allSelected ? <CheckSquare className="w-4 h-4 text-blue-950" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      <th className="py-2 px-3 font-medium">Customer</th>
                      <th className="py-2 px-3 font-medium">Items</th>
                      <th className="py-2 px-3 font-medium text-right">Total</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Last message</th>
                      <th className="py-2 px-3 w-32"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                          No WhatsApp orders match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isSelected = selectedIds.includes(order.id);
                        const firstItem = order.items[0];
                        return (
                          <tr
                            key={order.id}
                            onClick={() => setActiveOrder(order)}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                          >
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => toggleRow(order.id)} className="text-slate-400 hover:text-slate-700">
                                {isSelected ? <CheckSquare className="w-4 h-4 text-blue-950" /> : <Square className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="py-2 px-3">
                              <p className="font-medium text-slate-900 truncate">{order.customerName}</p>
                              <p className="text-[13px] text-emerald-700 font-mono inline-flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {order.customerPhone}
                              </p>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {firstItem && (
                                  <img src={firstItem.image} alt="" className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-slate-700 truncate max-w-xs">
                                    {firstItem ? `${firstItem.quantity}× ${firstItem.name}` : 'No items'}
                                  </p>
                                  {order.items.length > 1 && (
                                    <p className="text-[13px] text-slate-400">
                                      +{order.items.length - 1} more item{order.items.length - 1 > 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                              KES {order.total.toLocaleString()}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono">{order.lastMessageTime}</td>
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <a
                                  href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open in WhatsApp"
                                  className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-emerald-700 transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                {order.status !== 'Converted' && (
                                  <button
                                    onClick={() => updateStatus(order.id, 'Converted')}
                                    title="Mark converted"
                                    className="p-2 rounded-sm bg-white border border-blue-200 hover:bg-blue-50 text-blue-950 transition"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteOrder(order.id)}
                                  title="Delete"
                                  className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeModule === 'conversations' && (
          <ConversationsModule
            conversations={conversations}
            activeConversation={activeConversation}
            onSelect={setActiveConversation}
            onSend={(convId, body) => {
              const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === convId
                    ? {
                      ...c,
                      messages: [...c.messages, { id: `m-${Date.now()}`, direction: 'outbound', body, timestamp: now, status: 'sent', type: 'text' }],
                      lastMessage: body,
                      lastMessageTime: 'Just now',
                    }
                    : c
                )
              );
              setActiveConversation((prev) =>
                prev && prev.id === convId
                  ? { ...prev, messages: [...prev.messages, { id: `m-${Date.now()}`, direction: 'outbound', body, timestamp: now, status: 'sent', type: 'text' }] }
                  : prev
              );
            }}
            onStatusChange={(convId, status) => {
              setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, status } : c)));
              setActiveConversation((prev) => (prev && prev.id === convId ? { ...prev, status } : prev));
              toast(`Conversation marked ${status.toLowerCase()}`);
            }}
          />
        )}

        {activeModule === 'contacts' && (
          <ContactsModule
            contacts={contacts}
            onDelete={(id) => {
              setContacts((prev) => prev.filter((c) => c.id !== id));
              toast('Contact deleted');
            }}
            onToggleOptIn={(id) => {
              setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, optedIn: !c.optedIn } : c)));
              toast('Opt-in updated');
            }}
          />
        )}

        {activeModule === 'templates' && (
          <TemplatesModule
            templates={templates}
            onToggleStatus={(id) => {
              setTemplates((prev) =>
                prev.map((t) => (t.id === id ? { ...t, status: t.status === 'Approved' ? 'Pending' : 'Approved' } : t))
              );
              toast('Template status updated');
            }}
            onDelete={(id) => {
              setTemplates((prev) => prev.filter((t) => t.id !== id));
              toast('Template deleted');
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeModule === 'products' && (
          <ProductsModule
            products={waProducts}
            onToggleStatus={(id) => {
              setWaProducts((prev) =>
                prev.map((p) => (p.id === id ? { ...p, status: p.status === 'Active' ? 'Draft' : 'Active' } : p))
              );
              toast('Product status updated');
            }}
          />
        )}

        {activeModule === 'notifications' && (
          <NotificationsModule
            notifications={notifications}
            onMarkAllRead={() => {
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
              toast('All notifications marked as read');
            }}
            onMarkRead={(id) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))}
            onDelete={(id) => {
              setNotifications((prev) => prev.filter((n) => n.id !== id));
              toast('Notification dismissed');
            }}
          />
        )}

        {activeModule === 'automation' && (
          <AutomationModule
            automations={automations}
            onToggle={(id) => {
              setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
              toast('Automation toggled');
            }}
            onRunNow={(id) => {
              setAutomations((prev) =>
                prev.map((a) => (a.id === id ? { ...a, executions: a.executions + 1, lastRun: 'Just now' } : a))
              );
              toast('Automation executed manually');
            }}
          />
        )}

        {activeModule === 'account' && (
          <AccountModule
            account={account}
            onSave={(updated) => {
              setAccount(updated);
              setWaNumber(updated.phoneNumber);
              toast('Account settings saved');
            }}
            onDisconnect={() => {
              setAccount((prev) => ({ ...prev, status: 'Disconnected' }));
              toast('WhatsApp account disconnected');
            }}
            onReconnect={() => {
              setAccount((prev) => ({ ...prev, status: 'Connected' }));
              toast('WhatsApp account reconnected');
            }}
          />
        )}
      </main>

      {/* DETAIL DRAWER */}
      {activeOrder && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end" onClick={() => setActiveOrder(null)}>
          <div className="bg-white border-l border-slate-200 w-full max-w-xl h-full flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900 truncate">{activeOrder.customerName}</p>
                  <p className="text-[13px] text-slate-500 font-mono truncate">{activeOrder.customerPhone}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Original WhatsApp cart message</p>
                <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2 font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {activeOrder.rawMessage}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Cart breakdown · {activeOrder.items.length}</p>
                <ul className="border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
                  {activeOrder.items.map((item) => (
                    <li key={item.id} className="p-2 flex items-center gap-2 bg-white">
                      <img src={item.image} alt="" className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-[13px] text-slate-500">{item.quantity} × KES {item.price.toLocaleString()}</p>
                      </div>
                      <span className="font-mono font-medium text-slate-900 shrink-0">
                        KES {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </li>
                  ))}
                  <li className="p-2 bg-slate-50 flex items-center justify-between font-medium">
                    <span>Total</span>
                    <span className="font-mono text-emerald-700">KES {activeOrder.total.toLocaleString()}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[13px] font-medium text-slate-500 mb-1">Update status</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['New', 'Replied', 'Converted', 'Lost'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => updateStatus(activeOrder.id, st)}
                      className={`py-2 rounded-sm text-[13px] font-medium transition ${activeOrder.status === st
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Internal notes</p>
                <textarea
                  rows={3}
                  defaultValue={activeOrder.internalNotes || ''}
                  placeholder="Add notes about the customer, delivery, or payment…"
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <button
                onClick={() => setIsCreateOrderOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-sm text-[13px] inline-flex items-center justify-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Create order from this chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      {isCreateOrderOpen && activeOrder && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setIsCreateOrderOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900">Confirm & generate formal order</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">Convert WhatsApp inquiry into an active fulfillment order</p>
              </div>
              <button onClick={() => setIsCreateOrderOpen(false)} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Customer</p>
                <p className="font-medium text-slate-900">{activeOrder.customerName} · {activeOrder.customerPhone}</p>
              </div>

              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Pre-filled cart items</p>
                <ul className="border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
                  {activeOrder.items.map((i) => (
                    <li key={i.id} className="p-2 flex items-center gap-2">
                      <img src={i.image} alt="" className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{i.name}</p>
                        <p className="text-[13px] text-slate-500">Qty {i.quantity}</p>
                      </div>
                      <span className="font-mono font-medium text-slate-900">KES {(i.price * i.quantity).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2 flex items-center justify-between">
                <span className="font-medium text-emerald-900">Total payable</span>
                <span className="font-mono font-medium text-emerald-700">KES {activeOrder.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button onClick={() => setIsCreateOrderOpen(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">
                Cancel
              </button>
              <button onClick={confirmCreateOrder} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]">
                Confirm & create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">WhatsApp integration settings</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">Business number and message templates</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveSettings} className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-slate-700 mb-1">WhatsApp business number</label>
                <input
                  type="text"
                  required
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Cart message template</label>
                <textarea
                  rows={4}
                  value={cartTemplate}
                  onChange={(e) => setCartTemplate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 font-mono text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <span className="text-[13px] text-slate-400">Variables:</span>
                  {['{items}', '{total}', '{customer_name}'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setCartTemplate((prev) => prev + ' ' + chip)}
                      className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono text-[13px] px-2 py-0.5 rounded-sm hover:bg-emerald-100 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Product inquiry template</label>
                <input
                  type="text"
                  value={inquiryTemplate}
                  onChange={(e) => setInquiryTemplate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsSettingsOpen(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">
                  Cancel
                </button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]">
                  Save settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BROADCAST MODAL */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setIsBroadcastOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Broadcast WhatsApp campaign</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">Send a message to a selected audience segment</p>
              </div>
              <button onClick={() => setIsBroadcastOpen(false)} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={sendBroadcast} className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target audience</label>
                <select
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="All Customers">All customers & contacts (1,420)</option>
                  <option value="Converted Only">Previous converted buyers (410)</option>
                  <option value="Recent Inquiries">Recent inquiries (92)</option>
                  <option value="VIP Members">VIP members (180)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Live preview</p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 space-y-1">
                  <p className="text-[13px] text-emerald-700 font-medium uppercase">SokoFlow official business</p>
                  <p className="text-[13px] text-slate-800 whitespace-pre-wrap">{broadcastMessage}</p>
                  <p className="text-[13px] text-slate-400 text-right">Just now ✓✓</p>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Schedule</label>
                <select
                  value={broadcastSchedule}
                  onChange={(e) => setBroadcastSchedule(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="Now">Send immediately</option>
                  <option value="Tomorrow Morning">Tomorrow at 9:00 AM</option>
                  <option value="Weekend Promo">Saturday at 10:00 AM</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsBroadcastOpen(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">
                  Cancel
                </button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Send broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================
function StatCard({
  label,
  value,
  icon,
  tint,
  mono,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
        <p className={`text-[15px] font-bold text-slate-900 mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>{icon}</span>
    </div>
  );
}

// ============================================================
// CONVERSATIONS MODULE
// ============================================================
function ConversationsModule({
  conversations,
  activeConversation,
  onSelect,
  onSend,
  onStatusChange,
}: {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelect: (c: Conversation | null) => void;
  onSend: (convId: string, body: string) => void;
  onStatusChange: (convId: string, status: ConversationStatus) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [draft, setDraft] = useState('');

  const filtered = conversations.filter((c) => {
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.contactName.toLowerCase().includes(q) ||
      c.contactPhone.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const send = () => {
    if (!draft.trim() || !activeConversation) return;
    onSend(activeConversation.id, draft.trim());
    setDraft('');
  };

  return (
    <div
      className="bg-white border border-slate-200 rounded-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[340px_1fr]"
      style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
    >
      <div className="border-r border-slate-200 flex flex-col min-h-0">
        <div className="p-2 border-b border-slate-200 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 w-full overflow-x-auto">
            {(['All', 'Open', 'Pending', 'Resolved', 'Archived'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 px-2 py-1.5 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${statusFilter === s ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-slate-400 text-[13px]">No conversations found.</p>
          ) : (
            filtered.map((c) => {
              const isActive = activeConversation?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={`w-full text-left p-2.5 hover:bg-slate-50 transition ${isActive ? 'bg-emerald-50/60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                      {c.contactName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{c.contactName}</p>
                        <span className="text-[13px] text-slate-400 font-mono shrink-0">{c.lastMessageTime}</span>
                      </div>
                      <p className="text-[13px] text-slate-500 truncate mt-0.5">{c.lastMessage}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {c.tags.map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded-sm text-[13px] bg-slate-100 text-slate-600 border border-slate-200">
                            {t}
                          </span>
                        ))}
                        {c.unread > 0 && (
                          <span className="ml-auto px-1.5 py-0.5 rounded-sm text-[13px] bg-emerald-600 text-white font-medium">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {activeConversation ? (
        <div className="flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-slate-50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                {activeConversation.contactName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">{activeConversation.contactName}</p>
                <p className="text-[13px] text-emerald-700 font-mono truncate">{activeConversation.contactPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <select
                value={activeConversation.status}
                onChange={(e) => onStatusChange(activeConversation.id, e.target.value as ConversationStatus)}
                className="bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option>Open</option>
                <option>Pending</option>
                <option>Resolved</option>
                <option>Archived</option>
              </select>
              <a
                href={`https://wa.me/${activeConversation.contactPhone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-emerald-700"
                title="Open in WhatsApp"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {activeConversation.messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-sm px-2.5 py-2 text-[13px] ${m.direction === 'outbound' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <div className={`flex items-center gap-1 mt-1 justify-end ${m.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}>
                    <span className="text-[13px] font-mono">{m.timestamp}</span>
                    {m.direction === 'outbound' && (
                      <CheckCheck className={`w-3 h-3 ${m.status === 'read' ? 'text-white' : 'text-emerald-200'}`} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                onClick={send}
                disabled={!draft.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white p-2 rounded-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
          <MessageCircle className="w-8 h-8" />
          <p className="text-[13px]">Select a conversation to start chatting</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONTACTS MODULE
// ============================================================
function ContactsModule({
  contacts,
  onDelete,
  onToggleOptIn,
}: {
  contacts: Contact[];
  onDelete: (id: string) => void;
  onToggleOptIn: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const tags: ContactTag[] = ['VIP', 'Lead', 'Customer', 'Blocked', 'New'];

  const filtered = contacts.filter((c) => {
    const matchesTag = tagFilter === 'All' || c.tags.includes(tagFilter as ContactTag);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false);
    return matchesTag && matchesSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="p-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
          {(['All', ...tags] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${tagFilter === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 px-3 font-medium">Contact</th>
              <th className="py-2 px-3 font-medium">Tags</th>
              <th className="py-2 px-3 font-medium text-right">Orders</th>
              <th className="py-2 px-3 font-medium text-right">Spent</th>
              <th className="py-2 px-3 font-medium">Opt-in</th>
              <th className="py-2 px-3 font-medium">Added</th>
              <th className="py-2 px-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                  No contacts match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                        {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{c.name}</p>
                        <p className="text-[13px] text-emerald-700 font-mono truncate">{c.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded-sm text-[13px] bg-slate-100 text-slate-600 border border-slate-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{c.totalOrders}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">KES {c.totalSpent.toLocaleString()}</td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => onToggleOptIn(c.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[13px] font-medium border ${c.optedIn ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                    >
                      {c.optedIn ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                      {c.optedIn ? 'Subscribed' : 'Unsubscribed'}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-slate-400 font-mono">{c.createdAt}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-emerald-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATES MODULE
// ============================================================
function TemplatesModule({
  templates,
  onToggleStatus,
  onDelete,
  onOpenSettings,
}: {
  templates: MessageTemplate[];
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const filtered = templates.filter((t) => categoryFilter === 'All' || t.category === categoryFilter);

  const statusBadge = (s: MessageTemplate['status']) =>
    s === 'Approved'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Pending'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-red-50 text-red-700 border-red-100';

  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="p-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
          {(['All', 'Marketing', 'Utility', 'Authentication'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${categoryFilter === c ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
        >
          <Settings className="w-3.5 h-3.5" />
          Template settings
        </button>
      </div>

      <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {filtered.map((t) => (
          <div key={t.id} className="border border-slate-200 rounded-sm p-2 space-y-2 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 font-mono truncate">{t.name}</p>
                <p className="text-[13px] text-slate-500 mt-0.5">{t.category} · {t.language}</p>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[13px] shrink-0 ${statusBadge(t.status)}`}>
                {t.status}
              </span>
            </div>

            {t.headerType !== 'None' && (
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 text-[13px]">
                <span className="text-slate-400">Header: </span>
                <span className="font-mono text-slate-700 truncate">{t.headerContent || t.headerType}</span>
              </div>
            )}

            <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2">
              <p className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">{t.body}</p>
              {t.footer && <p className="text-[13px] text-slate-500 mt-1 border-t border-emerald-100 pt-1">{t.footer}</p>}
            </div>

            {t.buttons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.buttons.map((b, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-sm text-[13px] bg-white border border-slate-200 text-slate-600">
                    {b.type}: {b.text}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {t.variables.map((v) => (
                <span key={v} className="px-1.5 py-0.5 rounded-sm text-[13px] bg-blue-50 text-blue-950 border border-blue-100 font-mono">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[13px] text-slate-400 font-mono">{t.updatedAt}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleStatus(t.id)}
                  className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
                  title="Toggle status"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PRODUCTS MODULE
// ============================================================
function ProductsModule({
  products,
  onToggleStatus,
}: {
  products: WhatsAppProduct[];
  onToggleStatus: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const filtered = products.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const statusBadge = (s: WhatsAppProduct['status']) =>
    s === 'Active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Draft'
        ? 'bg-slate-100 text-slate-500 border-slate-200'
        : 'bg-red-50 text-red-700 border-red-100';

  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="p-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
          {(['All', 'Active', 'Draft', 'Out of Stock'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${statusFilter === s ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 px-3 font-medium">Product</th>
              <th className="py-2 px-3 font-medium">SKU</th>
              <th className="py-2 px-3 font-medium text-right">Price</th>
              <th className="py-2 px-3 font-medium text-right">Stock</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium">Catalog</th>
              <th className="py-2 px-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                  No products match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={p.image} alt="" className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate max-w-xs">{p.name}</p>
                        <p className="text-[13px] text-slate-400 truncate">{p.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-600">{p.sku}</td>
                  <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                    {p.currency} {p.price.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    <span className={p.stock === 0 ? 'text-red-600 font-medium' : 'text-slate-700'}>{p.stock}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[13px] ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-500">{p.catalogId}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onToggleStatus(p.id)}
                        className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
                        title="Toggle status"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-emerald-700"
                        title="Open product page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATIONS MODULE
// ============================================================
function NotificationsModule({
  notifications,
  onMarkAllRead,
  onMarkRead,
  onDelete,
}: {
  notifications: WhatsAppNotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const types: NotificationType[] = ['Order', 'Payment', 'Stock', 'System', 'Message'];
  const filtered = notifications.filter((n) => typeFilter === 'All' || n.type === typeFilter);

  const typeIcon = (t: NotificationType) => {
    switch (t) {
      case 'Order': return <ShoppingBag className="w-3.5 h-3.5" />;
      case 'Payment': return <CreditCard className="w-3.5 h-3.5" />;
      case 'Stock': return <Package className="w-3.5 h-3.5" />;
      case 'System': return <Shield className="w-3.5 h-3.5" />;
      case 'Message': return <MessageCircle className="w-3.5 h-3.5" />;
    }
  };

  const typeTint = (t: NotificationType) => {
    switch (t) {
      case 'Order': return 'bg-emerald-50 text-emerald-700';
      case 'Payment': return 'bg-blue-50 text-blue-950';
      case 'Stock': return 'bg-amber-50 text-amber-700';
      case 'System': return 'bg-slate-100 text-slate-600';
      case 'Message': return 'bg-emerald-50 text-emerald-700';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="p-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
          {(['All', ...types] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${typeFilter === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark all read
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <li className="py-12 text-center text-slate-400 text-[13px]">No notifications.</li>
        ) : (
          filtered.map((n) => (
            <li key={n.id} className={`p-2.5 flex items-start gap-2 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-emerald-50/40' : ''}`}>
              <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${typeTint(n.type)}`}>
                {typeIcon(n.type)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-slate-900 truncate">{n.title}</p>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />}
                </div>
                <p className="text-[13px] text-slate-500 mt-0.5">{n.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[13px] text-slate-400 font-mono">{n.timestamp}</span>
                  {n.actionLabel && (
                    <button className="text-[13px] text-emerald-700 font-medium hover:underline">{n.actionLabel}</button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.read && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Mark read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(n.id)}
                  className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// ============================================================
// AUTOMATION MODULE
// ============================================================
function AutomationModule({
  automations,
  onToggle,
  onRunNow,
}: {
  automations: AutomationRule[];
  onToggle: (id: string) => void;
  onRunNow: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded-sm p-3 flex items-start gap-2">
        <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-slate-900">WhatsApp automation engine</p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Trigger-based messaging that runs inside your commerce workflow — from cart recovery to payment reminders.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {automations.map((a) => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-sm p-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">{a.name}</p>
                <p className="text-[13px] text-slate-500 mt-0.5">{a.description}</p>
              </div>
              <button onClick={() => onToggle(a.id)} className={`shrink-0 ${a.enabled ? 'text-emerald-600' : 'text-slate-300'}`}>
                {a.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-sm px-2 py-1 text-slate-600">
                <Zap className="w-3 h-3" />
                {a.trigger}
              </span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-sm px-2 py-1 text-emerald-700">
                <MessageCircle className="w-3 h-3" />
                {a.action}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3 text-[13px] text-slate-400 font-mono">
                <span className="inline-flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {a.executions} runs
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {a.lastRun}
                </span>
              </div>
              <button
                onClick={() => onRunNow(a.id)}
                disabled={!a.enabled}
                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
              >
                <Zap className="w-3 h-3" />
                Run now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ACCOUNT MODULE
// ============================================================
function AccountModule({
  account,
  onSave,
  onDisconnect,
  onReconnect,
}: {
  account: WhatsAppAccount;
  onSave: (a: WhatsAppAccount) => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const [draft, setDraft] = useState(account);

  useEffect(() => {
    setDraft(account);
  }, [account]);

  const statusTint =
    account.status === 'Connected'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : account.status === 'Pending'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-red-50 text-red-700 border-red-100';

  const qualityTint =
    account.qualityRating === 'High'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : account.qualityRating === 'Medium'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-red-50 text-red-700 border-red-100';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
      <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2 xl:col-span-1">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 truncate">{account.businessName}</p>
            <p className="text-[13px] text-slate-500 font-mono truncate">{account.phoneNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <div>
            <p className="text-[13px] text-slate-400">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[13px] mt-0.5 ${statusTint}`}>
              {account.status}
            </span>
          </div>
          <div>
            <p className="text-[13px] text-slate-400">Quality</p>
            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[13px] mt-0.5 ${qualityTint}`}>
              {account.qualityRating}
            </span>
          </div>
          <div>
            <p className="text-[13px] text-slate-400">Messaging limit</p>
            <p className="text-[13px] font-medium text-slate-900 mt-0.5">{account.messagingLimit}</p>
          </div>
          <div>
            <p className="text-[13px] text-slate-400">Connected</p>
            <p className="text-[13px] font-medium text-slate-900 mt-0.5">{account.connectedAt}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          {account.status === 'Connected' ? (
            <button
              onClick={onDisconnect}
              className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Disconnect account
            </button>
          ) : (
            <button
              onClick={onReconnect}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Reconnect account
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm p-3 xl:col-span-2">
        <p className="text-[13px] font-semibold text-slate-900 mb-2">API credentials & webhooks</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
          }}
          className="space-y-3 text-[13px]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Business name</label>
              <input
                type="text"
                value={draft.businessName}
                onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">WhatsApp number</label>
              <input
                type="text"
                value={draft.phoneNumber}
                onChange={(e) => setDraft({ ...draft, phoneNumber: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone number ID</label>
              <input
                type="text"
                value={draft.phoneNumberId}
                onChange={(e) => setDraft({ ...draft, phoneNumberId: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">WABA ID</label>
              <input
                type="text"
                value={draft.wabaId}
                onChange={(e) => setDraft({ ...draft, wabaId: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Access token</label>
            <input
              type="password"
              value={draft.accessToken}
              onChange={(e) => setDraft({ ...draft, accessToken: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Verify token</label>
              <input
                type="text"
                value={draft.verifyToken}
                onChange={(e) => setDraft({ ...draft, verifyToken: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Webhook URL</label>
              <input
                type="url"
                value={draft.webhookUrl}
                onChange={(e) => setDraft({ ...draft, webhookUrl: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDraft(account)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Reset
            </button>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]">
              Save account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
