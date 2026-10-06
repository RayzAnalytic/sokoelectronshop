'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Truck,
  Plus,
  MapPin,
  DollarSign,
  Clock,
  Trash2,
  CheckCircle2,
  X,
  Zap,
  Key,
  CheckSquare,
  Square,
  Navigation,
  Store,
  Search,
  Box,
  Building2,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminKenyaRegions,
  AdminShippingZone,
  AdminShippingMethod,
  AdminPickupLocation,
  AdminShipment,
  AdminShipmentStatus,
  AdminCourierConfig,
} from '@/lib/admin-types';

// --- TYPES ---
// The wire shape comes from `admin-types.ts`. The local aliases keep
// the JSX readable without renaming every type reference.
type ShippingTab =
  | 'Zones & Rates'
  | 'Methods'
  | 'Pickup Locations'
  | 'Tracking'
  | 'Providers';

type ShipmentStatus = AdminShipmentStatus;

export default function ShippingPage() {
  const [activeTab, setActiveTab] = useState<ShippingTab>('Zones & Rates');

  // ── Server state ────────────────────────────────────────────────────
  const [regions, setRegions] = useState<AdminKenyaRegions>({});
  const [zones, setZones] = useState<AdminShippingZone[]>([]);
  const [methods, setMethods] = useState<AdminShippingMethod[]>([]);
  const [pickupLocations, setPickupLocations] = useState<AdminPickupLocation[]>([]);
  const [shipments, setShipments] = useState<AdminShipment[]>([]);
  const [couriers, setCouriers] = useState<AdminCourierConfig[]>([]);

  const [loading, setLoading] = useState(true);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [isAddPickupOpen, setIsAddPickupOpen] = useState(false);
  const [selectedZoneIdForRate, setSelectedZoneIdForRate] = useState<number | null>(null);

  const [zoneName, setZoneName] = useState('');
  const [zoneRegion, setZoneRegion] = useState('');
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);

  const [rateMethodName, setRateMethodName] = useState('');
  const [ratePrice, setRatePrice] = useState('');
  const [rateEta, setRateEta] = useState('2-3 business days');
  const [rateFreeThreshold, setRateFreeThreshold] = useState('');

  const [pickupName, setPickupName] = useState('');
  const [pickupType, setPickupType] = useState<'Locker' | 'Agent' | 'Store'>('Agent');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCounty, setPickupCounty] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupHours, setPickupHours] = useState('Mon-Sat 9am-7pm');

  const [trackingSearch, setTrackingSearch] = useState('');
  const [debouncedTrackingSearch, setDebouncedTrackingSearch] = useState('');

  const anyModalOpen = isAddZoneOpen || isAddRateOpen || isAddPickupOpen;

  // ── Toast auto-dismiss ──────────────────────────────────────────────
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // ── Modal Escape + body scroll lock ─────────────────────────────────
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddZoneOpen(false);
        setIsAddRateOpen(false);
        setIsAddPickupOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen]);

  // ── Initial fetch — everything except shipments ─────────────────────
  // Shipments fetch through their own effect so the debounced search
  // can drive a refetch without touching the rest.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [r, z, m, p, c] = await Promise.all([
          adminApi.shipping.regions(controller.signal),
          adminApi.shipping.zones.list(controller.signal),
          adminApi.shipping.methods.list(controller.signal),
          adminApi.shipping.pickups.list(controller.signal),
          adminApi.shipping.couriers.list(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setRegions(r);
        setZones(z);
        setMethods(m);
        setPickupLocations(p);
        setCouriers(c);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load shipping data.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // ── Debounce the tracking search ────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTrackingSearch(trackingSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [trackingSearch]);

  // ── Fetch shipments on mount and on debounced search change ─────────
  useEffect(() => {
    const controller = new AbortController();
    setShipmentsLoading(true);
    setShipmentsError(null);
    adminApi.shipping.shipments
      .list(debouncedTrackingSearch, controller.signal)
      .then((s) => {
        if (controller.signal.aborted) return;
        setShipments(s);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setShipmentsError(err instanceof Error ? err.message : 'Failed to load shipments.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setShipmentsLoading(false);
      });
    return () => controller.abort();
  }, [debouncedTrackingSearch]);

  // ── All counties, flattened from the regions map ────────────────────
  const allCounties = useMemo(() => {
    const set = new Set<string>();
    Object.values(regions).forEach((list) => list.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [regions]);

  // ── Derive default region and county once regions load ─────────────
  // The previous version hardcoded 'Nairobi'. If the backend's region
  // keys ever change, the Add Zone select shows no matching option and
  // submits a stale value. Deriving the default from the loaded map
  // removes that coupling.
  useEffect(() => {
    const keys = Object.keys(regions);
    if (keys.length === 0) return;
    if (!zoneRegion || !keys.includes(zoneRegion)) {
      setZoneRegion(keys[0]);
    }
  }, [regions, zoneRegion]);

  useEffect(() => {
    if (allCounties.length === 0) return;
    if (!pickupCounty || !allCounties.includes(pickupCounty)) {
      setPickupCounty(allCounties[0]);
    }
  }, [allCounties, pickupCounty]);

  // ── Active methods, derived ─────────────────────────────────────────
  const activeMethods = useMemo(
    () => methods.filter((m) => m.status === 'Active'),
    [methods],
  );

  // ── Seed the Add Rate dropdown when active methods load ────────────
  // Seed ONLY when there is an active method. If every method is
  // disabled, leave `rateMethodName` empty so the Save button stays
  // disabled — a disabled method must not be offered for a new rate.
  useEffect(() => {
    if (activeMethods.length > 0 && !rateMethodName) {
      setRateMethodName(activeMethods[0].name);
    }
    // If the seeded method is no longer active (e.g. methods reloaded),
    // reset it so the dropdown and state stay consistent.
    if (rateMethodName && !activeMethods.some((m) => m.name === rateMethodName)) {
      setRateMethodName(activeMethods[0]?.name ?? '');
    }
  }, [activeMethods, rateMethodName]);

  const showToast = (msg: string) => setToastMessage(msg);

  // ── Open the Add Rate modal with fresh form state ──────────────────
  const openAddRate = (zoneId: number) => {
    setSelectedZoneIdForRate(zoneId);
    setRatePrice('');
    setRateFreeThreshold('');
    setRateEta('2-3 business days');
    setRateMethodName(activeMethods[0]?.name ?? '');
    setIsAddRateOpen(true);
  };

  // ── Open the Add Zone modal with fresh form state ──────────────────
  const openAddZone = () => {
    setZoneName('');
    setSelectedCounties([]);
    const keys = Object.keys(regions);
    setZoneRegion(keys[0] ?? '');
    setIsAddZoneOpen(true);
  };

  // ── Open the Add Pickup modal with fresh form state ────────────────
  const openAddPickup = () => {
    setPickupName('');
    setPickupType('Agent');
    setPickupAddress('');
    setPickupPhone('');
    setPickupHours('Mon-Sat 9am-7pm');
    setPickupCounty(allCounties[0] ?? '');
    setIsAddPickupOpen(true);
  };

  // ═════════════════════════════════════════════════════════════════════
  // Mutations
  // ═════════════════════════════════════════════════════════════════════

  const saveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!zoneName.trim()) {
      showToast('Zone name is required');
      return;
    }
    if (!zoneRegion) {
      showToast('Select a region — the region list has not loaded yet');
      return;
    }
    setBusy(true);
    try {
      const newZone = await adminApi.shipping.zones.create({
        name: zoneName,
        region: zoneRegion,
        counties: selectedCounties.length > 0 ? selectedCounties : [zoneRegion],
      });
      setZones((prev) => [newZone, ...prev]);
      setIsAddZoneOpen(false);
      setZoneName('');
      setSelectedCounties([]);
      showToast(`Zone "${newZone.name}" created`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create zone');
    } finally {
      setBusy(false);
    }
  };

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (selectedZoneIdForRate === null) {
      showToast('No zone selected');
      return;
    }
    if (!rateMethodName) {
      showToast('No active method available — enable a method first');
      return;
    }
    if (!ratePrice) {
      showToast('Price is required');
      return;
    }
    setBusy(true);
    try {
      const updatedZone = await adminApi.shipping.zones.addRate(selectedZoneIdForRate, {
        methodName: rateMethodName,
        price: ratePrice,
        eta: rateEta || '2-3 days',
        freeShippingThreshold: rateFreeThreshold ? Number(rateFreeThreshold) : null,
      });
      setZones((prev) => prev.map((z) => (z.id === updatedZone.id ? updatedZone : z)));
      setIsAddRateOpen(false);
      setRatePrice('');
      setRateFreeThreshold('');
      showToast('Shipping rate added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add rate');
    } finally {
      setBusy(false);
    }
  };

  const savePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!pickupName.trim() || !pickupAddress.trim()) {
      showToast('Name and address are required');
      return;
    }
    if (!pickupCounty) {
      showToast('No county available — the region list has not loaded yet');
      return;
    }
    setBusy(true);
    try {
      const newLoc = await adminApi.shipping.pickups.create({
        name: pickupName,
        type: pickupType,
        address: pickupAddress,
        county: pickupCounty,
        phone: pickupPhone,
        hours: pickupHours,
      });
      setPickupLocations((prev) => [newLoc, ...prev]);
      setIsAddPickupOpen(false);
      setPickupName('');
      setPickupAddress('');
      setPickupPhone('');
      showToast(`Pickup location "${newLoc.name}" added`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add pickup');
    } finally {
      setBusy(false);
    }
  };

  const deleteRate = async (zoneId: number, rateId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await adminApi.shipping.zones.removeRate(zoneId, rateId);
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? { ...z, rates: z.rates.filter((r) => r.id !== rateId) }
            : z
        )
      );
      showToast('Rate deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete rate');
    } finally {
      setBusy(false);
    }
  };

  const deleteZone = async (zoneId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await adminApi.shipping.zones.remove(zoneId);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      showToast('Zone deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete zone');
    } finally {
      setBusy(false);
    }
  };

  const deletePickup = async (id: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await adminApi.shipping.pickups.remove(id);
      setPickupLocations((prev) => prev.filter((p) => p.id !== id));
      showToast('Pickup location deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete pickup');
    } finally {
      setBusy(false);
    }
  };

  const toggleMethodStatus = async (id: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await adminApi.shipping.methods.toggle(id);
      setMethods((prev) => prev.map((m) => (m.id === id ? updated : m)));
      showToast(`${updated.name} is now ${updated.status.toLowerCase()}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle method');
    } finally {
      setBusy(false);
    }
  };

  const togglePickupStatus = async (id: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await adminApi.shipping.pickups.toggle(id);
      setPickupLocations((prev) => prev.map((p) => (p.id === id ? updated : p)));
      showToast(`${updated.name} is now ${updated.status.toLowerCase()}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle pickup');
    } finally {
      setBusy(false);
    }
  };

  const toggleCourier = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await adminApi.shipping.couriers.toggle(id);
      setCouriers((prev) => prev.map((c) => (c.id === id ? updated : c)));
      showToast(`${updated.name} ${updated.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle courier');
    } finally {
      setBusy(false);
    }
  };

  const testCourier = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await adminApi.shipping.couriers.test(id);
      showToast(result.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setBusy(false);
    }
  };

  const updateShipmentStatus = async (id: number, status: ShipmentStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await adminApi.shipping.shipments.setStatus(id, status);
      setShipments((prev) => prev.map((s) => (s.id === id ? updated : s)));
      showToast(`Shipment status updated to ${updated.status}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update shipment');
    } finally {
      setBusy(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  // Derived
  // ═════════════════════════════════════════════════════════════════════

  const statusBadge = (s: ShipmentStatus) =>
    s === 'Delivered'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'In Transit' || s === 'Out for Delivery' || s === 'Picked Up'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Pending' || s === 'Label Created'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : 'bg-red-50 text-red-600 border-red-100';

  const regionCounties = regions[zoneRegion] || [];

  // ═════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Shipping</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage delivery zones, rates, methods, pickup locations, tracking, and couriers
            </p>
          </div>
          <button
            onClick={openAddZone}
            disabled={loading || busy}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add zone</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* INITIAL LOAD ERROR */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="text-[13px]">
              <p className="font-medium text-red-800">Could not load shipping data</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-[13px] font-medium text-red-800 hover:underline whitespace-nowrap"
            >
              Reload
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-400 text-[13px]">
            Loading shipping configuration…
          </div>
        ) : (
          <>
            {/* TABS */}
            <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5 overflow-x-auto max-w-full">
              {(['Zones & Rates', 'Methods', 'Pickup Locations', 'Tracking', 'Providers'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${activeTab === tab ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB 1: ZONES */}
            {activeTab === 'Zones & Rates' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {zones.length === 0 ? (
                  <div className="col-span-full bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-400 text-[13px]">
                    No shipping zones yet. Add one to get started.
                  </div>
                ) : (
                  zones.map((zone) => (
                    <div key={zone.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-9 h-9 rounded-sm bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-950 shrink-0">
                            <MapPin className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{zone.name}</p>
                            <p className="text-[13px] text-slate-500">
                              {zone.region} · {zone.counties.length} counties
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteZone(zone.id)}
                          disabled={busy}
                          className="p-1.5 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition shrink-0"
                          title="Delete zone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {zone.counties.map((c) => (
                          <span
                            key={c}
                            className="bg-slate-100 text-slate-700 text-[13px] font-medium px-1.5 py-0.5 rounded-sm"
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[13px] font-medium text-slate-500">Shipping rates</p>
                          <button
                            onClick={() => openAddRate(zone.id)}
                            disabled={busy}
                            className="text-[13px] font-medium text-blue-950 hover:underline disabled:opacity-40 inline-flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" />
                            Add rate
                          </button>
                        </div>

                        {zone.rates.length === 0 ? (
                          <p className="text-[13px] text-slate-400 py-2">No rates in this zone.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {zone.rates.map((rate) => (
                              <div
                                key={rate.id}
                                className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between text-[13px] gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-slate-900 truncate">
                                      {rate.methodName}
                                    </span>
                                    {rate.freeShippingThreshold !== null && (
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[13px] font-medium px-1.5 py-0.5 rounded-sm">
                                        Free over KES {rate.freeShippingThreshold.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[13px] text-slate-500 mt-0.5 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {rate.eta}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-medium text-slate-900">
                                    {rate.price === 0 ? 'Free' : `KES ${rate.price.toLocaleString()}`}
                                  </span>
                                  <button
                                    onClick={() => deleteRate(zone.id, rate.id)}
                                    disabled={busy}
                                    className="p-1 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition"
                                    title="Delete rate"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: METHODS */}
            {activeTab === 'Methods' && (
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                  <p className="text-[13px] font-medium text-slate-700">Available delivery methods</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-3 font-medium">Method</th>
                        <th className="py-2 px-3 font-medium">Description</th>
                        <th className="py-2 px-3 font-medium text-right">Price</th>
                        <th className="py-2 px-3 font-medium">ETA</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                        <th className="py-2 px-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {methods.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 text-[13px]">
                            No delivery methods configured.
                          </td>
                        </tr>
                      ) : (
                        methods.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-blue-950" />
                                <span className="font-medium text-slate-900">{m.name}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-500">{m.description}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-900">
                              KES {m.defaultPrice.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{m.eta}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${m.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}
                              >
                                {m.status}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() => toggleMethodStatus(m.id)}
                                disabled={busy}
                                className={`w-full px-2.5 py-2 rounded-sm font-medium text-[13px] disabled:opacity-40 transition ${m.status === 'Active'
                                  ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                                  : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  }`}
                              >
                                {m.status === 'Active' ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: PICKUP LOCATIONS */}
            {activeTab === 'Pickup Locations' && (
              <>
                <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">Pickup locations</p>
                    <p className="text-[13px] text-slate-500">
                      Neighborhood agents, lockers, and physical stores
                    </p>
                  </div>
                  <button
                    onClick={openAddPickup}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add location
                  </button>
                </div>

                {pickupLocations.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-400 text-[13px]">
                    No pickup locations yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {pickupLocations.map((loc) => (
                      <div key={loc.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 border ${loc.type === 'Locker'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                : loc.type === 'Store'
                                  ? 'bg-blue-50 text-blue-950 border-blue-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}
                            >
                              {loc.type === 'Locker' ? (
                                <Box className="w-4 h-4" />
                              ) : loc.type === 'Store' ? (
                                <Building2 className="w-4 h-4" />
                              ) : (
                                <Store className="w-4 h-4" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-slate-900 truncate">{loc.name}</p>
                              <p className="text-[13px] text-slate-500">
                                {loc.type} · {loc.county}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => deletePickup(loc.id)}
                            disabled={busy}
                            className="p-1.5 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition shrink-0"
                            title="Delete location"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-1 text-[13px]">
                          <p className="text-slate-700">{loc.address}</p>
                          <p className="text-slate-500 font-mono">{loc.phone}</p>
                          <p className="text-slate-500 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {loc.hours}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${loc.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                          >
                            {loc.status}
                          </span>
                          <button
                            onClick={() => togglePickupStatus(loc.id)}
                            disabled={busy}
                            className={`px-2.5 py-1.5 rounded-sm font-medium text-[13px] disabled:opacity-40 transition ${loc.status === 'Active'
                              ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                              : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                          >
                            {loc.status === 'Active' ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* TAB 4: TRACKING */}
            {activeTab === 'Tracking' && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by order #, tracking #, customer, destination…"
                      value={trackingSearch}
                      onChange={(e) => setTrackingSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>
                  <span className="text-[13px] text-slate-500 lg:ml-2">
                    {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {shipmentsError && (
                  <div className="bg-red-50 border border-red-200 rounded-sm p-2 text-[13px]">
                    <p className="font-medium text-red-800">Could not load shipments</p>
                    <p className="text-red-700 mt-0.5">{shipmentsError}</p>
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <p className="text-[13px] font-medium text-slate-700">Order shipment status</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Order #</th>
                          <th className="py-2 px-3 font-medium">Customer</th>
                          <th className="py-2 px-3 font-medium">Method</th>
                          <th className="py-2 px-3 font-medium">Provider</th>
                          <th className="py-2 px-3 font-medium">Tracking #</th>
                          <th className="py-2 px-3 font-medium">Destination</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                          <th className="py-2 px-3 font-medium">Updated</th>
                          <th className="py-2 px-3 w-44"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shipmentsLoading && shipments.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                              Loading shipments…
                            </td>
                          </tr>
                        ) : shipments.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                              No shipments match your search.
                            </td>
                          </tr>
                        ) : (
                          shipments.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2 px-3 font-mono font-medium text-blue-950">
                                {s.orderNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-900 truncate max-w-[160px]">
                                {s.customerName}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{s.method}</td>
                              <td className="py-2 px-3 text-slate-600">{s.provider}</td>
                              <td className="py-2 px-3 font-mono text-slate-700">{s.trackingNumber}</td>
                              <td className="py-2 px-3 text-slate-600 inline-flex items-center gap-1">
                                <Navigation className="w-3 h-3 text-slate-400" />
                                {s.destination}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                                    s.status
                                  )}`}
                                >
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-400">{s.updatedAt}</td>
                              <td className="py-2 px-3">
                                <select
                                  value={s.status}
                                  onChange={(e) =>
                                    updateShipmentStatus(s.id, e.target.value as ShipmentStatus)
                                  }
                                  disabled={busy}
                                  className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-40"
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Label Created">Label Created</option>
                                  <option value="Picked Up">Picked Up</option>
                                  <option value="In Transit">In Transit</option>
                                  <option value="Out for Delivery">Out for Delivery</option>
                                  <option value="Delivered">Delivered</option>
                                  <option value="Failed">Failed</option>
                                  <option value="Returned">Returned</option>
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PROVIDERS */}
            {activeTab === 'Providers' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {couriers.length === 0 ? (
                  <div className="col-span-full bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-400 text-[13px]">
                    No courier integrations configured.
                  </div>
                ) : (
                  couriers.map((courier) => (
                    <div key={courier.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-10 h-10 rounded-sm ${courier.logoBg} flex items-center justify-center text-white font-semibold text-[13px] shrink-0`}
                          >
                            {courier.name.charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{courier.name}</p>
                            <span
                              className={`inline-block text-[13px] font-medium px-1.5 py-0.5 rounded-sm ${courier.enabled
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                              {courier.enabled ? 'Connected' : 'Disconnected'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[13px] text-slate-500">{courier.description}</p>

                        <div className="flex flex-wrap gap-1">
                          {courier.regions.slice(0, 3).map((r) => (
                            <span
                              key={r}
                              className="bg-slate-100 text-slate-700 text-[13px] font-medium px-1.5 py-0.5 rounded-sm"
                            >
                              {r}
                            </span>
                          ))}
                          {courier.regions.length > 3 && (
                            <span className="bg-slate-100 text-slate-500 text-[13px] font-medium px-1.5 py-0.5 rounded-sm">
                              +{courier.regions.length - 3}
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="flex items-center gap-1 text-[13px] font-medium text-slate-700 mb-1">
                            <Key className="w-3 h-3 text-slate-400" />
                            API key / secret
                          </label>
                          <input
                            type="password"
                            readOnly
                            value={courier.apiKey}
                            className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-700"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-[13px] font-medium text-slate-700">Enable integration</span>
                          <input
                            type="checkbox"
                            checked={courier.enabled}
                            onChange={() => toggleCourier(courier.id)}
                            disabled={busy}
                            className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer disabled:opacity-40"
                          />
                        </label>

                        <button
                          onClick={() => testCourier(courier.id)}
                          disabled={!courier.enabled || busy}
                          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px] disabled:opacity-40 inline-flex items-center justify-center gap-1.5 transition"
                        >
                          <Zap className="w-3.5 h-3.5 text-blue-950" />
                          Test connection
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ADD ZONE MODAL */}
      {isAddZoneOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsAddZoneOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </span>
                <p className="text-[15px] font-semibold text-slate-900">Add shipping zone</p>
              </div>
              <button
                onClick={() => setIsAddZoneOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveZone} className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Zone name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rift Valley Region"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Region</label>
                <select
                  value={zoneRegion}
                  onChange={(e) => {
                    setZoneRegion(e.target.value);
                    setSelectedCounties([]);
                  }}
                  disabled={Object.keys(regions).length === 0}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-50"
                >
                  {Object.keys(regions).length === 0 ? (
                    <option value="">No regions available</option>
                  ) : (
                    Object.keys(regions).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Select counties in {zoneRegion || '—'}
                </label>
                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-sm p-1 bg-white space-y-0.5">
                  {regionCounties.length === 0 ? (
                    <p className="text-[13px] text-slate-400 p-2">
                      No counties — select a region above.
                    </p>
                  ) : (
                    regionCounties.map((county) => {
                      const selected = selectedCounties.includes(county);
                      return (
                        <button
                          type="button"
                          key={county}
                          onClick={() =>
                            setSelectedCounties((prev) =>
                              selected ? prev.filter((c) => c !== county) : [...prev, county]
                            )
                          }
                          className={`w-full text-left px-2 py-2 rounded-sm flex items-center justify-between transition text-[13px] ${selected
                            ? 'bg-blue-50 text-blue-950 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span>{county}</span>
                          {selected ? (
                            <CheckSquare className="w-4 h-4 text-blue-950" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddZoneOpen(false)}
                  disabled={busy}
                  className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || Object.keys(regions).length === 0}
                  className="bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  {busy ? 'Saving…' : 'Save zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD RATE MODAL */}
      {isAddRateOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsAddRateOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </span>
                <p className="text-[15px] font-semibold text-slate-900">Add shipping rate</p>
              </div>
              <button
                onClick={() => setIsAddRateOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveRate} className="p-3 space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Method</label>
                <select
                  value={rateMethodName}
                  onChange={(e) => setRateMethodName(e.target.value)}
                  disabled={activeMethods.length === 0}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-50"
                >
                  {activeMethods.length === 0 ? (
                    <option value="">
                      No active methods — enable one on the Methods tab first
                    </option>
                  ) : (
                    activeMethods.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Price (KES) *</label>
                  <input
                    type="number"
                    required
                    placeholder="300"
                    value={ratePrice}
                    onChange={(e) => setRatePrice(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ETA</label>
                  <input
                    type="text"
                    placeholder="2-3 days"
                    value={rateEta}
                    onChange={(e) => setRateEta(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Free shipping threshold (optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={rateFreeThreshold}
                  onChange={(e) => setRateFreeThreshold(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
                <p className="text-[13px] text-slate-400 mt-1">
                  Customers shipping over this amount pay nothing.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddRateOpen(false)}
                  disabled={busy}
                  className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || activeMethods.length === 0}
                  className="bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  {busy ? 'Saving…' : 'Save rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PICKUP MODAL */}
      {isAddPickupOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsAddPickupOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </span>
                <p className="text-[15px] font-semibold text-slate-900">Add pickup location</p>
              </div>
              <button
                onClick={() => setIsAddPickupOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={savePickup} className="p-3 space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Location name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pickup Mtaani - Westlands"
                  value={pickupName}
                  onChange={(e) => setPickupName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={pickupType}
                    onChange={(e) => setPickupType(e.target.value as 'Locker' | 'Agent' | 'Store')}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    <option value="Agent">Agent</option>
                    <option value="Locker">Locker</option>
                    <option value="Store">Store</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">County</label>
                  <select
                    value={pickupCounty}
                    onChange={(e) => setPickupCounty(e.target.value)}
                    disabled={allCounties.length === 0}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-50"
                  >
                    {allCounties.length === 0 ? (
                      <option value="">No counties available</option>
                    ) : (
                      allCounties.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Westlands Square, Shop G12"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+254 712 000 111"
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hours</label>
                  <input
                    type="text"
                    placeholder="Mon-Sat 9am-7pm"
                    value={pickupHours}
                    onChange={(e) => setPickupHours(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPickupOpen(false)}
                  disabled={busy}
                  className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || allCounties.length === 0}
                  className="bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  {busy ? 'Saving…' : 'Save location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}