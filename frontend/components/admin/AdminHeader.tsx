"use client";

import React, { useState } from "react";
import { Search, Bell, Sun, ChevronDown, Plus, PanelLeft } from "lucide-react";
import { useAdminShell } from "./AdminShellContext";
import AddProductModal from "./AddProductModal";

export default function AdminHeader() {
    const { collapsed, toggle } = useAdminShell();
    const [addOpen, setAddOpen] = useState(false);

    return (
        <>
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 gap-3 sticky top-0 z-30">
                {/* Left */}
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={toggle}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shrink-0"
                    >
                        <PanelLeft className="h-4 w-4" />
                    </button>

                    <span className="hidden sm:inline text-[13px] font-medium text-slate-700 truncate">
                        Dashboard
                    </span>
                </div>

                {/* Center: search */}
                <div className="hidden md:block flex-1 max-w-md">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search products, orders, customers…"
                            className="w-full bg-white border border-slate-200 rounded-md pl-9 pr-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950 focus:border-blue-950"
                        />
                    </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAddOpen(true)}
                        className="hidden sm:inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white text-[13px] font-medium px-3 py-2 rounded-md transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add product
                    </button>

                    <button
                        type="button"
                        className="relative h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                        aria-label="Notifications"
                    >
                        <Bell className="h-4 w-4" />
                        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-950" />
                    </button>

                    <button
                        type="button"
                        className="hidden sm:flex h-8 w-8 rounded-md hover:bg-slate-100 items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                        aria-label="Toggle theme"
                    >
                        <Sun className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        className="flex items-center gap-2 pl-1.5 pr-1.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
                    >
                        <div className="h-7 w-7 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold">
                            AD
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                </div>
            </header>

            <AddProductModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onSave={(data) => {
                    console.log("New product:", data);
                    alert(`Saved "${data.name}"`);
                }}
            />
        </>
    );
}