'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

// --- TYPES ---
type ShippingTab = 'Zones & Rates' | 'Methods' | 'Courier Integration';

interface ShippingRate {
  id: string;
  methodName: string;
  price: number;
  eta: string;
  freeShippingThreshold?: number;
}

interface ShippingZone {
  id: string;
  name: string;
  counties: string[];
  rates: ShippingRate[];
}

interface ShippingMethodItem {
  id: string;
  name: string;
  defaultPrice: number;
  eta: string;
  status: 'Active' | 'Disabled';
  description: string;
}

interface CourierConfig {
  id: string;
  name: string;
  logoBg: string;
  description: string;
  apiKey: string;
  enabled: boolean;
}

const INITIAL_ZONES: ShippingZone[] = [
  {
    id: 'zone-1',
    name: 'Nairobi Metropolitan',
    counties: ['Nairobi', 'Kiambu', 'Kajiado', 'Machakos'],
    rates: [
      { id: 'rate-1', methodName: 'Standard Delivery', price: 250, eta: '1 - 2 business days', freeShippingThreshold: 3000 },
      { id: 'rate-2', methodName: 'Express Boda', price: 450, eta: 'Same day (2-4 hrs)', freeShippingThreshold: 6000 },
      { id: 'rate-3', methodName: 'Store pickup', price: 0, eta: 'Ready in 1 hr' },
    ],
  },
  {
    id: 'zone-2',
    name: 'Coastal Region',
    counties: ['Mombasa', 'Kilifi', 'Kwale', 'Lamu'],
    rates: [
      { id: 'rate-4', methodName: 'Courier shipping', price: 550, eta: '2 - 3 business days', freeShippingThreshold: 8000 },
      { id: 'rate-5', methodName: 'Express air', price: 950, eta: 'Next day delivery' },
    ],
  },
  {
    id: 'zone-3',
    name: 'Other Counties',
    counties: ['Nakuru', 'Kisumu', 'Eldoret', 'Nyeri', 'Kisii', 'Meru'],
    rates: [
      { id: 'rate-6', methodName: 'Nationwide bus / parcel', price: 400, eta: '2 - 4 business days', freeShippingThreshold: 7000 },
    ],
  },
];

const INITIAL_METHODS: ShippingMethodItem[] = [
  { id: 'm-1', name: 'Standard Delivery', defaultPrice: 300, eta: '2-3 days', status: 'Active', description: 'Standard regional courier delivery to door' },
  { id: 'm-2', name: 'Express Boda', defaultPrice: 500, eta: 'Same day', status: 'Active', description: 'Fast motorcycle dispatch within metropolitan areas' },
  { id: 'm-3', name: 'Pickup Mtaani / Locker', defaultPrice: 200, eta: '1-2 days', status: 'Active', description: 'Secure neighborhood pickup agents & lockers' },
  { id: 'm-4', name: 'Freight / Bulk Cargo', defaultPrice: 1500, eta: '3-5 days', status: 'Disabled', description: 'Heavy machinery & large order pallet shipping' },
];

const INITIAL_COURIERS: CourierConfig[] = [
  { id: 'sendy', name: 'Sendy Fulfillment', logoBg: 'bg-amber-500', description: 'Automated dispatch, motorcycle & truck fulfillment across Kenya.', apiKey: 'snd_live_99812736481029384', enabled: true },
  { id: 'glovo', name: 'Glovo Express', logoBg: 'bg-yellow-400', description: 'Instant on-demand multi-category delivery for quick commerce.', apiKey: 'glv_live_88372649102938475', enabled: true },
  { id: 'pickupmtaani', name: 'Pickup Mtaani', logoBg: 'bg-emerald-600', description: 'Affordable peer-to-peer neighborhood pickup stations.', apiKey: 'pum_test_11223344556677889', enabled: false },
];

const KENYA_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret / Uasin Gishu',
  'Kiambu', 'Machakos', 'Kajiado', 'Nyeri', 'Meru', 'Kilifi', 'Kwale',
  'Kisii', 'Kakamega', 'Bungoma', 'Kericho', "Murang'a", 'Kitui',
];

export default function ShippingPage() {
  const [activeTab, setActiveTab] = useState<ShippingTab>('Zones & Rates');
  const [zones, setZones] = useState<ShippingZone[]>(INITIAL_ZONES);
  const [methods, setMethods] = useState<ShippingMethodItem[]>(INITIAL_METHODS);
  const [couriers, setCouriers] = useState<CourierConfig[]>(INITIAL_COURIERS);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [selectedZoneIdForRate, setSelectedZoneIdForRate] = useState('');

  const [zoneName, setZoneName] = useState('');
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);

  const [rateMethodName, setRateMethodName] = useState('Standard Delivery');
  const [ratePrice, setRatePrice] = useState('');
  const [rateEta, setRateEta] = useState('2-3 business days');
  const [rateFreeThreshold, setRateFreeThreshold] = useState('');

  const anyModalOpen = isAddZoneOpen || isAddRateOpen;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddZoneOpen(false);
        setIsAddRateOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen]);

  const showToast = (msg: string) => setToastMessage(msg);

  const saveZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;
    const newZone: ShippingZone = {
      id: `zone-${Date.now()}`,
      name: zoneName,
      counties: selectedCounties.length > 0 ? selectedCounties : ['Nairobi'],
      rates: [
        { id: `rate-${Date.now()}`, methodName: 'Standard Delivery', price: 300, eta: '2-3 business days', freeShippingThreshold: 5000 },
      ],
    };
    setZones([newZone, ...zones]);
    setIsAddZoneOpen(false);
    setZoneName('');
    setSelectedCounties([]);
    showToast(`Zone "${newZone.name}" created`);
  };

  const saveRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZoneIdForRate || !ratePrice) return;
    const newRate: ShippingRate = {
      id: `rate-${Date.now()}`,
      methodName: rateMethodName,
      price: Number(ratePrice) || 0,
      eta: rateEta || '2-3 days',
      freeShippingThreshold: rateFreeThreshold ? Number(rateFreeThreshold) : undefined,
    };
    setZones((prev) =>
      prev.map((z) => (z.id === selectedZoneIdForRate ? { ...z, rates: [...z.rates, newRate] } : z))
    );
    setIsAddRateOpen(false);
    setRatePrice('');
    setRateFreeThreshold('');
    showToast('Shipping rate added');
  };

  const deleteRate = (zoneId: string, rateId: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, rates: z.rates.filter((r) => r.id !== rateId) } : z))
    );
    showToast('Rate deleted');
  };

  const deleteZone = (zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    showToast('Zone deleted');
  };

  const toggleMethodStatus = (id: string) => {
    setMethods((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = m.status === 'Active' ? 'Disabled' : 'Active';
        showToast(`${m.name} is now ${next.toLowerCase()}`);
        return { ...m, status: next };
      })
    );
  };

  const toggleCourier = (id: string) => {
    setCouriers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = !c.enabled;
        showToast(`${c.name} ${next ? 'enabled' : 'disabled'}`);
        return { ...c, enabled: next };
      })
    );
  };

  const testCourier = (name: string) => showToast(`${name} API responded 200 OK (114ms)`);

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
              Manage delivery zones, rates, methods, and courier integrations
            </p>
          </div>
          <button
            onClick={() => setIsAddZoneOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add zone</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* TABS */}
        <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5">
          {(['Zones & Rates', 'Methods', 'Courier Integration'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition ${
                activeTab === tab ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB 1: ZONES */}
        {activeTab === 'Zones & Rates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {zones.map((zone) => (
              <div key={zone.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-9 h-9 rounded-sm bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-950 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate">{zone.name}</p>
                      <p className="text-[13px] text-slate-500">
                        {zone.counties.length} counties covered
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteZone(zone.id)}
                    className="p-1.5 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
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
                      onClick={() => {
                        setSelectedZoneIdForRate(zone.id);
                        setIsAddRateOpen(true);
                      }}
                      className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      Add rate
                    </button>
                  </div>

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
                            {rate.freeShippingThreshold && (
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
                            className="p-1 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete rate"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
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
                  {methods.map((m) => (
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
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                            m.status === 'Active'
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
                          className={`w-full px-2.5 py-2 rounded-sm font-medium text-[13px] transition ${
                            m.status === 'Active'
                              ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                              : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {m.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: COURIERS */}
        {activeTab === 'Courier Integration' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {couriers.map((courier) => (
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
                        className={`inline-block text-[13px] font-medium px-1.5 py-0.5 rounded-sm ${
                          courier.enabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {courier.enabled ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[13px] text-slate-500">{courier.description}</p>

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
                      className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                    />
                  </label>

                  <button
                    onClick={() => testCourier(courier.name)}
                    disabled={!courier.enabled}
                    className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px] disabled:opacity-40 inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Zap className="w-3.5 h-3.5 text-blue-950" />
                    Test connection
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                <label className="block font-medium text-slate-700 mb-1">Select counties</label>
                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-sm p-1 bg-white space-y-0.5">
                  {KENYA_COUNTIES.map((county) => {
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
                        className={`w-full text-left px-2 py-2 rounded-sm flex items-center justify-between transition text-[13px] ${
                          selected
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
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddZoneOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Save zone
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
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="Standard Delivery">Standard delivery</option>
                  <option value="Express Boda">Express boda</option>
                  <option value="Store Pickup">Store pickup</option>
                  <option value="Courier Shipping">Courier shipping</option>
                  <option value="Nationwide Bus / Parcel">Nationwide bus / parcel</option>
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
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Save rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}