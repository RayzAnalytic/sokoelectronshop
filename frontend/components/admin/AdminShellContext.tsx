"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Ctx = {
    collapsed: boolean;
    toggle: () => void;
    setCollapsed: (v: boolean) => void;
};

const AdminShellContext = createContext<Ctx>({
    collapsed: false,
    toggle: () => {},
    setCollapsed: () => {},
});

export function AdminShellProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsedState] = useState(false);

    // Restore from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("admin.sidebar.collapsed");
            if (saved === "1") setCollapsedState(true);
        } catch {}
    }, []);

    const setCollapsed = (v: boolean) => {
        setCollapsedState(v);
        try {
            localStorage.setItem("admin.sidebar.collapsed", v ? "1" : "0");
        } catch {}
    };

    const toggle = () => setCollapsed(!collapsed);

    return (
        <AdminShellContext.Provider value={{ collapsed, toggle, setCollapsed }}>
            {children}
        </AdminShellContext.Provider>
    );
}

export const useAdminShell = () => useContext(AdminShellContext);