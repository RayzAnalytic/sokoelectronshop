"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    BarChart3,
    FileText,
    Package,
    FolderTree,
    Tag,
    Warehouse,
    Percent,
    Star,
    ShoppingBag,
    Receipt,
    CreditCard,
    Truck,
    Users,
    UserCog,
    HelpCircle,
    Bell,
    Megaphone,
    Image as ImageIcon,
    Share2,
    MessageCircle,
    Palette,
    Settings,
    Store,
    LogOut,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
     Languages, // Visual anchor icon for localization features
  ShoppingBag as TikTokIcon 
} from "lucide-react";
import { useAdminShell } from "./AdminShellContext";

type NavItem = {
    label: string;
    href: string;
    icon: any;
    badge?: number;
    section: string;
};

export const navItems: NavItem[] = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard, section: "Main" },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3, section: "Main" },
    { label: "Reports", href: "/admin/reports", icon: FileText, section: "Main" },

    { label: "Products", href: "/admin/products", icon: Package, badge: 124, section: "Catalog" },
    { label: "Categories", href: "/admin/categories", icon: FolderTree, section: "Catalog" },
    { label: "Brands", href: "/admin/brands", icon: Tag, section: "Catalog" },
    { label: "Inventory", href: "/admin/inventory", icon: Warehouse, badge: 8, section: "Catalog" },
    { label: "Discounts", href: "/admin/discounts", icon: Percent, section: "Catalog" },
    { label: "Reviews", href: "/admin/reviews", icon: Star, badge: 5, section: "Catalog" },

    { label: "Orders", href: "/admin/orders", icon: ShoppingBag, badge: 12, section: "Sales" },
    { label: "Transactions", href: "/admin/transactions", icon: Receipt, section: "Sales" },
    { label: "Payments", href: "/admin/payments", icon: CreditCard, section: "Sales" },
    { label: "Shipping", href: "/admin/shipping", icon: Truck, section: "Sales" },

    { label: "Customers", href: "/admin/customers", icon: Users, section: "Customers" },
    { label: "Users", href: "/admin/users", icon: UserCog, section: "Customers" },
    { label: "Support", href: "/admin/support", icon: HelpCircle, section: "Customers" },
    { label: "Newsletter", href: "/admin/newsletter", icon: Bell, section: "Customers" },

    { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone, section: "Marketing" },
    { label: "Banners", href: "/admin/banners", icon: ImageIcon, section: "Marketing" },
    { label: "Social", href: "/admin/social", icon: Share2, section: "Marketing" },
    { label: "Tiktok", href: "/admin/tiktok", icon: ShoppingBag, section: "Marketing" },
    { label: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle, badge: 4, section: "Marketing" },

    { label: "Pages", href: "/admin/pages", icon: FileText, section: "Content" },
    { label: "Blog", href: "/admin/blog", icon: FileText, section: "Content" },

    { label: "Appearance", href: "/admin/appearance", icon: Palette, section: "System" },
    { label: "Settings", href: "/admin/settings", icon: Settings, section: "System" },
     { label: "Localization", href: "/admin/localization", icon: Languages, section: "System" },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const activePath = pathname || "/admin";
    const { collapsed, toggle } = useAdminShell();

    const grouped = navItems.reduce((acc, item) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
    }, {} as Record<string, NavItem[]>);

    const sectionOrder = ["Main", "Catalog", "Sales", "Customers", "Marketing", "Content", "System"];

    const isItemActive = (href: string) => {
        if (href === "/dashboard") return activePath === "/dashboard";
        return activePath === href || activePath.startsWith(href + "/");
    };

    return (
        <aside
            className={`h-screen sticky top-0 bg-blue-950 flex flex-col justify-between text-blue-100 select-none transition-[width] duration-200 ease-in-out ${
                collapsed ? "w-16" : "w-60"
            }`}
        >
            <div className="flex flex-col flex-1 min-h-0">
                {/* Branding + collapse toggle */}
                <div className="h-14 px-3 border-b border-blue-700 flex items-center justify-between shrink-0">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2.5 font-semibold text-white text-[13px] hover:opacity-90 transition-opacity min-w-0"
                    >
                        <div className="h-7 w-7 rounded bg-white text-blue-800 flex items-center justify-center shadow-sm shrink-0">
                            <Store className="h-4 w-4" />
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col min-w-0">
                                <span className="leading-none text-[13px] font-semibold truncate">StoreAdmin</span>
                                <span className="text-[13px] text-blue-200 font-normal mt-0.5">v1.0.0</span>
                            </div>
                        )}
                    </Link>

                    {!collapsed && (
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label="Collapse sidebar"
                            className="h-7 w-7 rounded-md hover:bg-blue-700 flex items-center justify-center text-blue-200 hover:text-white transition-colors shrink-0"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {collapsed && (
                    <div className="px-2 pt-2 shrink-0">
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label="Expand sidebar"
                            className="w-full h-8 rounded-md hover:bg-blue-700 flex items-center justify-center text-blue-200 hover:text-white transition-colors"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
                    {sectionOrder.map((sectionName) => (
                        <div key={sectionName}>
                            {!collapsed && (
                                <div className="px-2 mb-1 text-[13px] font-semibold text-blue-300 uppercase tracking-wider">
                                    {sectionName}
                                </div>
                            )}

                            {collapsed && sectionName !== "Main" && (
                                <div className="mx-2 mb-2 border-t border-blue-700" />
                            )}

                            <div className="space-y-1">
                                {grouped[sectionName]?.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = isItemActive(item.href);

                                    const linkContent = (
                                        <Link
                                            href={item.href}
                                            className={`group relative flex items-center ${
                                                collapsed ? "justify-center" : "justify-between"
                                            } px-2 py-2 rounded-md text-[13px] font-medium transition-colors ${
                                                isActive
                                                    ? "bg-white text-blue-800"
                                                    : "text-blue-100 hover:bg-blue-700 hover:text-white"
                                            }`}
                                        >
                                            <div className={`flex items-center gap-2 min-w-0 ${collapsed ? "justify-center" : ""}`}>
                                                <Icon
                                                    className={`h-4 w-4 shrink-0 ${
                                                        isActive
                                                            ? "text-blue-800"
                                                            : "text-blue-200 group-hover:text-white"
                                                    }`}
                                                />
                                                {!collapsed && <span className="truncate">{item.label}</span>}
                                            </div>

                                            {!collapsed && item.badge !== undefined && (
                                                <span
                                                    className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold leading-none ${
                                                        isActive
                                                            ? "bg-blue-100 text-blue-800"
                                                            : "bg-blue-700 text-blue-100 group-hover:bg-blue-600 group-hover:text-white"
                                                    }`}
                                                >
                                                    {item.badge}
                                                </span>
                                            )}

                                            {collapsed && item.badge !== undefined && (
                                                <span
                                                    className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                                                        isActive ? "bg-blue-800" : "bg-white"
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
                                                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded-md bg-slate-900 text-white px-2 py-1 text-[13px] font-medium opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg"
                                            >
                                                {item.label}
                                                {item.badge !== undefined && (
                                                    <span className="ml-2 text-slate-400">{item.badge}</span>
                                                )}
                                            </span>
                                        </div>
                                    ) : (
                                        <React.Fragment key={item.href}>{linkContent}</React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            {/* Bottom: account + logout */}
            <div className="p-2 border-t border-blue-700 shrink-0 space-y-1">
                {collapsed ? (
                    <>
                        <button
                            type="button"
                            className="w-full flex items-center justify-center p-2 rounded-md hover:bg-blue-700 transition-colors"
                            aria-label="Account"
                        >
                            <div className="h-7 w-7 rounded-full bg-white text-blue-800 flex items-center justify-center text-[13px] font-semibold">
                                AD
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => console.log("Logging out...")}
                            className="w-full flex items-center justify-center p-2 rounded-md text-blue-200 hover:bg-blue-700 hover:text-white transition-colors"
                            aria-label="Logout"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-blue-700 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="h-7 w-7 rounded-full bg-white text-blue-800 flex items-center justify-center text-[13px] font-semibold shrink-0">
                                    AD
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] font-medium text-white truncate">Alex Doe</span>
                                    <span className="text-[13px] text-blue-200 truncate">alex@admin.com</span>
                                </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-blue-200 group-hover:text-white shrink-0" />
                        </div>

                        <button
                            type="button"
                            onClick={() => console.log("Logging out...")}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium text-blue-200 hover:bg-blue-700 hover:text-white transition-colors"
                        >
                            <LogOut className="h-4 w-4 shrink-0" />
                            <span>Logout</span>
                        </button>
                    </>
                )}
            </div>
        </aside>
    );
}