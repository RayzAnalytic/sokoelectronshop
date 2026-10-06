import React from 'react';
import Header from '@/components/homepage/Navbar';
import Footer from '@/components/homepage/Footer';

import WhatsAppButton from "@/components/homepage/WhatsAppButton";
import AIAssistantButton from "@/components/homepage/AIAssistantButton";

interface ProductsLayoutProps {
    children: React.ReactNode;
}

export default function ProductsLayout({ children }: ProductsLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
            {/* Global Homepage Navigation Header */}
            <Header />

            {/* Main Product Section Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Global Homepage Footer */}
            <Footer />


                  {/* Floating action buttons — fixed position, don't affect layout.
                      Stacked vertically: AI Assistant above WhatsApp. */}
                  <AIAssistantButton shopName="MyShop" />
                 <WhatsAppButton/>
        </div>
    );
}