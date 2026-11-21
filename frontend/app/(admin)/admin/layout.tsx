'use client';

import React, { useCallback, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { AdminShellProvider } from "@/components/admin/AdminShellContext";
import { SettingsSnapshotProvider } from "@/components/admin/_settings-context";
import AIAutomationCopilot from "@/components/admin/aiautomation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const handleOpenChange = useCallback((next: boolean) => setAiOpen(next), []);

  return (
    <SettingsSnapshotProvider>
      <AdminShellProvider>
        <div className="admin-no-scrollbar h-screen overflow-hidden flex bg-white text-slate-900">
          <AdminSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader />

            <main className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
              <div className="max-w-[1700px] mx-auto px-1 sm:px-1 lg:px-1 py-1">
                {children}
              </div>
            </main>
          </div>

          <div
            aria-hidden="true"
            onClick={() => setAiOpen(false)}
            className={`fixed inset-0 z-[125] bg-slate-900/30 backdrop-blur-sm transition-opacity duration-150 ${aiOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
          />

          <AIAutomationCopilot
            open={aiOpen}
            onOpenChange={handleOpenChange}
          />
        </div>
      </AdminShellProvider>
    </SettingsSnapshotProvider>
  );
}