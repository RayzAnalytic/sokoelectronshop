"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";

export default function Navbar() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const cartCount = useCart((s) => s.itemCount());
  const wishlistCount = useWishlist((s) => s.itemCount());

  const [currency, setCurrency] = useState("USD ($)");
  const currencies = ["USD ($)", "EUR (€)", "GBP (£)", "SEK (kr)", "NOK (kr)"];

  const [language, setLanguage] = useState("English");
  const languages = ["English", "Swedish", "Norwegian", "German", "French"];

  const categories = [
    { name: "Shop All", href: "/pages/products" },
    { name: "New Arrivals", href: "/pages/products/newarrivals" },
    { name: "Best Sellers", href: "/pages/products/bestsellingproducts" },
    { name: "Special Deals", href: "/pages/products/specialdeals" },
    { name: "Categories", href: "/pages/categories" },
  ];

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/pages/products?q=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="bg-slate-900 text-slate-300 text-[11px] sm:text-[12px] py-1.5 px-3 sm:px-6 lg:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <Link
            href="/stores"
            className="flex items-center gap-1.5 hover:text-white transition-colors shrink-0 min-w-0"
          >
            <svg
              className="w-3.5 h-3.5 text-slate-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="truncate">Nairobi, Kenya</span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-x-5 shrink-0">
            <a
              href="tel:+254116103872"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <span className="hidden sm:inline">+254 116 103 872</span>
              <span className="sm:hidden">Call</span>
            </a>

            <span className="w-px h-3 bg-slate-700" />

            <Link
              href="/pages/account/orders"
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Track Order
            </Link>
          </div>
        </div>
      </div>

      <nav className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-5" aria-label="Top">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          <div className="flex items-center lg:hidden shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-1 rounded-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-4 md:space-x-6 lg:space-x-8 min-w-0">
            <Link href="/" className="flex items-center space-x-0.5 shrink-0">
              <img
                src="/logo.jpeg"
                alt="RazeStore"
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-sm"
              />
              <span className="font-bold text-slate-900 text-base hidden sm:inline-block">
                RazeStore
              </span>
            </Link>

            <div className="hidden lg:flex lg:space-x-6">
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  href={cat.href}
                  className="text-[14px] font-medium text-slate-700 hover:text-blue-950 transition-colors whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
            <form
              onSubmit={handleSearch}
              className="hidden md:flex items-center relative"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-[240px] lg:w-[320px] xl:w-[380px] pl-8 pr-3 py-2 text-[13px] bg-slate-50 border border-slate-300 rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-950 focus:ring-1 focus:ring-blue-950"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </form>

            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-700 hover:text-blue-950 px-2 py-1.5 rounded-sm hover:bg-slate-100 transition-colors"
              aria-label="Sign In"
            >
              <svg
                className="w-4 h-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="hidden sm:inline">Sign In</span>
            </Link>

            <Link
              href="/pages/account/wishlist"
              className="relative p-2 text-slate-700 hover:text-rose-600 rounded-sm hover:bg-slate-100 transition-colors flex items-center"
              aria-label="Wishlist"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-semibold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link
              href="/pages/cart"
              className="relative p-2 text-slate-700 hover:text-blue-950 rounded-sm hover:bg-slate-100 transition-colors flex items-center"
              aria-label="Shopping Cart"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-950 text-white font-semibold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 py-3 px-1 space-y-3 bg-white max-h-[calc(100vh-8rem)] overflow-y-auto">
            <form onSubmit={handleSearch} className="relative md:hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-8 pr-3 py-2 text-[13px] bg-slate-50 border border-slate-300 rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-950 focus:ring-1 focus:ring-blue-950"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </form>

            <div className="space-y-1 pt-1">
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  href={cat.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-950 rounded-sm transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1">
              <Link
                href="/pages/account/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-rose-600 rounded-sm transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-rose-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                    />
                  </svg>
                  <span>Wishlist</span>
                </span>
                {wishlistCount > 0 && (
                  <span className="bg-rose-600 text-white font-semibold text-[10px] px-1.5 py-0.5 rounded-full">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <Link
                href="/pages/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-950 rounded-sm transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <span>Cart</span>
                </span>
                {cartCount > 0 && (
                  <span className="bg-blue-950 text-white font-semibold text-[10px] px-1.5 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link
                href="/stores"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-950 rounded-sm transition-colors"
              >
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>Find a Store</span>
              </Link>
              <Link
                href="/pages/account/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-950 rounded-sm transition-colors"
              >
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                  />
                </svg>
                <span>Track Order</span>
              </Link>

              <Link
                href="/support"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-950 rounded-sm transition-colors"
              >
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Help Center</span>
              </Link>
            </div>

            <div className="pt-2 border-t border-slate-100 px-3 py-1">
              <a
                href="tel:+254700000000"
                className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-blue-950 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span>+254 116 103 872</span>
              </a>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 px-3 py-1">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 w-full text-[12px] bg-slate-50 border border-slate-300 rounded-sm p-1 text-slate-800 focus:outline-none"
                >
                  {languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full text-[12px] bg-slate-50 border border-slate-300 rounded-sm p-1 text-slate-800 focus:outline-none"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 pb-1">
              <Link
                href="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-950 rounded-sm transition-colors"
              >
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>Sign In / Register</span>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
