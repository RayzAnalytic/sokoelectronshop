"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  X,
  Megaphone,
  Menu,
  PanelLeftOpen,
  GalleryHorizontal,
} from "lucide-react";
import { HiReceiptRefund, HiArrowUpRight } from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa";
import { HiCreditCard } from "react-icons/hi2";
import { useAdminShell } from "./AdminShellContext";
import { adminApi } from "@/lib/admin-api";
import { api } from "@/lib/api";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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

export const navItems: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, section: "Main" },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, section: "Main" },
  { label: "Reports", href: "/admin/reports", icon: FileText, section: "Main" },

  { label: "Products", href: "/admin/products", icon: Package, badgeKey: "products", section: "Catalog" },
  { label: "Categories", href: "/admin/categories", icon: FolderTree, section: "Catalog" },
  { label: "Brands", href: "/admin/brands", icon: Tag, section: "Catalog" },
  { label: "Inventory", href: "/admin/inventory", icon: Warehouse, badgeKey: "inventory_low", section: "Catalog" },
  { label: "Suppliers", href: "/admin/suppliers", icon: Building2, section: "Catalog" },
  { label: "Discounts", href: "/admin/discounts", icon: Percent, section: "Catalog" },
  { label: "Reviews", href: "/admin/reviews", icon: Star, badgeKey: "reviews_pending", section: "Catalog" },

  { label: "Orders", href: "/admin/orders", icon: ShoppingBag, badgeKey: "orders_pending", section: "Sales" },
  { label: "Transactions", href: "/admin/transactions", icon: Receipt, section: "Sales" },
  { label: "Payments", href: "/admin/payments", icon: HiCreditCard, section: "Sales" },
  { label: "Shipping", href: "/admin/shipping", icon: Truck, section: "Sales" },
  { label: "Returns & Refunds", href: "/admin/returnsrefunds", icon: HiReceiptRefund, section: "Sales" },

  { label: "Customers", href: "/admin/customers", icon: Users, section: "Customers" },
  { label: "Users", href: "/admin/users", icon: UserCog, section: "Customers" },
  { label: "Newsletter", href: "/admin/newsletter", icon: Bell, section: "Customers" },

  { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone, section: "Marketing" },
  { label: "Social", href: "/admin/social", icon: Share2, section: "Marketing" },
  { label: "TikTok Business", href: "/admin/tiktok", icon: ShoppingBag, section: "Marketing" },
  { label: "WhatsApp", href: "/admin/whatsapp", icon: FaWhatsapp, badgeKey: "whatsapp_unread", section: "Marketing" },
  { label: "Banner", href: "/admin/banner", icon: HiArrowUpRight, section: "Marketing" },
  { label: "Posters", href: "/admin/posters", icon: GalleryHorizontal, section: "Marketing" },

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

function useCurrentUser(): CurrentUser {
  const [user, setUser] = React.useState<CurrentUser>({
    id: "",
    name: "—",
    email: "",
    initials: "—",
  });

  React.useEffect(() => {
    let cancelled = false;

    api
      .me()
      .then((data) => {
        if (cancelled || !data) return;

        const composed =
          [data.first_name, data.last_name].filter(Boolean).join(" ") || "";

        const name: string =
          data.name ||
          (data as any).full_name ||
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
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activePath = pathname || "/admin";
  const { collapsed, toggle } = useAdminShell();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const badges = useNavBadges();
  const user = useCurrentUser();

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
      await api.logout();
    } catch {
    }
    router.push("/auth/login");
  }, [router]);

  const sidebarContent = (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        <div
          className={
            collapsed
              ? "h-14 px-2 border-b border-[#0F2340] flex items-center justify-center shrink-0"
              : "h-14 px-3 border-b border-[#0F2340] flex items-center justify-between shrink-0"
          }
        >
          {collapsed ? (
            <button
              type="button"
              onClick={toggle}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="h-10 w-full rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <PanelLeftOpen className="h-7 w-7" />
            </button>
          ) : (
            <>
              <Link
                href="/admin"
                className="flex items-center gap-1 font-semibold text-white text-[13px] hover:opacity-90 transition-opacity min-w-0"
              >
                <div className="text-white flex items-center justify-center shrink-0">
                  <img
                    src="/logo.jpeg"
                    alt="Racetech Hub"
                    className="h-10 w-10 object-contain"
                  />
                </div>

                <span className="text-[13px] font-semibold truncate">
                  Racetech Admin
                </span>
              </Link>

              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="hidden lg:flex h-7 w-7 rounded hover:bg-white/10 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close sidebar"
                className="lg:hidden h-7 w-7 rounded hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {!collapsed && (
          <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-2 overscroll-contain scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTION_ORDER.map((sectionName) => {
              const items = grouped[sectionName];
              if (!items || items.length === 0) return null;

              return (
                <div key={sectionName}>
                  <div className="px-2 mb-1 text-[13px] font-medium text-white/50">
                    {sectionName}
                  </div>

                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isItemActive(item.href);
                      const badge = resolveBadge(item);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`group flex items-center justify-between px-3 py-2 rounded text-[13px] font-medium transition-colors ${isActive
                            ? "bg-white text-[#1A2E5A]"
                            : "text-white/85 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${isActive
                                ? "text-[#1A2E5A]"
                                : "text-white/60 group-hover:text-white"
                                }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {badge !== undefined && (
                            <span
                              className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold leading-none ${isActive
                                ? "bg-[#D71921] text-white"
                                : "bg-[#D71921] text-white group-hover:bg-[#B01219]"
                                }`}
                            >
                              {badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {!collapsed && (
        <div className="p-2 border-t border-[#0F2340] shrink-0 space-y-1">
          <Link
            href="/admin/settings?tab=security#password"
            className="flex items-center justify-between px-3 py-2 rounded hover:bg-white/10 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-white text-[#1A2E5A] flex items-center justify-center text-[13px] font-semibold shrink-0">
                {user.initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-medium text-white truncate">
                  {user.name}
                </span>
                <span className="text-[13px] text-white/65 truncate">
                  {user.email || "—"}
                </span>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-white/50 group-hover:text-white shrink-0" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[13px] font-medium text-white/65 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
        className="lg:hidden fixed top-3 left-3 z-40 h-10 w-10 rounded bg-white border border-slate-200 text-[#1A2E5A] flex items-center justify-center hover:bg-slate-50 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-screen w-60 bg-[#1A2E5A] border-r border-[#0F2340] flex flex-col justify-between text-white/85 select-none transform transition-transform duration-200 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {sidebarContent}
      </aside>

      <aside
        className={`hidden lg:flex h-screen sticky top-0 bg-[#1A2E5A] border-r border-[#0F2340] flex-col justify-between text-white/85 select-none transition-[width] duration-200 ease-in-out ${collapsed ? "w-16" : "w-60"
          }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}