"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Ctx = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

const STORAGE_KEY = "admin.sidebar.collapsed";

const AdminShellContext = createContext<Ctx>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
});

export function AdminShellProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  // Restore from localStorage on mount. Runs once, after hydration,
  // so SSR and the first client render both start collapsed=false and
  // there's no hydration mismatch. The tradeoff is one frame where the
  // sidebar renders expanded before it snaps to collapsed — invisible
  // in practice, and the only way to do this without an inline script
  // in the root layout.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsedState(true);
    } catch {
      /* localStorage unavailable (private mode, blocked cookies) — ignore */
    }
  }, []);

  // Stable setter. Writing to localStorage here means every call site
  // (button, keyboard shortcut, programmatic reset) persists the state
  // without having to remember to.
  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  // Functional update: reads the latest `collapsed` even if the closure
  // was captured from an earlier render. `setCollapsed` only takes a
  // boolean, so we read the current value via the state setter.
  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Memoized context value: children only re-render when `collapsed`
  // actually changes, not on every provider render.
  const value = useMemo<Ctx>(
    () => ({ collapsed, toggle, setCollapsed }),
    [collapsed, toggle, setCollapsed],
  );

  return (
    <AdminShellContext.Provider value={value}>
      {children}
    </AdminShellContext.Provider>
  );
}

export const useAdminShell = () => useContext(AdminShellContext);