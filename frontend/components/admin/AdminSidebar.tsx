"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { TbSettingsAutomation } from "react-icons/tb";
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Package,
  FolderTree,
  Tag,
  Warehouse,
  Building2,
  Percent,
  Star,
  ShoppingBag,
  Receipt,
  Truck,
  Users,
  UserCog,
  Bell,
  Share2,
  Settings,
  Store,
  LogOut,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Menu,
} from "lucide-react";
import { HiReceiptRefund, HiArrowUpRight } from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa";

import { useAdminShell } from "./AdminShellContext";
import { adminApi } from "@/lib/admin-api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Badge key — resolved at render time from the live counts map. */
  badgeKey?: keyof NavBadges;
  section: string;
};

export interface NavBadges {
  products: number;
  inventory_low: number;
  reviews_pending: number;
  orders_pending: number;
  whatsapp_unread: number;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  initials: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav catalogue
// ─────────────────────────────────────────────────────────────────────────────
export const navItems: NavItem[] = [
  // Main
  { label: "Overview", href: "/admin", icon: LayoutDashboard, section: "Main" },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, section: "Main" },
  { label: "Reports", href: "/admin/reports", icon: FileText, section: "Main" },

  // Catalog
  { label: "Products", href: "/admin/products", icon: Package, badgeKey: "products", section: "Catalog" },
  { label: "Categories", href: "/admin/categories", icon: FolderTree, section: "Catalog" },
  { label: "Brands", href: "/admin/brands", icon: Tag, section: "Catalog" },
  { label: "Inventory", href: "/admin/inventory", icon: Warehouse, badgeKey: "inventory_low", section: "Catalog" },
  { label: "Suppliers", href: "/admin/suppliers", icon: Building2, section: "Catalog" },
  { label: "Discounts", href: "/admin/discounts", icon: Percent, section: "Catalog" },
  { label: "Reviews", href: "/admin/reviews", icon: Star, badgeKey: "reviews_pending", section: "Catalog" },

  // Sales
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag, badgeKey: "orders_pending", section: "Sales" },
  { label: "Transactions", href: "/admin/transactions", icon: Receipt, section: "Sales" },
  { label: "Shipping", href: "/admin/shipping", icon: Truck, section: "Sales" },
  { label: "Returns & Refunds", href: "/admin/returnsrefunds", icon: HiReceiptRefund, section: "Sales" },

  // Customers
  { label: "Customers", href: "/admin/customers", icon: Users, section: "Customers" },
  { label: "Users", href: "/admin/users", icon: UserCog, section: "Customers" },
  { label: "Newsletter", href: "/admin/newsletter", icon: Bell, section: "Customers" },

  // Marketing
  { label: "Social", href: "/admin/social", icon: Share2, section: "Marketing" },
  { label: "Social Shop", href: "/admin/tiktok", icon: ShoppingBag, section: "Marketing" },
  { label: "WhatsApp", href: "/admin/whatsapp", icon: FaWhatsapp, badgeKey: "whatsapp_unread", section: "Marketing" },
  { label: "Banner", href: "/admin/banner", icon: HiArrowUpRight, section: "Marketing" },
  { label: "AI & Automation", href: "/admin/aiatomation", icon: TbSettingsAutomation, section: "Marketing" },

  // System
  { label: "Settings", href: "/admin/settings", icon: Settings, section: "System" },
];

const SECTION_ORDER = [
  "Main",
  "Catalog",
  "Sales",
  "Customers",
  "Marketing",
  "System",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Live badge counts
//
// Pulled from the admin endpoints you already have. Each call is
// wrapped in `.catch(() => 0)` so a single broken endpoint (or an
// empty table) doesn't blank the whole sidebar — the badge just shows
// no number.
// ─────────────────────────────────────────────────────────────────────────────
function useNavBadges(): NavBadges {
  const [badges, setBadges] = React.useState<NavBadges>({
    products: 0,
    inventory_low: 0,
    reviews_pending: 0,
    orders_pending: 0,
    whatsapp_unread: 0,
  });

  React.useEffect(() => {
    const ac = new AbortController();

    (async () => {
      const [
        products,
        inventory,
        reviews,
        orderTabCounts,
        conversations,
      ] = await Promise.all([
        adminApi.products.list(ac.signal).catch(() => []),
        adminApi.inventory.list(ac.signal).catch(() => []),
        adminApi.reviews.stats(ac.signal).catch(() => null),
        adminApi.orders.tabCounts(ac.signal).catch(() => null),
        adminApi.whatsapp.inbox
          .listConversations({ tab: "unassigned" }, ac.signal)
          .catch(() => []),
      ]);

      if (ac.signal.aborted) return;

      setBadges({
        products: Array.isArray(products) ? products.length : 0,
        inventory_low: Array.isArray(inventory)
          ? inventory.filter((i) => i.status === "Low Stock").length
          : 0,
        reviews_pending: reviews?.pending ?? 0,
        orders_pending: orderTabCounts?.pending ?? 0,
        whatsapp_unread: Array.isArray(conversations) ? conversations.length : 0,
      });
    })();

    return () => ac.abort();
  }, []);

  return badges;
}

// ─────────────────────────────────────────────────────────────────────────────
// Current user
//
// Reads the authenticated user from the same session the admin pages
// use. Falls back to "—" if the call fails (never blanks the sidebar).
//
// The backend's /me/ response can come in several shapes depending on
// which serializer builds it:
//   { name }                                  ← preferred
//   { full_name }
//   { first_name, last_name }                 ← current shape
//   { username }
// All four are handled; the first non-empty wins.
// ─────────────────────────────────────────────────────────────────────────────
function useCurrentUser(): CurrentUser {
  const [user, setUser] = React.useState<CurrentUser>({
    id: "",
    name: "—",
    email: "",
    initials: "—",
  });

  React.useEffect(() => {
    const ac = new AbortController();

    fetch("/api/v1/auth/me/", { credentials: "include", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (ac.signal.aborted || !data) return;

        const composed =
          [data.first_name, data.last_name].filter(Boolean).join(" ") || "";

        const name: string =
          data.name ||
          data.full_name ||
          composed ||
          data.username ||
          "—";

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
        /* non-fatal — sidebar keeps the placeholder */
      });

    return () => ac.abort();
  }, []);

  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activePath = pathname || "/admin";
  const { collapsed, toggle } = useAdminShell();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const badges = useNavBadges();
  const user = useCurrentUser();

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile sidebar is open
  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const grouped = React.useMemo(() => {
    return navItems.reduce((acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    }, {} as Record<string, NavItem[]>);
  }, []);

  const isItemActive = (href: string) => {
    if (href === "/admin") return activePath === "/admin";
    return activePath === href || activePath.startsWith(href + "/");
  };

  const resolveBadge = (item: NavItem): number | undefined => {
    if (!item.badgeKey) return undefined;
    const count = badges[item.badgeKey];
    return count > 0 ? count : undefined;
  };

  const handleLogout = React.useCallback(async () => {
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
  }, [router]);

  const sidebarContent = (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Branding + collapse toggle */}
        <div className="h-14 px-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-semibold text-slate-900 text-[13px] hover:opacity-90 transition-opacity min-w-0"
          >
            <div className="h-7 w-7 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0">
              <Store className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="leading-none text-[13px] font-semibold truncate">
                StoreAdmin
              </span>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="hidden lg:flex h-7 w-7 rounded-sm hover:bg-slate-100 items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden h-7 w-7 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {collapsed && (
          <div className="hidden lg:block px-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={toggle}
              aria-label="Expand sidebar"
              className="w-full h-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          {SECTION_ORDER.map((sectionName) => {
            const items = grouped[sectionName];
            if (!items || items.length === 0) return null;

            return (
              <div key={sectionName}>
                {!collapsed && (
                  <div className="px-2 mb-1 text-[13px] font-medium text-slate-400">
                    {sectionName}
                  </div>
                )}

                {collapsed && sectionName !== "Main" && (
                  <div className="mx-2 mb-2 border-t border-slate-200" />
                )}

                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isItemActive(item.href);
                    const badge = resolveBadge(item);

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={`group relative flex items-center ${
                          collapsed ? "justify-center" : "justify-between"
                        } px-3 py-2 rounded-sm text-[13px] font-medium transition-colors ${
                          isActive
                            ? "bg-blue-950 text-white"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-2 min-w-0 ${
                            collapsed ? "justify-center" : ""
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isActive
                                ? "text-white"
                                : "text-slate-400 group-hover:text-slate-700"
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {!collapsed && badge !== undefined && (
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded-sm text-[11px] font-semibold leading-none ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-800"
                            }`}
                          >
                            {badge}
                          </span>
                        )}

                        {collapsed && badge !== undefined && (
                          <span
                            className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                              isActive ? "bg-white" : "bg-blue-950"
                            }`}
                          />
                        )}
                      </Link>
                    );

                    return collapsed ? (
                      <div key={item.href} className="relative group/tip">
                        {linkContent}
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded-sm bg-slate-900 text-white px-2 py-1 text-[13px] font-medium opacity-0 group-hover/tip:opacity-100 transition-opacity"
                        >
                          {item.label}
                          {badge !== undefined && (
                            <span className="ml-2 text-slate-400">{badge}</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <React.Fragment key={item.href}>{linkContent}</React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom: account + logout */}
      <div className="p-2 border-t border-slate-200 shrink-0 space-y-1">
        {collapsed ? (
          <>
            <Link
              href="/admin/settings?tab=security#password"
              className="w-full flex items-center justify-center p-2 rounded-sm hover:bg-slate-100 transition-colors"
              aria-label="Account settings"
            >
              <div className="h-7 w-7 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold">
                {user.initials}
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2 rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Link
              href="/admin/settings?tab=security#password"
              className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-slate-100 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
                  {user.initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium text-slate-900 truncate">
                    {user.name}
                  </span>
                  <span className="text-[13px] text-slate-500 truncate">
                    {user.email || "—"}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
        className="lg:hidden fixed top-3 left-3 z-40 h-10 w-10 rounded-sm bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar (off-canvas) */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-screen w-60 bg-white border-r border-slate-200 flex flex-col justify-between text-slate-700 select-none transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar (sticky) */}
      <aside
        className={`hidden lg:flex h-screen sticky top-0 bg-white border-r border-slate-200 flex-col justify-between text-slate-700 select-none transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}