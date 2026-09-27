"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Phone, MapPin, Navigation, Search, Building2, Store as StoreIcon, Landmark } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface Store {
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    lat: number;
    lng: number;
    hours: string;
    status: "open" | "closed" | "coming-soon" | "flagship";
    image?: string;
}

const STORES: Store[] = [
    {
        id: "nbi-cbd",
        name: "TechHub CBD Flagship",
        address: "Kimathi Street, Anniversary Towers",
        city: "Nairobi",
        phone: "+254 700 123456",
        lat: -1.2833,
        lng: 36.8172,
        hours: "Mon - Sat: 8:00 AM - 8:00 PM",
        status: "flagship",
        image: "/tvs.jpeg",
    },
    {
        id: "westlands",
        name: "TechHub Westlands",
        address: "Pioneer House, Westlands Road",
        city: "Nairobi",
        phone: "+254 711 234567",
        lat: -1.2634,
        lng: 36.8044,
        hours: "Mon - Sat: 9:00 AM - 7:00 PM",
        status: "open",
    },
    {
        id: "kilimani",
        name: "TechHub Yaya Centre",
        address: "Argwings Kodhek Road",
        city: "Nairobi",
        phone: "+254 722 345678",
        lat: -1.2921,
        lng: 36.7845,
        hours: "Mon - Sun: 9:00 AM - 8:00 PM",
        status: "open",
    },
    {
        id: "mombasa",
        name: "TechHub Nyali",
        address: "Links Road, Nyali",
        city: "Mombasa",
        phone: "+254 733 456789",
        lat: -4.0435,
        lng: 39.7153,
        hours: "Mon - Sat: 8:30 AM - 6:30 PM",
        status: "open",
    },
];

// Dynamically import react-leaflet components with SSR disabled
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

export default function StoreLocator() {
    const [selectedId, setSelectedId] = useState<string>(STORES[0].id);
    const [searchQuery, setSearchQuery] = useState("");
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [customIcon, setCustomIcon] = useState<any>(null);

    useEffect(() => {
        setIsMounted(true);
        import("leaflet").then((L) => {
            const icon = L.divIcon({
                className: "custom-leaflet-marker",
                html: `<div style="width: 28px; height: 28px; border-radius: 50%; background-color: #0f172a; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });
            setCustomIcon(icon);
        });
    }, []);

    const filteredStores = STORES.filter(
        (s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectStore = (store: Store) => {
        setSelectedId(store.id);
        if (mapInstance) {
            mapInstance.flyTo([store.lat, store.lng], 14, { duration: 1.2 });
        }
    };

    const getStoreAreaIcon = (id: string) => {
        switch (id) {
            case "nbi-cbd":
                return <Landmark className="h-3.5 w-3.5 text-slate-700" />;
            case "westlands":
                return <Building2 className="h-3.5 w-3.5 text-slate-700" />;
            case "kilimani":
                return <StoreIcon className="h-3.5 w-3.5 text-slate-700" />;
            default:
                return <MapPin className="h-3.5 w-3.5 text-slate-500" />;
        }
    };

    // Ref callback that clears any stale Leaflet id before the map initializes.
    // Prevents "Cannot read properties of undefined (reading 'appendChild')" on HMR.
    const mapRefCallback = useCallback((node: any) => {
        if (node) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const leafletContainer = node as any;
            if (leafletContainer._leaflet_id) {
                leafletContainer._leaflet_id = null;
            }
            setMapInstance(node);
        }
    }, []);

    return (
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 bg-white" aria-label="Store Locator">
            <div className="mb-3 bg-slate-50/80 px-3 py-2 rounded-sm border border-slate-200">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-sm">
                    Locations
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5">Visit Our Stores</h2>
                <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                    Find a TechHub location near you for expert support, hands-on device testing, and seamless shopping.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-3">
                {/* Map Column */}
                <div className="w-full lg:w-[65%] flex flex-col">
                    <div className="relative w-full h-[380px] lg:h-[520px] rounded-sm overflow-hidden border border-slate-200 bg-slate-50 shadow-xs z-0">
                        {!isMounted || !customIcon ? (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-medium animate-pulse">
                                Loading map environment...
                            </div>
                        ) : (
                            <MapContainer
                                key="store-locator-map"
                                center={[-1.2833, 36.8172]}
                                zoom={12}
                                scrollWheelZoom={false}
                                style={{ width: "100%", height: "100%" }}
                                ref={mapRefCallback}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {STORES.map((store) => (
                                    <Marker
                                        key={store.id}
                                        position={[store.lat, store.lng]}
                                        icon={customIcon}
                                        eventHandlers={{
                                            click: () => setSelectedId(store.id),
                                        }}
                                    >
                                        <Popup>
                                            <div style={{ fontFamily: "inherit", padding: "2px", maxWidth: "190px" }}>
                                                {store.image && (
                                                    <img
                                                        src={store.image}
                                                        alt={store.name}
                                                        style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "2px", marginBottom: "4px" }}
                                                    />
                                                )}
                                                <h4 style={{ fontWeight: 600, fontSize: "12px", color: "#0f172a", margin: "0 0 2px 0" }}>
                                                    {store.name}
                                                </h4>
                                                <p style={{ fontSize: "11px", color: "#475569", margin: "0 0 3px 0" }}>
                                                    {store.address}, {store.city}
                                                </p>
                                                <p style={{ fontSize: "11px", color: "#334155", margin: "0 0 4px 0", fontWeight: 500 }}>
                                                    🕒 {store.hours}
                                                </p>
                                                <div style={{ display: "flex", gap: "6px", fontSize: "11px", borderTop: "1px solid #f1f5f9", paddingTop: "3px" }}>
                                                    <a href={`tel:${store.phone}`} style={{ color: "#0f172a", textDecoration: "none", fontWeight: 600 }}>Call</a>
                                                    <span style={{ color: "#cbd5e1" }}>•</span>
                                                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: "#0f172a", textDecoration: "none", fontWeight: 600 }}>Directions</a>
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        )}
                    </div>
                </div>

                {/* Store List Column */}
                <div className="w-full lg:w-[35%] flex flex-col">
                    <div className="mb-3 relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by city or store name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-sm border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
                        />
                    </div>

                    <div
                        className="flex flex-col gap-3 overflow-y-auto pr-1"
                        style={{ maxHeight: "calc(520px - 44px)" }}
                    >
                        {filteredStores.length === 0 ? (
                            <div className="rounded-sm border border-dashed border-slate-200 px-3 py-2 text-center text-xs text-slate-500 bg-slate-50/50">
                                No stores match your search criteria.
                            </div>
                        ) : (
                            <ul className="space-y-3 m-0 p-0 list-none">
                                {filteredStores.map((store) => {
                                    const isActive = selectedId === store.id;
                                    return (
                                        <li key={store.id}>
                                            <button
                                                onClick={() => handleSelectStore(store)}
                                                className={`w-full text-left rounded-sm border px-3 py-2 transition-all duration-150 flex flex-col gap-3 ${
                                                    isActive
                                                        ? "border-slate-900 bg-slate-50/90 shadow-xs"
                                                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                                            {getStoreAreaIcon(store.id)}
                                                            {store.city}
                                                        </span>
                                                        <h3 className="text-xs font-bold text-slate-900 mt-0.5">{store.name}</h3>
                                                    </div>
                                                    <span
                                                        className={`px-2 py-0.5 rounded-sm text-[9px] font-semibold shrink-0 ${
                                                            store.status === "flagship"
                                                                ? "bg-slate-900 text-white"
                                                                : "bg-slate-100 text-slate-700"
                                                        }`}
                                                    >
                                                        {store.status === "flagship" ? "Flagship" : "Open"}
                                                    </span>
                                                </div>

                                                <p className="text-[11px] text-slate-600 flex items-center gap-1">
                                                    <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                                    {store.address}
                                                </p>

                                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                                                    <a
                                                        href={`tel:${store.phone}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium transition-colors"
                                                    >
                                                        <Phone className="h-3 w-3 text-slate-400" />
                                                        {store.phone}
                                                    </a>

                                                    <span className="text-slate-900 font-semibold flex items-center gap-1 group text-[11px]">
                                                        Map <Navigation className="h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
                                                    </span>
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}