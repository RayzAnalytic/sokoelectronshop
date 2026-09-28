"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Plus,
  PanelLeft,
  User,
  Settings,
  LogOut,
  Check,
  CheckCheck,
  Package,
  ShoppingBag,
  Users,
  CreditCard,
  X,
} from "lucide-react";
import { useAdminShell } from "./AdminShellContext";
import AddProductModal from "./AddProductModal";

// ============================================================
// MOCK DATA
// ============================================================
interface SearchResult {
  id: string;
  label: string;
  type: "Product" | "Order" | "Customer" | "Transaction";
  hint: string;
  href: string;
}

const SEARCH_INDEX: SearchResult[] = [
  { id: "p1", label: "Samsung Galaxy A55 5G", type: "Product", hint: "SKU ELEC-SAM-A55 · Stock 342", href: "/admin/products/p1" },
  { id: "p2", label: "HP Pavilion 15 Core i5", type: "Product", hint: "SKU ELEC-HP-PAV15 · Stock 88", href: "/admin/products/p2" },
  { id: "p3", label: "Sony WH-1000XM5 Headphones", type: "Product", hint: "SKU ELEC-SNY-XM5 · Out of stock", href: "/admin/products/p3" },
  { id: "o1", label: "#ORD-8942", type: "Order", hint: "Amina Mwangi · KES 9,899 · Delivered", href: "/admin/orders/o1" },
  { id: "o2", label: "#ORD-8941", type: "Order", hint: "Brian Kiprono · KES 1,499 · Processing", href: "/admin/orders/o2" },
  { id: "c1", label: "Brian Kipkorir", type: "Customer", hint: "brian@merchant.co.ke · 12 orders", href: "/admin/customers/c1" },
  { id: "c2", label: "Brenda Akinyi", type: "Customer", hint: "brenda@shop.co.ke · 9 orders", href: "/admin/customers/c2" },
  { id: "t1", label: "TXN-8842", type: "Transaction", hint: "M-Pesa · KES 9,899 · Success", href: "/admin/transactions/t1" },
  { id: "t2", label: "TXN-8841", type: "Transaction", hint: "M-Pesa · KES 1,499 · Success", href: "/admin/transactions/t2" },
];

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  kind: "order" | "stock" | "customer" | "payment";
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", title: "New order received", message: "#ORD-8942 · Amina Mwangi · KES 9,899", time: "2 mins ago", read: false, kind: "order" },
  { id: "n2", title: "M-Pesa payment received", message: "KES 31,500 for #SOKO-9921", time: "18 mins ago", read: false, kind: "payment" },
  { id: "n3", title: "Low stock alert", message: "Sony WH-1000XM5 is out of stock", time: "1 hour ago", read: false, kind: "stock" },
  { id: "n4", title: "New customer registered", message: "Faith Njeri · +254 720 998 877", time: "3 hours ago", read: true, kind: "customer" },
  { id: "n5", title: "Order shipped", message: "#ORD-8940 · Wanjiru Kamau", time: "Yesterday", read: true, kind: "order" },
];

// ============================================================
// COMPONENT
// ============================================================
export default function AdminHeader() {
  const { collapsed, toggle } = useAdminShell();
  const [addOpen, setAddOpen] = useState(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // ── Close popovers on outside click ──
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // ── Keyboard shortcut: ⌘K / Ctrl+K to focus search ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        const input = searchRef.current?.querySelector("input");
        (input as HTMLInputElement | null)?.focus();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter(
      (r) => r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  const notifIcon = (kind: NotificationItem["kind"]) => {
    switch (kind) {
      case "order": return <ShoppingBag className="w-3.5 h-3.5" />;
      case "stock": return <Package className="w-3.5 h-3.5" />;
      case "customer": return <Users className="w-3.5 h-3.5" />;
      case "payment": return <CreditCard className="w-3.5 h-3.5" />;
    }
  };

  const notifTint = (kind: NotificationItem["kind"]) => {
    switch (kind) {
      case "order": return "bg-blue-50 text-blue-950";
      case "stock": return "bg-amber-50 text-amber-700";
      case "customer": return "bg-indigo-50 text-indigo-700";
      case "payment": return "bg-emerald-50 text-emerald-700";
    }
  };

  const typeBadge = (t: SearchResult["type"]) => {
    switch (t) {
      case "Product": return "bg-blue-50 text-blue-950 border-blue-100";
      case "Order": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Customer": return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "Transaction": return "bg-purple-50 text-purple-700 border-purple-100";
    }
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 gap-3 sticky top-0 z-30">

        {/* ═══ LEFT ═══ */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shrink-0"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <span className="hidden sm:inline text-[13px] font-medium text-slate-700 truncate">
            Dashboard
          </span>
        </div>

        {/* ═══ CENTER: Search ═══ */}
        <div ref={searchRef} className="hidden md:block flex-1 max-w-md relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search products, orders, customers…"
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-16 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950 focus:border-blue-950"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-1 pointer-events-none">
              <kbd className="px-1.5 py-0.5 rounded-sm border border-slate-200 bg-slate-50 text-[13px] font-mono text-slate-500">
                ⌘
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded-sm border border-slate-200 bg-slate-50 text-[13px] font-mono text-slate-500">
                K
              </kbd>
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-400 lg:hidden"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {searchOpen && searchQuery && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-sm shadow-lg z-50 max-h-[420px] overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="p-3 text-center text-[13px] text-slate-400">
                  No matches for “{searchQuery}”
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {searchResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-start gap-2 p-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <span className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border shrink-0 ${typeBadge(r.type)}`}>
                          {r.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-900 truncate">{r.label}</p>
                          <p className="text-[13px] text-slate-500 truncate mt-0.5">{r.hint}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-100 px-2.5 py-1.5 text-[13px] text-slate-400 flex items-center justify-between bg-slate-50">
                <span>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</span>
                <span>Press Esc to close</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT ═══ */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* Add product */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white text-[13px] font-medium px-3 py-2 rounded-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add product
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className={`relative h-8 w-8 rounded-sm flex items-center justify-center transition-colors ${
                notifOpen ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-950 text-white text-[13px] font-semibold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute top-full mt-1 right-0 w-80 bg-white border border-slate-200 rounded-sm shadow-lg z-50 flex flex-col max-h-[480px]">
                <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <p className="text-[13px] font-semibold text-slate-900">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 text-[13px] font-medium text-blue-950 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm">
                        {unreadCount} new
                      </span>
                    )}
                  </p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-12 text-center text-[13px] text-slate-400">
                      You're all caught up.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className={`p-2.5 flex items-start gap-2 hover:bg-slate-50 transition-colors ${
                            !n.read ? "bg-blue-50/40" : ""
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${notifTint(n.kind)}`}>
                            {notifIcon(n.kind)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-medium text-slate-900 truncate">{n.title}</p>
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-950 shrink-0" />}
                            </div>
                            <p className="text-[13px] text-slate-500 mt-0.5 truncate">{n.message}</p>
                            <p className="text-[13px] text-slate-400 font-mono mt-0.5">{n.time}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {!n.read && (
                              <button
                                type="button"
                                onClick={() => markOneRead(n.id)}
                                className="p-1 rounded-sm hover:bg-slate-200 text-slate-400"
                                title="Mark read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeNotification(n.id)}
                              className="p-1 rounded-sm hover:bg-red-50 text-slate-400 hover:text-red-600"
                              title="Dismiss"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="px-3 py-2 border-t border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="w-full text-[13px] font-medium text-blue-950 hover:underline"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="hidden sm:flex h-8 w-8 rounded-sm hover:bg-slate-100 items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* Profile menu */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className={`flex items-center gap-2 pl-1.5 pr-1.5 py-1 rounded-sm transition-colors ${
                profileOpen ? "bg-slate-100" : "hover:bg-slate-100"
              }`}
            >
              <div className="h-7 w-7 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold">
                AD
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  profileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {profileOpen && (
              <div className="absolute top-full mt-1 right-0 w-64 bg-white border border-slate-200 rounded-sm shadow-lg z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
                    AD
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">Alex Doe</p>
                    <p className="text-[13px] text-slate-500 truncate">alex@admin.com</p>
                  </div>
                </div>

                <ul className="py-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        // Navigate to profile page in real app
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      My profile
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        // Navigate to settings
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      Account settings
                    </button>
                  </li>
                </ul>

                <div className="border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      // Perform logout
                      // eslint-disable-next-line no-console
                      console.log("Logging out...");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Add product modal (unchanged) */}
      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data) => {
          // eslint-disable-next-line no-console
          console.log("New product:", data);
          alert(`Saved "${data.name}"`);
        }}
      />
    </>
  );
}