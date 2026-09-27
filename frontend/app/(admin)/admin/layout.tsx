import React from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { AdminShellProvider } from "@/components/admin/AdminShellContext";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AdminShellProvider>
            <div className="min-h-screen flex bg-white text-slate-900">
                <AdminSidebar />

                <div className="flex-1 flex flex-col min-w-0">
                    <AdminHeader />
                    <main className="flex-1 overflow-y-auto bg-slate-50">
                        <div className="max-w-[1600px] mx-auto px-3 sm:px-3 lg:px-3 py-3">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </AdminShellProvider>
    );
}