import React from 'react';
import Header from '@/components/homepage/Navbar';
import Footer from '@/components/homepage/Footer';

import SupportWidget from '@/components/homepage/SupportWidget';

interface ProductsLayoutProps {
    children: React.ReactNode;
}

export default function ProductsLayout({ children }: ProductsLayoutProps) {
    return (
        <div className="min-h-screen w-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
            <Header />

            <main className="flex-1">
                {children}
            </main>

            <Footer />

            <SupportWidget shopName="Razestore" />
        </div>
    );
}