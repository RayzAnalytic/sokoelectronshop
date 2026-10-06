import React from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { AdminShellProvider } from "@/components/admin/AdminShellContext";
import { SettingsSnapshotProvider } from "@/components/admin/_settings-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // SettingsSnapshotProvider must be OUTER so both AdminHeader
    // (search, notifications) and any page rendered as `children`
    // can read settings via `useSettings()`. Writes to Settings call
    // `snapshot.refresh()`, which re-renders every consumer.
    <SettingsSnapshotProvider>
      <AdminShellProvider>
        {/*
          min-h-screen: full viewport height even when content is short.
          flex: sidebar (fixed/sticky) + content column.
        */}
        <div className="min-h-screen flex bg-white text-slate-900">
          <AdminSidebar />

          {/*
            flex-1 + min-w-0 — the content column must be allowed to
            shrink below its content width, otherwise wide tables
            (products, orders) push the whole layout sideways instead
            of scrolling inside their own container.
          */}
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader />

            {/*
              overflow-y-auto — scroll happens here, not on <body>.
              Keeps the header and sidebar pinned while the page
              content scrolls.
            */}
            <main className="flex-1 overflow-y-auto bg-slate-50">
              <div className="max-w-[1600px] mx-auto px-3 sm:px-3 lg:px-3 py-3">
                {children}
              </div>
            </main>
          </div>
        </div>
      </AdminShellProvider>
    </SettingsSnapshotProvider>
  );
}