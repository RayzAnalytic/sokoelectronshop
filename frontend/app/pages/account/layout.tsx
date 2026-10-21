"use client";

import { FaStar } from "react-icons/fa";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Heart,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Loader2,
} from "lucide-react";

import { api, type Me } from "@/lib/api";

const navItems = [
  { label: "Overview", href: "/pages/account", icon: LayoutDashboard },
  { label: "My Orders", href: "/pages/account/orders", icon: Package },
  { label: "Wishlist", href: "/pages/account/wishlist", icon: Heart },
  { label: "Addresses", href: "/pages/account/addresses", icon: MapPin },
  { label: "Reviews", href: "/pages/account/reviews", icon: FaStar },
  { label: "Notifications", href: "/pages/account/notifications", icon: Bell },
  { label: "Settings", href: "/pages/account/settings", icon: Settings },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;

        if (!me) {
          const next = encodeURIComponent(pathname || "/pages/account");
          router.replace(`/auth/login?next=${next}`);
          return;
        }

        if (me.role === "OWNER" || me.role === "STAFF") {
          router.replace("/admin");
          return;
        }

        setUser(me);
      } catch {
        if (!cancelled) {
          const next = encodeURIComponent(pathname || "/pages/account");
          router.replace(`/auth/login?next=${next}`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const load = async () => {
      try {
        const { unread } = await api.notificationsUnreadCount();
        if (!cancelled) setUnreadCount(unread);
      } catch {
        /* ignore */
      }
    };

    load();
    const id = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user, pathname]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await api.logout();
    } catch {
      /* ignore */
    } finally {
      setSigningOut(false);
      router.replace("/");
    }
  };

  const initials = (() => {
    if (!user) return "?";
    const f = (user.first_name || "").trim();
    const l = (user.last_name || "").trim();
    if (f || l) {
      return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
    }
    return (user.email?.[0] ?? "?").toUpperCase();
  })();

  const displayName = (() => {
    if (!user) return "Account";
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return name || user.email;
  })();

  /* Email with the middle characters hidden: j•••••n@example.com */
  const maskedEmail = (() => {
    const email = user?.email;
    if (!email) return "";
    const [local, domain] = email.split("@");
    if (!domain) return "••••••";
    if (local.length <= 2) return `${local.slice(0, 1)}•••@${domain}`;
    const dots = "•".repeat(Math.min(local.length - 2, 5));
    return `${local.slice(0, 1)}${dots}${local.slice(-1)}@${domain}`;
  })();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-900 font-sans">
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your account…
        </div>
      </div>
    );
  }

  if (!user) return null;

  /* Shared sidebar markup: desktop rail + mobile drawer */
  const sidebarContent = (
    <>
      {/* Brand row */}
      <div className="h-14 sm:h-16 shrink-0 flex items-center gap-2 px-3 border-b border-slate-200">
        <Link href="/" className="flex items-center gap-1 min-w-0 group">
          {/* Logo Container */}
          <div className="relative w-8 h-8 shrink-0 overflow-hidden rounded-sm">
            <img
              src="/logo.jpeg"
              alt="Store Logo"
              sizes="36px"
              className="object-contain"
            />
          </div>

          {/* Store Text */}
          <span className="text-base font-bold text-slate-900 tracking-tight truncate group-hover:text-blue-900 transition-colors">
            RazeStore
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden ml-auto p-2 rounded-md text-slate-500 hover:bg-slate-50"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/pages/account"
              ? pathname === "/pages/account"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge =
            item.href === "/pages/account/notifications" && unreadCount > 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-950 font-semibold border-l-2 border-blue-950"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-blue-950" : "text-slate-500"}`}
                />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span
                    className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-950 text-white text-[10px] font-semibold flex items-center justify-center"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom block: profile + sign out */}
      <div className="shrink-0 border-t border-slate-200">
        <div className="p-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-blue-950 text-white flex items-center justify-center font-bold text-sm">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {displayName}
              </p>
              <p
                className="text-[11px] text-slate-500 truncate"
                title="Email hidden for privacy"
              >
                {maskedEmail}
              </p>
            </div>
          </div>
        </div>

        <div className="p-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Desktop sidebar — full screen height */}
      <aside className="hidden lg:flex w-64 shrink-0 h-full flex-col bg-white border-r border-slate-200">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-64 max-w-[80%] bg-white border-r border-slate-200 flex flex-col shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Right column: header + content */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Minimal top bar */}
        <header className="shrink-0 h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-md text-slate-700 hover:bg-slate-50"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <span className="lg:hidden text-sm font-bold text-slate-900">
            RazeStore
          </span>

          <span className="hidden lg:block text-sm font-semibold text-slate-800">
            My Account
          </span>

          <div className="ml-auto flex items-center">
            <Link
              href="/pages/account/notifications"
              aria-label="Notifications"
              className="relative p-2 rounded-md text-slate-600 hover:text-blue-950 hover:bg-slate-50 transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-950 text-white text-[9px] font-semibold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-1">{children}</main>
      </div>
    </div>
  );
}
