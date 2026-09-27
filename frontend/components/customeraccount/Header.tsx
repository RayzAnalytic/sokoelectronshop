// components/storefront/header.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Search,
    Heart,
    ShoppingCart,
    Menu,
    X,
    ChevronDown,
    LayoutDashboard,
    Package,
    MapPin,
    Star,
    Bell,
    Settings,
    HelpCircle,
    MessageCircle,
    LogOut,
    User as UserIcon,
    Store,
    ArrowRight,
} from "lucide-react";

// Mock types & hooks (Replace with your actual auth / state providers)
interface UserProfile {
    name: string;
    email: string;
    avatarUrl?: string;
    activeOrdersCount: number;
    wishlistCount: number;
    unreadNotifications: number;
}

export default function StorefrontHeader() {
    const router = useRouter();

    // Announcement bar dismissal state
    const [showAnnouncement, setShowAnnouncement] = useState<boolean>(true);

    // Search overlay & mobile drawer states
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [recentSearches, setRecentSearches] = useState<string[]>([
        "smartphones",
        "wireless earbuds",
        "macbook pro",
    ]);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

    // User auth state (mocked for implementation — set to true to test logged-in dropdown)
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
    const [user, setUser] = useState<UserProfile>({
        name: "Isaac Mutinda",
        email: "isaac@sokoflow.co.ke",
        activeOrdersCount: 2,
        wishlistCount: 4,
        unreadNotifications: 1,
    });

    // Dropdown menu state for desktop
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

    // Load announcement dismissed state from localStorage on mount
    useEffect(() => {
        const dismissed = localStorage.getItem("sokoflow_announcement_dismissed");
        if (dismissed === "true") {
            setShowAnnouncement(false);
        }
    }, []);

    const handleDismissAnnouncement = () => {
        setShowAnnouncement(false);
        localStorage.setItem("sokoflow_announcement_dismissed", "true");
    };

    const handleSignOut = () => {
        setIsLoggedIn(false);
        setIsDropdownOpen(false);
        console.log("Signed out successfully");
        router.push("/");
    };

    // Categories for Row 3 & Mobile Menu
    const categories = [
        { name: "Phones", href: "/category/phones" },
        { name: "Laptops", href: "/category/laptops" },
        { name: "Audio", href: "/category/audio" },
        { name: "Accessories", href: "/category/accessories" },
        { name: "Gaming", href: "/category/gaming" },
        { name: "Smart Home", href: "/category/smart-home" },
        { name: "TVs", href: "/category/tvs" },
        { name: "Deals", href: "/category/deals", highlight: true },
    ];

    return (
        <header className="sticky top-0 z-50 border-b border-gray-100 bg-white">
            {/* ========================================================= */}
            {/* ROW 1 — Announcement bar (optional, dismissible)           */}
            {/* ========================================================= */}
            {showAnnouncement && (
                <div className="h-9 bg-primary text-primary-foreground text-xs flex items-center justify-between px-4 sm:px-6">
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 font-medium">
                        <span>Free delivery in Nairobi on orders above KSh 5,000 🚚</span>
                    </div>
                    <div className="flex-1 flex justify-end">
                        <button
                            type="button"
                            onClick={handleDismissAnnouncement}
                            aria-label="Dismiss announcement"
                            className="text-primary-foreground/80 hover:text-primary-foreground p-1 rounded-full transition cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* ROW 2 — Main header                                        */}
            {/* ========================================================= */}
            <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
                {/* LEFT — Logo & Mobile Menu Trigger */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen(true)}
                        aria-label="Open mobile menu"
                        className="md:hidden p-2 rounded-full hover:bg-gray-50 text-gray-800 transition cursor-pointer"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <Link href="/" className="flex items-center gap-2.5 focus:outline-hidden group">
                        <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition">
                            <Store className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-tight text-gray-900 leading-none">
                                SokoFlow
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">Storefront</span>
                        </div>
                    </Link>
                </div>

                {/* CENTER — Search bar (hidden on < md) */}
                <div className="hidden md:flex flex-1 max-w-2xl mx-auto">
                    <div
                        onClick={() => setIsSearchOpen(true)}
                        className="w-full h-10 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 px-4 flex items-center gap-3 text-gray-500 cursor-pointer transition"
                    >
                        <Search className="w-4 h-4 shrink-0" />
                        <span className="text-xs">Search for phones, laptops, accessories…</span>
                    </div>
                </div>

                {/* RIGHT — Actions */}
                <div className="flex items-center gap-1 sm:gap-2">
                    {/* Search Icon (mobile) */}
                    <button
                        type="button"
                        onClick={() => setIsSearchOpen(true)}
                        aria-label="Search"
                        className="md:hidden h-10 w-10 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-800 transition cursor-pointer"
                    >
                        <Search className="w-5 h-5" />
                    </button>

                    {/* Wishlist */}
                    <Link
                        href="/account/wishlist"
                        aria-label="Wishlist"
                        className="hidden sm:flex h-10 w-10 rounded-full items-center justify-center hover:bg-gray-50 text-gray-800 transition relative"
                    >
                        <Heart className="w-5 h-5" />
                        {user.wishlistCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                                {user.wishlistCount}
                            </span>
                        )}
                    </Link>

                    {/* Cart */}
                    <Link
                        href="/cart"
                        aria-label="Shopping Cart"
                        className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-800 transition relative"
                    >
                        <ShoppingCart className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                            2
                        </span>
                    </Link>

                    {/* USER DROPDOWN / AUTH BUTTONS */}
                    {isLoggedIn ? (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                aria-expanded={isDropdownOpen}
                                aria-label="User account menu"
                                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-50 transition cursor-pointer"
                            >
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt={user.name}
                                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
                                        {user.name
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")}
                                    </div>
                                )}
                                <ChevronDown
                                    className={`w-3.5 h-3.5 text-gray-400 hidden sm:block transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""
                                        }`}
                                />
                            </button>

                            {/* Dropdown */}
                            {isDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsDropdownOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-100 bg-white text-gray-900 shadow-lg z-50 overflow-hidden">
                                        {/* Header */}
                                        <div className="p-4 border-b border-gray-100 space-y-2 bg-gray-50/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/20 shrink-0">
                                                    {user.name
                                                        .split(" ")
                                                        .map((n) => n[0])
                                                        .join("")}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h4 className="text-xs font-semibold text-gray-900 truncate">
                                                        {user.name}
                                                    </h4>
                                                    <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                                                </div>
                                            </div>
                                            <Link
                                                href="/account"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="inline-block text-[11px] font-medium text-primary hover:underline"
                                            >
                                                View profile →
                                            </Link>
                                        </div>

                                        {/* Menu Items */}
                                        <div className="p-1.5 space-y-0.5 text-xs">
                                            <Link
                                                href="/account"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <LayoutDashboard className="w-4 h-4 text-gray-400" />
                                                    <span>My Account</span>
                                                </div>
                                            </Link>

                                            <Link
                                                href="/account/orders"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <Package className="w-4 h-4 text-gray-400" />
                                                    <span>My Orders</span>
                                                </div>
                                                {user.activeOrdersCount > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                                        {user.activeOrdersCount}
                                                    </span>
                                                )}
                                            </Link>

                                            <Link
                                                href="/account/wishlist"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <Heart className="w-4 h-4 text-gray-400" />
                                                    <span>Wishlist</span>
                                                </div>
                                                <span className="text-[10px] font-medium text-gray-500">
                                                    {user.wishlistCount}
                                                </span>
                                            </Link>

                                            <Link
                                                href="/account/addresses"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                <span>Addresses</span>
                                            </Link>

                                            <Link
                                                href="/account/reviews"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <Star className="w-4 h-4 text-gray-400" />
                                                <span>My Reviews</span>
                                            </Link>

                                            <Link
                                                href="/account/notifications"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <Bell className="w-4 h-4 text-gray-400" />
                                                    <span>Notifications</span>
                                                </div>
                                                {user.unreadNotifications > 0 && (
                                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                )}
                                            </Link>
                                        </div>

                                        <div className="h-px bg-gray-100 my-1" />

                                        <div className="p-1.5 space-y-0.5 text-xs">
                                            <Link
                                                href="/account/settings"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <Settings className="w-4 h-4 text-gray-400" />
                                                <span>Settings</span>
                                            </Link>

                                            <Link
                                                href="/help"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition"
                                            >
                                                <HelpCircle className="w-4 h-4 text-gray-400" />
                                                <span>Help & Support</span>
                                            </Link>

                                            <a
                                                href="https://wa.me/254700000000"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition text-emerald-600 font-medium"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                <span>Chat on WhatsApp</span>
                                            </a>
                                        </div>

                                        <div className="h-px bg-gray-100 my-1" />

                                        <div className="p-1.5">
                                            <button
                                                type="button"
                                                onClick={handleSignOut}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 transition font-medium text-xs cursor-pointer"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span>Sign out</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="hidden sm:flex items-center gap-2">
                            <Link
                                href="/auth/signin"
                                className="px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-800 transition"
                            >
                                Sign in
                            </Link>
                            <Link
                                href="/auth/register"
                                className="px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition"
                            >
                                Register
                            </Link>
                        </div>
                    )}

                    {/* Mobile User Icon if NOT logged in */}
                    {!isLoggedIn && (
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(true)}
                            aria-label="User menu"
                            className="sm:hidden h-10 w-10 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-800 transition"
                        >
                            <UserIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ========================================================= */}
            {/* ROW 3 — Category nav bar (hidden on < lg)                 */}
            {/* ========================================================= */}
            <div className="hidden lg:flex h-11 border-t border-gray-100 px-4 sm:px-6 items-center gap-6 overflow-x-auto scrollbar-none">
                <div className="relative group shrink-0">
                    <button
                        type="button"
                        className="flex items-center gap-2 text-xs font-semibold text-gray-800 hover:text-primary transition py-2"
                    >
                        <Menu className="w-4 h-4" />
                        <span>All Categories</span>
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>
                </div>

                <div className="h-4 w-px bg-gray-200 shrink-0" />

                <nav className="flex items-center gap-6 text-xs font-medium text-gray-500 whitespace-nowrap">
                    {categories.map((cat) => (
                        <Link
                            key={cat.name}
                            href={cat.href}
                            className={`hover:text-gray-900 transition ${cat.highlight ? "text-red-600 font-semibold flex items-center gap-1" : ""
                                }`}
                        >
                            {cat.name}
                        </Link>
                    ))}
                </nav>
            </div>

            {/* ========================================================= */}
            {/* SEARCH MODAL / OVERLAY                                    */}
            {/* ========================================================= */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-sm">
                    <div className="bg-white border-b border-gray-100 p-4 sm:p-6 shadow-sm">
                        <div className="max-w-3xl mx-auto flex items-center gap-3">
                            <Search className="w-5 h-5 text-gray-400 shrink-0" />
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for phones, laptops, accessories…"
                                className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none placeholder:text-gray-400"
                            />
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(false)}
                                className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition cursor-pointer"
                            >
                                ESC
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 overflow-y-auto space-y-6">
                        {/* Recent Searches */}
                        {!searchQuery && recentSearches.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Recent Searches
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {recentSearches.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setSearchQuery(item)}
                                            className="px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-800 transition"
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Trending */}
                        {!searchQuery && (
                            <div className="space-y-2">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Trending
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        "iPhone 15 Pro",
                                        "MacBook Air M2",
                                        "Wireless Earbuds",
                                        "PlayStation 5",
                                        "Smart Watch",
                                    ].map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setSearchQuery(item)}
                                            className="px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-xs font-medium text-gray-800 transition"
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Live Search Results — small rounded white cards */}
                        {searchQuery && (
                            <div className="space-y-3">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Products matching "{searchQuery}"
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="p-3 rounded-xl border border-gray-100 bg-white shadow-sm flex items-center gap-3 hover:shadow-md transition"
                                        >
                                            <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0" />
                                            <div className="space-y-0.5 min-w-0">
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold">
                                                    Electronics
                                                </span>
                                                <h4 className="text-xs font-semibold text-gray-900 truncate">
                                                    Wireless Noise Cancelling Earbuds Gen {i}
                                                </h4>
                                                <p className="text-xs font-mono font-bold text-gray-900">
                                                    KES 14,500
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MOBILE SHEET / DRAWER                                     */}
            {/* ========================================================= */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-black/20"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <div className="relative w-4/5 max-w-sm bg-white border-r border-gray-100 h-full shadow-2xl flex flex-col z-10">
                        {/* Sheet Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                    <Store className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-900">SokoFlow Store</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMobileMenuOpen(false)}
                                aria-label="Close menu"
                                className="p-1.5 rounded-full hover:bg-gray-50 text-gray-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Sheet Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {!isLoggedIn && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Link
                                        href="/auth/signin"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="py-2.5 px-4 text-center rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800 hover:bg-gray-50 transition"
                                    >
                                        Sign in
                                    </Link>
                                    <Link
                                        href="/auth/register"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="py-2.5 px-4 text-center rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition"
                                    >
                                        Register
                                    </Link>
                                </div>
                            )}

                            <div className="space-y-2">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Categories
                                </span>
                                <div className="grid grid-cols-1 gap-1">
                                    {categories.map((cat) => (
                                        <Link
                                            key={cat.name}
                                            href={cat.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="px-3 py-2 rounded-xl text-xs font-medium text-gray-800 hover:bg-gray-50 transition flex items-center justify-between"
                                        >
                                            <span>{cat.name}</span>
                                            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 space-y-2">
                                <Link
                                    href="/help"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-800 hover:bg-gray-50 transition"
                                >
                                    <HelpCircle className="w-4 h-4 text-gray-400" />
                                    <span>Help & Support</span>
                                </Link>
                                <a
                                    href="https://wa.me/254700000000"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    <span>Chat on WhatsApp</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}