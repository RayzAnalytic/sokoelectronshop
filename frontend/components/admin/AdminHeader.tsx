"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader2,
} from "lucide-react";

import { useAdminShell } from "./AdminShellContext";
import { adminApi } from "@/lib/admin-api";
import AddProductModal from "./AddProductModal";

// ============================================================
// TYPES
// ============================================================

interface SearchResult {
  id: string;
  label: string;
  type: "Product" | "Order" | "Customer" | "Transaction";
  hint: string;
  href: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  kind: "order" | "stock" | "customer" | "payment";
  href?: string;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  initials: string;
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Debounced global search across products, orders, customers,
 * and transactions. Fires four parallel requests once the query
 * has settled for 250 ms. Each request is individually caught so
 * one failing endpoint doesn't blank the dropdown.
 */
function useGlobalSearch(query: string, enabled: boolean): {
  results: SearchResult[];
  loading: boolean;
} {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const [products, orders, customers, transactions] = await Promise.all([
          adminApi.products.list(ac.signal).catch(() => []),
          adminApi.orders.list({ search: q }, ac.signal).catch(() => ({ results: [] })),
          adminApi.customers.list({ search: q }, ac.signal).catch(() => ({ results: [] })),
          adminApi.transactions.list({ q }, ac.signal).catch(() => []),
        ]);

        if (ac.signal.aborted) return;

        const lower = q.toLowerCase();

        const productHits: SearchResult[] = (Array.isArray(products) ? products : [])
          .filter(
            (p) =>
              p.name.toLowerCase().includes(lower) ||
              p.slug.toLowerCase().includes(lower),
          )
          .slice(0, 4)
          .map((p) => ({
            id: `p-${p.id}`,
            label: p.name,
            type: "Product" as const,
            hint: `${p.brand?.name ?? ""} · KES ${p.price}`,
            href: `/admin/products/${p.id}`,
          }));

        const orderHits: SearchResult[] = (orders.results ?? [])
          .slice(0, 4)
          .map((o) => ({
            id: `o-${o.id}`,
            label: o.reference,
            type: "Order" as const,
            hint: `${o.customer_name} · ${o.total} · ${o.status}`,
            href: `/admin/orders/${o.reference}`,
          }));

        const customerHits: SearchResult[] = (customers.results ?? [])
          .slice(0, 4)
          .map((c) => ({
            id: `c-${c.id}`,
            label: c.name,
            type: "Customer" as const,
            hint: `${c.email} · ${c.ordersCount} orders`,
            href: `/admin/customers/${c.id}`,
          }));

        const txnHits: SearchResult[] = (Array.isArray(transactions) ? transactions : [])
          .filter(
            (t) =>
              t.ref.toLowerCase().includes(lower) ||
              t.orderNumber.toLowerCase().includes(lower),
          )
          .slice(0, 3)
          .map((t) => ({
            id: `t-${t.id}`,
            label: t.ref,
            type: "Transaction" as const,
            hint: `${t.method} · ${t.amount} · ${t.status}`,
            href: `/admin/transactions/${t.id}`,
          }));

        setResults([
          ...productHits,
          ...orderHits,
          ...customerHits,
          ...txnHits,
        ]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query, enabled]);

  return { results, loading };
}

/**
 * Aggregates real notifications from pending orders, low-stock
 * inventory, and pending reviews. Polls every 60 s while the tab
 * is visible.
 */
function useNotifications(): {
  items: NotificationItem[];
  unreadCount: number;
  markAllRead: () => void;
  markOneRead: (id: string) => void;
  remove: (id: string) => void;
} {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (document.hidden) return;

      const [ordersRes, inventory, reviews] = await Promise.all([
        adminApi.orders.list({ tab: "pending" }).catch(() => ({ results: [] })),
        adminApi.inventory.list().catch(() => []),
        adminApi.reviews.stats().catch(() => null),
      ]);

      if (cancelled) return;

      const next: NotificationItem[] = [];

      // Pending orders → one notification per order (top 5)
      (ordersRes.results ?? []).slice(0, 5).forEach((o) => {
        next.push({
          id: `order-${o.id}`,
          title: "New order pending",
          message: `${o.reference} · ${o.customer_name} · ${o.total}`,
          time: new Date(o.date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          read: false,
          kind: "order",
          href: `/admin/orders/${o.reference}`,
        });
      });

      // Low-stock inventory → aggregate into one line
      const lowStock = Array.isArray(inventory)
        ? inventory.filter((i) => i.status === "Low Stock" || i.status === "Out of Stock")
        : [];
      if (lowStock.length > 0) {
        next.push({
          id: "stock-summary",
          title: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} low on stock`,
          message: lowStock
            .slice(0, 3)
            .map((i) => i.name)
            .join(", ") + (lowStock.length > 3 ? `, +${lowStock.length - 3} more` : ""),
          time: "now",
          read: false,
          kind: "stock",
          href: "/admin/inventory",
        });
      }

      // Pending reviews
      if (reviews && reviews.pending > 0) {
        next.push({
          id: "reviews-pending",
          title: `${reviews.pending} review${reviews.pending === 1 ? "" : "s"} awaiting moderation`,
          message: "Open the Reviews page to approve or reject.",
          time: "now",
          read: false,
          kind: "customer",
          href: "/admin/reviews",
        });
      }

      setItems(next);
    };

    load();
    const interval = setInterval(load, 60_000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const visible = useMemo(
    () => items.filter((i) => !dismissed.has(i.id)),
    [items, dismissed],
  );

  return {
    items: visible,
    unreadCount: visible.filter((i) => !i.read).length,
    markAllRead: () =>
      setItems((prev) => prev.map((i) => ({ ...i, read: true }))),
    markOneRead: (id) =>
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i))),
    remove: (id) => setDismissed((prev) => new Set(prev).add(id)),
  };
}

/**
 * Reads the authenticated user from the session. Same endpoint the
 * sidebar uses, so the two stay in sync.
 */
function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({
    id: "",
    name: "—",
    email: "",
    initials: "—",
  });

  useEffect(() => {
    const ac = new AbortController();

    fetch("/api/v1/auth/me/", { credentials: "include", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (ac.signal.aborted || !data) return;
        const name: string = data.name || data.full_name || data.username || "—";
        const email: string = data.email || "";
        const initials =
          name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w: string) => w[0]?.toUpperCase() ?? "")
            .join("") || "—";
        setUser({ id: String(data.id ?? ""), name, email, initials });
      })
      .catch(() => {
        /* non-fatal */
      });

    return () => ac.abort();
  }, []);

  return user;
}

/**
 * Persists the theme to localStorage and toggles a `dark` class on
 * <html>. Tailwind's darkMode: 'class' strategy reads from there.
 * If your project uses a different strategy, adjust the class name.
 */
function useTheme(): { theme: "light" | "dark"; toggle: () => void } {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("admin-theme");
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = () => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      window.localStorage.setItem("admin-theme", next);
      return next;
    });
  };

  return { theme, toggle };
}

// ============================================================
// COMPONENT
// ============================================================

export default function AdminHeader() {
  const { collapsed, toggle } = useAdminShell();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const { results: searchResults, loading: searchLoading } = useGlobalSearch(
    searchQuery,
    searchOpen,
  );

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const {
    items: notifications,
    unreadCount,
    markAllRead,
    markOneRead,
    remove: removeNotification,
  } = useNotifications();

  // Profile
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const user = useCurrentUser();

  // Theme
  const { theme, toggle: toggleTheme } = useTheme();

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

  // ── ⌘K / Ctrl+K focuses search; Esc closes everything ──
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

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout/", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken":
            document.cookie
              .split("; ")
              .find((c) => c.startsWith("csrftoken="))
              ?.split("=")[1] ?? "",
        },
      });
    } catch {
      /* proceed to redirect anyway */
    }
    router.push("/auth/login");
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
          {searchOpen && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-sm shadow-lg z-50 max-h-[420px] overflow-y-auto">
              {searchLoading ? (
                <p className="p-4 flex items-center justify-center gap-2 text-[13px] text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Searching…
                </p>
              ) : searchResults.length === 0 ? (
                <p className="p-3 text-center text-[13px] text-slate-400">
                  No matches for “{searchQuery}”
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {searchResults.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={r.href}
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
                      </Link>
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
                  <Link
                    href="/admin/orders?tab=pending"
                    onClick={() => setNotifOpen(false)}
                    className="block text-center text-[13px] font-medium text-blue-950 hover:underline"
                  >
                    View pending orders
                  </Link>
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
                {user.initials}
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
                    {user.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{user.name}</p>
                    <p className="text-[13px] text-slate-500 truncate">{user.email || "—"}</p>
                  </div>
                </div>

                <ul className="py-1">
                  <li>
                    <Link
                      href="/admin/users"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      My profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin/settings?tab=general"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      Account settings
                    </Link>
                  </li>
                </ul>

                <div className="border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      handleLogout();
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