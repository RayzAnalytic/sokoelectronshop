"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminRuntimeSettings } from "@/lib/admin-types";

interface Ctx {
  settings: AdminRuntimeSettings | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsSnapshotProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<AdminRuntimeSettings | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSettings(await adminApi.settings.runtime());
    } catch {
      /* non-fatal — pages fall back to their own defaults */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SettingsCtx.Provider value={{ settings, ready, refresh }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) {
    throw new Error("useSettings must be used inside SettingsSnapshotProvider");
  }
  return ctx;
}