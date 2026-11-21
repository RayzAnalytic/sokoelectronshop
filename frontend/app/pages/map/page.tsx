"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink, X } from "lucide-react";
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
        id: "icell-nyeri",
        name: "iCell Xtreme Electronics Nyeri",
        address: "Batian Building, Gakere Street (Opp. Safaricom / Bhai's Pub)",
        city: "Nyeri",
        phone: "+254 715 498109",
        lat: -0.4215,
        lng: 36.9515,
        hours: "Mon - Sat: 8:00 AM - 7:00 PM",
        status: "flagship",
        image: "/icell.png",
    },
    {
        id: "hotpoint-nyeri",
        name: "Hotpoint Appliances",
        address: "Gakere Street",
        city: "Nyeri",
        phone: "",
        lat: -0.4208,
        lng: 36.9522,
        hours: "Mon - Sat: 8:30 AM - 6:30 PM",
        status: "open",
    },
    {
        id: "samsung-nyeri",
        name: "Samsung Experience Store",
        address: "Kimathi Way",
        city: "Nyeri",
        phone: "",
        lat: -0.4222,
        lng: 36.9508,
        hours: "Mon - Sat: 9:00 AM - 7:00 PM",
        status: "open",
    },
    {
        id: "lg-nyeri",
        name: "LG Brand Shop",
        address: "Kimathi Way",
        city: "Nyeri",
        phone: "",
        lat: -0.4202,
        lng: 36.95,
        hours: "Mon - Sat: 9:00 AM - 6:00 PM",
        status: "open",
    },
];

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

interface ClickedPoint {
    lat: number;
    lng: number;
}

function MapController({
    selectedId,
    onMapClick,
    clickedPoint,
}: {
    selectedId: string | null;
    onMapClick: (p: ClickedPoint) => void;
    clickedPoint: ClickedPoint | null;
}) {
    const { useMap, useMapEvents } = require("react-leaflet");
    const map = useMap();

    useMapEvents({
        click: (e: any) => {
            const target = e.originalEvent?.target as HTMLElement | null;
            if (target && target.closest(".leaflet-marker-icon")) return;
            if (target && target.closest(".leaflet-popup")) return;
            onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        },
    });

    useEffect(() => {
        if (!map) return;
        const L = require("leaflet");
        if (selectedId) {
            const store = STORES.find((s) => s.id === selectedId);
            if (store) {
                map.flyTo([store.lat, store.lng], 17, { duration: 1.2 });
                map.once("moveend", () => {
                    L.popup()
                        .setLatLng([store.lat, store.lng])
                        .setContent(
                            `<div style="font-size:13px;color:#172554;font-weight:600;">${store.name}</div>`
                        )
                        .openOn(map);
                });
            }
        } else {
            const bounds = L.latLngBounds(STORES.map((s) => [s.lat, s.lng]));
            map.fitBounds(bounds, { padding: [60, 60] });
        }
    }, [selectedId, map]);

    useEffect(() => {
        if (!map || !clickedPoint) return;
        map.flyTo(
            [clickedPoint.lat, clickedPoint.lng],
            Math.max(map.getZoom(), 16),
            { duration: 0.8 }
        );
    }, [clickedPoint, map]);

    return null;
}

export default function MapPage() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [clickedPoint, setClickedPoint] = useState<ClickedPoint | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [baseIcon, setBaseIcon] = useState<any>(null);
    const [activeIcon, setActiveIcon] = useState<any>(null);
    const [flagshipIcon, setFlagshipIcon] = useState<any>(null);
    const [flagshipActiveIcon, setFlagshipActiveIcon] = useState<any>(null);
    const [pinIcon, setPinIcon] = useState<any>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        import("leaflet").then((L) => {
            const markerSvg = (size: number, stroke: string) =>
                `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

            setBaseIcon(
                L.divIcon({
                    className: "custom-leaflet-marker",
                    html: `<div style="width:28px;height:28px;border-radius:50%;background:#172554;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;color:#fff;">${markerSvg(13, "#fff")}</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                })
            );
            setActiveIcon(
                L.divIcon({
                    className: "custom-leaflet-marker-active",
                    html: `<div style="width:34px;height:34px;border-radius:50%;background:#1e3a8a;border:3px solid #fff;box-shadow:0 3px 10px rgba(23,37,84,.45);display:flex;align-items:center;justify-content:center;color:#fff;">${markerSvg(15, "#fff")}</div>`,
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                })
            );
            setFlagshipIcon(
                L.divIcon({
                    className: "custom-leaflet-marker-flagship",
                    html: `<div style="width:34px;height:34px;border-radius:50%;background:#facc15;border:3px solid #fff;box-shadow:0 3px 10px rgba(250,204,21,.55);display:flex;align-items:center;justify-content:center;color:#172554;">${markerSvg(15, "#172554")}</div>`,
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                })
            );
            setFlagshipActiveIcon(
                L.divIcon({
                    className: "custom-leaflet-marker-flagship-active",
                    html: `<div style="width:40px;height:40px;border-radius:50%;background:#facc15;border:4px solid #172554;box-shadow:0 4px 14px rgba(250,204,21,.7);display:flex;align-items:center;justify-content:center;color:#172554;">${markerSvg(17, "#172554")}</div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                })
            );
            setPinIcon(
                L.divIcon({
                    className: "custom-leaflet-marker-pin",
                    html: `<div style="width:30px;height:30px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 3px 10px rgba(220,38,38,.5);display:flex;align-items:center;justify-content:center;color:#fff;">${markerSvg(14, "#fff")}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                })
            );
        });
    }, []);

    const markersReady =
        isMounted &&
        !!baseIcon &&
        !!activeIcon &&
        !!flagshipIcon &&
        !!flagshipActiveIcon &&
        !!pinIcon;

    const selectedStore = useMemo(
        () => STORES.find((s) => s.id === selectedId) || null,
        [selectedId]
    );

    const selectedLabel = selectedStore
        ? `${selectedStore.name} — ${selectedStore.city}`
        : "All Stores";

    const handleMapClick = useCallback((p: ClickedPoint) => {
        setClickedPoint(p);
    }, []);

    const openGoogleMaps = () => {
        if (!clickedPoint) return;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${clickedPoint.lat},${clickedPoint.lng}&travelmode=driving`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const iconFor = (store: Store) => {
        const isFlagship = store.status === "flagship";
        const isActive = selectedId === store.id;
        if (isFlagship) return isActive ? flagshipActiveIcon : flagshipIcon;
        return isActive ? activeIcon : baseIcon;
    };

    return (
        <div className="min-h-dvh w-full bg-white flex flex-col">
            <header className="sticky top-0 z-[1000] bg-white border-b border-blue-100 px-3 xs:px-4 sm:px-6 py-2 flex items-center gap-2">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 bg-white text-blue-950 border border-slate-200 rounded px-2.5 py-2 text-[13px] font-semibold hover:bg-yellow-400 hover:border-yellow-400 transition-colors shrink-0"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">Back</span>
                </Link>

                <div className="relative flex-1 min-w-0 max-w-xs mx-auto">
                    <button
                        type="button"
                        onClick={() => setDropdownOpen((o) => !o)}
                        className="w-full flex items-center justify-between gap-2 bg-white text-blue-950 border border-slate-200 rounded px-3 py-2 text-[13px] font-semibold hover:bg-slate-50 transition-colors"
                        aria-haspopup="listbox"
                        aria-expanded={dropdownOpen}
                    >
                        <span className="truncate text-left">{selectedLabel}</span>
                        <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                        />
                    </button>

                    {dropdownOpen && (
                        <ul
                            role="listbox"
                            className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded overflow-hidden z-[1001] m-0 p-0 list-none"
                        >
                            <li>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedId(null);
                                        setDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-[13px] font-semibold transition-colors ${selectedId === null
                                        ? "bg-blue-950 text-white"
                                        : "text-blue-950 hover:bg-slate-50"
                                        }`}
                                >
                                    All Stores
                                </button>
                            </li>
                            {STORES.map((store) => (
                                <li key={store.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedId(store.id);
                                            setDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${selectedId === store.id
                                            ? "bg-blue-950 text-white"
                                            : "text-blue-950 hover:bg-slate-50"
                                            }`}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <span className="block font-semibold truncate">
                                                {store.name}
                                            </span>
                                            {store.status === "flagship" && (
                                                <span
                                                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${selectedId === store.id
                                                        ? "bg-yellow-400 text-blue-950"
                                                        : "bg-yellow-400 text-blue-950"
                                                        }`}
                                                >
                                                    Flagship
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={`block text-[13px] ${selectedId === store.id
                                                ? "text-slate-200"
                                                : "text-slate-500"
                                                }`}
                                        >
                                            {store.city}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="w-[34px] shrink-0" aria-hidden="true" />
            </header>

            <div
                className="relative w-full bg-slate-50 z-0"
                style={{ height: "calc(100dvh - 56px)" }}
            >
                {!markersReady ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-[13px] font-medium animate-pulse">
                        Loading map environment...
                    </div>
                ) : (
                    <MapContainer
                        key="full-store-map"
                        center={[-0.4215, 36.9515]}
                        zoom={16}
                        scrollWheelZoom={true}
                        style={{ width: "100%", height: "100%" }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapController
                            selectedId={selectedId}
                            onMapClick={handleMapClick}
                            clickedPoint={clickedPoint}
                        />

                        {STORES.map((store) => (
                            <Marker
                                key={store.id}
                                position={[store.lat, store.lng]}
                                icon={iconFor(store)}
                                eventHandlers={{
                                    click: () => setSelectedId(store.id),
                                }}
                            >
                                <Popup>
                                    <div style={{ fontFamily: "inherit", padding: "2px", maxWidth: "200px" }}>
                                        {store.status === "flagship" && (
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    background: "#facc15",
                                                    color: "#172554",
                                                    fontSize: "10px",
                                                    fontWeight: 700,
                                                    padding: "1px 6px",
                                                    borderRadius: "3px",
                                                    marginBottom: "3px",
                                                    letterSpacing: "0.03em",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                iCell Xtreme
                                            </span>
                                        )}
                                        {store.image && (
                                            <img
                                                src={store.image}
                                                alt={store.name}
                                                style={{
                                                    width: "100%",
                                                    height: "80px",
                                                    objectFit: "cover",
                                                    borderRadius: "2px",
                                                    marginBottom: "4px",
                                                }}
                                            />
                                        )}
                                        <h4 style={{ fontWeight: 600, fontSize: "13px", color: "#172554", margin: "0 0 2px 0" }}>
                                            {store.name}
                                        </h4>
                                        <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 3px 0" }}>
                                            {store.address}, {store.city}
                                        </p>
                                        <p style={{ fontSize: "12px", color: "#334155", margin: "0 0 4px 0", fontWeight: 500 }}>
                                            🕒 {store.hours}
                                        </p>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "6px",
                                                fontSize: "12px",
                                                borderTop: "1px solid #f1f5f9",
                                                paddingTop: "3px",
                                            }}
                                        >
                                            {store.phone && (
                                                <>
                                                    <a
                                                        href={`tel:${store.phone}`}
                                                        style={{ color: "#172554", textDecoration: "none", fontWeight: 600 }}
                                                    >
                                                        Call
                                                    </a>
                                                    <span style={{ color: "#cbd5e1" }}>•</span>
                                                </>
                                            )}
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: "#172554", textDecoration: "none", fontWeight: 600 }}
                                            >
                                                Directions
                                            </a>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {clickedPoint && (
                            <Marker
                                position={[clickedPoint.lat, clickedPoint.lng]}
                                icon={pinIcon}
                            />
                        )}
                    </MapContainer>
                )}

                {clickedPoint && (
                    <div className="absolute bottom-3 left-3 right-3 xs:left-auto xs:right-3 z-[1000] bg-white border border-slate-200 rounded px-3 py-2 space-y-2 xs:w-[260px]">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-blue-950">Selected Location</p>
                                <p className="text-[13px] text-slate-500 truncate">
                                    {clickedPoint.lat.toFixed(6)}, {clickedPoint.lng.toFixed(6)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setClickedPoint(null)}
                                className="shrink-0 text-slate-400 hover:text-blue-950 transition-colors p-1 rounded"
                                aria-label="Clear selection"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={openGoogleMaps}
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 text-white rounded px-3 py-3 text-[13px] font-semibold hover:bg-yellow-400 hover:text-blue-950 transition-colors"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in Google Maps
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}