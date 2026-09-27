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
  AlertCircle,
} from 'lucide-react';

// --- TYPES ---
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

const STATUS_TABS = ['All', 'New', 'Replied', 'Converted', 'Lost'] as const;

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

  const [waNumber, setWaNumber] = useState('+254 700 000 000');
  const [cartTemplate, setCartTemplate] = useState(
    'Hello! I would like to place an order for the following cart items:\n{items}\nTotal: KES {total}\nCustomer Name: {customer_name}'
  );
  const [inquiryTemplate, setInquiryTemplate] = useState(
    'Hello, I have a product inquiry regarding:'
  );

  const [broadcastAudience, setBroadcastAudience] = useState('All Customers');
  const [broadcastMessage, setBroadcastMessage] = useState(
    '🔥 Weekend Flash Sale! Enjoy up to 20% off on all electronics. Tap to shop now: https://example.com'
  );
  const [broadcastSchedule, setBroadcastSchedule] = useState('Now');

  const anyModalOpen =
    isSettingsOpen || isBroadcastOpen || isCreateOrderOpen || activeOrder !== null;

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
    const totalRevenue = orders
      .filter((o) => o.status === 'Converted')
      .reduce((sum, o) => sum + o.total, 0);
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
              WhatsApp orders
              <span className="inline-flex items-center gap-1 text-[13px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-sm">
                <MessageSquare className="w-3 h-3" />
                Cart button feed
              </span>
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Orders and chats initiated via the storefront WhatsApp checkout button
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

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard
            label="Total inquiries"
            value={stats.todayCount.toString()}
            icon={<MessageSquare className="w-4 h-4" />}
            tint="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Converted"
            value={stats.convertedCount.toString()}
            icon={<CheckCircle2 className="w-4 h-4" />}
            tint="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Pending reply"
            value={stats.pendingCount.toString()}
            icon={<Clock className="w-4 h-4" />}
            tint="bg-amber-50 text-amber-700"
          />
          <StatCard
            label="WhatsApp revenue"
            value={`KES ${stats.totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="w-4 h-4" />}
            tint="bg-blue-50 text-blue-950"
            mono
          />
        </div>

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
            {STATUS_TABS.map((status) => {
              const count =
                status === 'All' ? orders.length : orders.filter((o) => o.status === status).length;
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${
                    isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  {status}
                  <span
                    className={`px-1.5 rounded-sm text-[13px] ${
                      isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
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

        {/* BULK */}
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

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-[13px] font-medium text-slate-700">
              Cart inquiries · {filteredOrders.length}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-950" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
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
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleRow(order.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-950" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
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
                              <img
                                src={firstItem.image}
                                alt=""
                                className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-slate-700 truncate max-w-xs">
                                {firstItem
                                  ? `${firstItem.quantity}× ${firstItem.name}`
                                  : 'No items'}
                              </p>
                              {order.items.length > 1 && (
                                <p className="text-[13px] text-slate-400">
                                  +{order.items.length - 1} more item
                                  {order.items.length - 1 > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                          KES {order.total.toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400 font-mono">
                          {order.lastMessageTime}
                        </td>
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
      </main>

      {/* DETAIL DRAWER */}
      {activeOrder && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setActiveOrder(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-xl h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900 truncate">
                    {activeOrder.customerName}
                  </p>
                  <p className="text-[13px] text-slate-500 font-mono truncate">
                    {activeOrder.customerPhone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              {/* Raw message */}
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">
                  Original WhatsApp cart message
                </p>
                <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2 font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {activeOrder.rawMessage}
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">
                  Cart breakdown · {activeOrder.items.length}
                </p>
                <ul className="border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
                  {activeOrder.items.map((item) => (
                    <li key={item.id} className="p-2 flex items-center gap-2 bg-white">
                      <img
                        src={item.image}
                        alt=""
                        className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-[13px] text-slate-500">
                          {item.quantity} × KES {item.price.toLocaleString()}
                        </p>
                      </div>
                      <span className="font-mono font-medium text-slate-900 shrink-0">
                        KES {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </li>
                  ))}
                  <li className="p-2 bg-slate-50 flex items-center justify-between font-medium">
                    <span>Total</span>
                    <span className="font-mono text-emerald-700">
                      KES {activeOrder.total.toLocaleString()}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Status change */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[13px] font-medium text-slate-500 mb-1">Update status</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['New', 'Replied', 'Converted', 'Lost'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => updateStatus(activeOrder.id, st)}
                      className={`py-2 rounded-sm text-[13px] font-medium transition ${
                        activeOrder.status === st
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Internal notes</p>
                <textarea
                  rows={3}
                  defaultValue={activeOrder.internalNotes || ''}
                  placeholder="Add notes about the customer, delivery, or payment…"
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              {/* Create order */}
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
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsCreateOrderOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Confirm & generate formal order
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Convert WhatsApp inquiry into an active fulfillment order
                </p>
              </div>
              <button
                onClick={() => setIsCreateOrderOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Customer</p>
                <p className="font-medium text-slate-900">
                  {activeOrder.customerName} · {activeOrder.customerPhone}
                </p>
              </div>

              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">
                  Pre-filled cart items
                </p>
                <ul className="border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
                  {activeOrder.items.map((i) => (
                    <li key={i.id} className="p-2 flex items-center gap-2">
                      <img
                        src={i.image}
                        alt=""
                        className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{i.name}</p>
                        <p className="text-[13px] text-slate-500">Qty {i.quantity}</p>
                      </div>
                      <span className="font-mono font-medium text-slate-900">
                        KES {(i.price * i.quantity).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2 flex items-center justify-between">
                <span className="font-medium text-emerald-900">Total payable</span>
                <span className="font-mono font-medium text-emerald-700">
                  KES {activeOrder.total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsCreateOrderOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmCreateOrder}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Confirm & create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  WhatsApp integration settings
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Business number and message templates
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={saveSettings}
              className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  WhatsApp business number
                </label>
                <input
                  type="text"
                  required
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Cart message template
                </label>
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
                <label className="block font-medium text-slate-700 mb-1">
                  Product inquiry template
                </label>
                <input
                  type="text"
                  value={inquiryTemplate}
                  onChange={(e) => setInquiryTemplate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Save settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BROADCAST MODAL */}
      {isBroadcastOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsBroadcastOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Broadcast WhatsApp campaign
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Send a message to a selected audience segment
                </p>
              </div>
              <button
                onClick={() => setIsBroadcastOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={sendBroadcast}
              className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Target audience
                </label>
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
                  <p className="text-[13px] text-emerald-700 font-medium uppercase">
                    SokoFlow official business
                  </p>
                  <p className="text-[13px] text-slate-800 whitespace-pre-wrap">
                    {broadcastMessage}
                  </p>
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
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
                >
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

/* ---------- Stat card ---------- */
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
        <p
          className={`text-[15px] font-bold text-slate-900 mt-0.5 truncate ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </p>
      </div>
      <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
        {icon}
      </span>
    </div>
  );
}
