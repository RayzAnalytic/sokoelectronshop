'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Phone,
    MapPin,
    Navigation,
    Search,
    Clock,
    Maximize2,
} from 'lucide-react';

const STORE = {
    id: 'havens-nyeri',
    name: 'Havens Technologies Nyeri',
    address: "Batian Building, Gakere Street (Opp. Safaricom / Bhai's Pub)",
    city: 'Nyeri',
    phone: '+254706479906',
    displayPhone: '0706 479 906',
    lat: -0.4215,
    lng: 36.9515,
    hours: 'Mon - Sat: 8:00 AM - 7:00 PM',
    image: '/Pasted image (2).png',
};

export default function StoreLocator() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        router.push(`/pages/products?q=${encodeURIComponent(q)}`);
    };

    const fullMapUrl = `https://www.google.com/maps/search/?api=1&query=${STORE.lat},${STORE.lng}`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${STORE.lat},${STORE.lng}`;

    return (
        <section
            className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 py-4 xs:py-5 sm:py-6 bg-white"
            aria-label="Store Locator"
        >
            <div className="mb-3 space-y-2 bg-[#F3F6F9] rounded border border-slate-200 px-3 py-2">
                <span className="inline-block text-[13px] font-semibold uppercase text-[#0B0D10] bg-[#00E5FF] px-2 py-1 rounded">
                    Location
                </span>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111827]">
                    Visit <span className="text-[#00B8D4]">Havens Technologies</span>
                </h2>
                <p className="text-[13px] text-[#6B7280] max-w-xl">
                    Drop by our flagship store in Nyeri town for expert electronics
                    advice, hands-on demos, and same-day pickup.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
                <form onSubmit={handleSearch} className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search electronics..."
                        className="w-full rounded border border-slate-200 bg-[#F3F6F9] pl-9 pr-3 py-2.5 text-[13px] text-[#111827] placeholder:text-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#00B8D4] focus:border-[#00B8D4] focus:bg-white transition-all"
                    />
                </form>
                <a
                    href={`tel:${STORE.phone}`}
                    className="inline-flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10] font-bold px-4 py-2.5 rounded transition-colors text-[13px] whitespace-nowrap"
                >
                    <Phone className="h-4 w-4" />
                    {STORE.displayPhone}
                </a>
            </div>

            <div className="bg-white rounded border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[280px] bg-[#F3F6F9]">
                        <img
                            src={STORE.image}
                            alt={STORE.name}
                            className="w-full h-full object-cover absolute inset-0"
                        />
                        <span className="absolute top-2 left-2 z-10 bg-[#00E5FF] text-[#0B0D10] text-[11px] font-bold uppercase px-2 py-0.5 rounded shadow-sm">
                            Flagship Store
                        </span>
                    </div>

                    <div className="p-4 sm:p-5 flex flex-col justify-between">
                        <div className="space-y-2.5">
                            <h3 className="text-lg sm:text-xl font-bold text-[#111827]">
                                {STORE.name}
                            </h3>

                            <p className="text-[13px] text-[#6B7280] flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-[#6B7280] shrink-0 mt-0.5" />
                                <span>{STORE.address}, {STORE.city}</span>
                            </p>

                            <p className="text-[13px] text-[#6B7280] flex items-center gap-2">
                                <Clock className="h-4 w-4 text-[#6B7280] shrink-0" />
                                <span>{STORE.hours}</span>
                            </p>

                            <a
                                href={`tel:${STORE.phone}`}
                                className="text-[13px] text-[#111827] hover:text-[#00B8D4] flex items-center gap-2 font-medium transition-colors"
                            >
                                <Phone className="h-4 w-4 shrink-0" />
                                {STORE.displayPhone}
                            </a>
                        </div>

                        <div className="flex flex-col xs:flex-row gap-2 mt-4 pt-4 border-t border-slate-200">
                            <a
                                href={directionsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10] font-bold py-2 px-3 rounded transition-colors text-[13px]"
                            >
                                <Navigation className="h-4 w-4" />
                                Get Directions
                            </a>
                            <a
                                href={fullMapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0B0D10] hover:bg-[#11161D] text-[#00E5FF] font-bold py-2 px-3 rounded transition-colors text-[13px]"
                            >
                                <Maximize2 className="h-4 w-4" />
                                Full Map
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}