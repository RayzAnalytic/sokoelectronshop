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
  Package,
  Navigation,
  Store,
  Search,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Box,
  Route,
  Building2,
} from 'lucide-react';

// --- TYPES ---
type ShippingTab =
  | 'Zones & Rates'
  | 'Methods'
  | 'Pickup Locations'
  | 'Tracking'
  | 'Providers';

type ShipmentStatus =
  | 'Pending'
  | 'Label Created'
  | 'Picked Up'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Failed'
  | 'Returned';

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
  region: string;
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

interface PickupLocation {
  id: string;
  name: string;
  type: 'Locker' | 'Agent' | 'Store';
  address: string;
  county: string;
  phone: string;
  hours: string;
  status: 'Active' | 'Disabled';
}

interface Shipment {
  id: string;
  orderNumber: string;
  customerName: string;
  method: string;
  provider: string;
  trackingNumber: string;
  status: ShipmentStatus;
  destination: string;
  updatedAt: string;
}

interface CourierConfig {
  id: string;
  name: string;
  logoBg: string;
  description: string;
  apiKey: string;
  enabled: boolean;
  regions: string[];
}

// --- KENYA REGIONS ---
const KENYA_REGIONS: Record<string, string[]> = {
  Nairobi: ['Nairobi'],
  'Central Kenya': ['Kiambu', 'Murang\'a', 'Nyeri', 'Kirinyaga', 'Nyandarua'],
  Coast: ['Mombasa', 'Kilifi', 'Kwale', 'Lamu', 'Tana River', 'Taita Taveta'],
  Western: ['Kakamega', 'Bungoma', 'Busia', 'Vihiga'],
  'Rift Valley': ['Nakuru', 'Uasin Gishu', 'Trans Nzoia', 'Nandi', 'Kericho', 'Bomet', 'Laikipia', 'Elgeyo Marakwet', 'West Pokot', 'Samburu', 'Turkana', 'Narok', 'Kajiado'],
  Nyanza: ['Kisumu', 'Homa Bay', 'Migori', 'Kisii', 'Nyamira', 'Siaya'],
  'North Eastern': ['Garissa', 'Wajir', 'Mandera', 'Isiolo', 'Marsabit'],
  'Eastern': ['Machakos', 'Kitui', 'Makueni', 'Embu', 'Tharaka Nithi', 'Meru', 'Marsabit'],
};

const ALL_COUNTIES = Object.values(KENYA_REGIONS).flat().sort();

const INITIAL_ZONES: ShippingZone[] = [
  {
    id: 'zone-1',
    name: 'Nairobi Metropolitan',
    region: 'Nairobi',
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
    region: 'Coast',
    counties: ['Mombasa', 'Kilifi', 'Kwale', 'Lamu'],
    rates: [
      { id: 'rate-4', methodName: 'Courier shipping', price: 550, eta: '2 - 3 business days', freeShippingThreshold: 8000 },
      { id: 'rate-5', methodName: 'Express air', price: 950, eta: 'Next day delivery' },
    ],
  },
  {
    id: 'zone-3',
    name: 'Rift Valley Region',
    region: 'Rift Valley',
    counties: ['Nakuru', 'Uasin Gishu', 'Nandi', 'Kericho'],
    rates: [
      { id: 'rate-6', methodName: 'Nationwide bus / parcel', price: 400, eta: '2 - 4 business days', freeShippingThreshold: 7000 },
    ],
  },
  {
    id: 'zone-4',
    name: 'Western Region',
    region: 'Western',
    counties: ['Kakamega', 'Bungoma', 'Busia', 'Vihiga'],
    rates: [
      { id: 'rate-7', methodName: 'Nationwide bus / parcel', price: 450, eta: '2 - 4 business days', freeShippingThreshold: 7000 },
    ],
  },
  {
    id: 'zone-5',
    name: 'Nyanza Region',
    region: 'Nyanza',
    counties: ['Kisumu', 'Kisii', 'Homa Bay', 'Migori'],
    rates: [
      { id: 'rate-8', methodName: 'Nationwide bus / parcel', price: 450, eta: '2 - 4 business days', freeShippingThreshold: 7000 },
    ],
  },
  {
    id: 'zone-6',
    name: 'Central Kenya Region',
    region: 'Central Kenya',
    counties: ['Nyeri', 'Murang\'a', 'Kirinyaga', 'Nyandarua'],
    rates: [
      { id: 'rate-9', methodName: 'Standard Delivery', price: 350, eta: '2 - 3 business days', freeShippingThreshold: 5000 },
    ],
  },
  {
    id: 'zone-7',
    name: 'North Eastern Region',
    region: 'North Eastern',
    counties: ['Garissa', 'Wajir', 'Mandera'],
    rates: [
      { id: 'rate-10', methodName: 'Nationwide bus / parcel', price: 700, eta: '3 - 5 business days', freeShippingThreshold: 10000 },
    ],
  },
];

const INITIAL_METHODS: ShippingMethodItem[] = [
  { id: 'm-1', name: 'Standard Delivery', defaultPrice: 300, eta: '2-3 days', status: 'Active', description: 'Standard regional courier delivery to door' },
  { id: 'm-2', name: 'Express Boda', defaultPrice: 500, eta: 'Same day', status: 'Active', description: 'Fast motorcycle dispatch within metropolitan areas' },
  { id: 'm-3', name: 'Pickup Mtaani / Locker', defaultPrice: 200, eta: '1-2 days', status: 'Active', description: 'Secure neighborhood pickup agents & lockers' },
  { id: 'm-4', name: 'Freight / Bulk Cargo', defaultPrice: 1500, eta: '3-5 days', status: 'Disabled', description: 'Heavy machinery & large order pallet shipping' },
  { id: 'm-5', name: 'Nationwide Bus / Parcel', defaultPrice: 400, eta: '2-4 days', status: 'Active', description: 'Affordable bus parcel services to major towns' },
];

const INITIAL_PICKUP_LOCATIONS: PickupLocation[] = [
  { id: 'pl-1', name: 'Pickup Mtaani - Westlands', type: 'Agent', address: 'Westlands Square, Shop G12', county: 'Nairobi', phone: '+254 712 000 111', hours: 'Mon-Sat 8am-8pm', status: 'Active' },
  { id: 'pl-2', name: 'Pickup Mtaani - Thika Road', type: 'Agent', address: 'TRM Mall, Ground Floor', county: 'Nairobi', phone: '+254 712 000 222', hours: 'Mon-Sun 9am-9pm', status: 'Active' },
  { id: 'pl-3', name: 'SokoFlow Locker - CBD', type: 'Locker', address: 'Kimathi Street, Bihi Towers', county: 'Nairobi', phone: '+254 712 000 333', hours: '24/7', status: 'Active' },
  { id: 'pl-4', name: 'Pickup Mtaani - Mombasa', type: 'Agent', address: 'Nyali Centre, Shop 22', county: 'Mombasa', phone: '+254 712 000 444', hours: 'Mon-Sat 9am-7pm', status: 'Active' },
  { id: 'pl-5', name: 'SokoFlow Store - Kisumu', type: 'Store', address: 'Mega Plaza, 2nd Floor', county: 'Kisumu', phone: '+254 712 000 555', hours: 'Mon-Sat 9am-6pm', status: 'Active' },
  { id: 'pl-6', name: 'Pickup Mtaani - Nakuru', type: 'Agent', address: 'Westside Mall, Shop 14', county: 'Nakuru', phone: '+254 712 000 666', hours: 'Mon-Sat 9am-7pm', status: 'Disabled' },
];

const INITIAL_SHIPMENTS: Shipment[] = [
  { id: 'sh-1', orderNumber: '#SKO-9842', customerName: 'Isaac Mutinda', method: 'Standard Delivery', provider: 'Sendy', trackingNumber: 'SND-49302', status: 'In Transit', destination: 'Nyeri', updatedAt: '2026-09-23 14:20' },
  { id: 'sh-2', orderNumber: '#SKO-9843', customerName: 'Amina Mohamed', method: 'Express Boda', provider: 'Glovo', trackingNumber: 'GLV-88210', status: 'Out for Delivery', destination: 'Westlands, Nairobi', updatedAt: '2026-09-23 15:05' },
  { id: 'sh-3', orderNumber: '#SKO-9845', customerName: 'Grace Wanjiku', method: 'Standard Delivery', provider: 'Sendy', trackingNumber: 'SND-49303', status: 'Picked Up', destination: 'Karen, Nairobi', updatedAt: '2026-09-23 11:30' },
  { id: 'sh-4', orderNumber: '#SKO-9846', customerName: 'David Kiprop', method: 'Nationwide Bus / Parcel', provider: 'Easy Coach', trackingNumber: 'EC-11223', status: 'Delivered', destination: 'Eldoret', updatedAt: '2026-09-22 10:30' },
  { id: 'sh-5', orderNumber: '#SKO-9847', customerName: 'Fatuma Ali', method: 'Courier shipping', provider: 'G4S', trackingNumber: 'G4S-MSA-55678', status: 'Failed', destination: 'Mombasa', updatedAt: '2026-09-22 18:00' },
  { id: 'sh-6', orderNumber: '#SKO-9848', customerName: 'Peter Njoroge', method: 'Pickup Mtaani / Locker', provider: 'Pickup Mtaani', trackingNumber: 'PUM-77812', status: 'Delivered', destination: 'Thika Road, Nairobi', updatedAt: '2026-09-23 09:15' },
  { id: 'sh-7', orderNumber: '#SKO-9849', customerName: 'Mercy Chebet', method: 'Standard Delivery', provider: 'Sendy', trackingNumber: 'SND-49304', status: 'Returned', destination: 'Nakuru', updatedAt: '2026-09-22 16:00' },
  { id: 'sh-8', orderNumber: '#SKO-9850', customerName: 'John Omondi', method: 'Express Boda', provider: 'Glovo', trackingNumber: 'GLV-88211', status: 'Label Created', destination: 'Kilimani, Nairobi', updatedAt: '2026-09-23 16:40' },
];

const INITIAL_COURIERS: CourierConfig[] = [
  { id: 'sendy', name: 'Sendy Fulfillment', logoBg: 'bg-amber-500', description: 'Automated dispatch, motorcycle & truck fulfillment across Kenya.', apiKey: 'snd_live_99812736481029384', enabled: true, regions: ['Nairobi', 'Central Kenya', 'Coast', 'Rift Valley', 'Nyanza'] },
  { id: 'glovo', name: 'Glovo Express', logoBg: 'bg-yellow-400', description: 'Instant on-demand multi-category delivery for quick commerce.', apiKey: 'glv_live_88372649102938475', enabled: true, regions: ['Nairobi', 'Coast', 'Nyanza'] },
  { id: 'pickupmtaani', name: 'Pickup Mtaani', logoBg: 'bg-emerald-600', description: 'Affordable peer-to-peer neighborhood pickup stations.', apiKey: 'pum_test_11223344556677889', enabled: true, regions: ['Nairobi', 'Central Kenya', 'Coast', 'Rift Valley', 'Nyanza', 'Western'] },
  { id: 'g4s', name: 'G4S Courier', logoBg: 'bg-blue-700', description: 'Secure nationwide courier and cash-in-transit logistics.', apiKey: 'g4s_live_55667788990011223', enabled: true, regions: ['Nairobi', 'Coast', 'Rift Valley', 'Western', 'Nyanza', 'North Eastern', 'Central Kenya'] },
  { id: 'easycoach', name: 'Easy Coach Parcel', logoBg: 'bg-red-600', description: 'Affordable nationwide bus parcel delivery to major towns.', apiKey: 'ec_live_99887766554433221', enabled: false, regions: ['Western', 'Nyanza', 'Rift Valley', 'Coast', 'Central Kenya'] },
];

export default function ShippingPage() {
  const [activeTab, setActiveTab] = useState<ShippingTab>('Zones & Rates');
  const [zones, setZones] = useState<ShippingZone[]>(INITIAL_ZONES);
  const [methods, setMethods] = useState<ShippingMethodItem[]>(INITIAL_METHODS);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>(INITIAL_PICKUP_LOCATIONS);
  const [shipments, setShipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);
  const [couriers, setCouriers] = useState<CourierConfig[]>(INITIAL_COURIERS);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [isAddPickupOpen, setIsAddPickupOpen] = useState(false);
  const [selectedZoneIdForRate, setSelectedZoneIdForRate] = useState('');

  const [zoneName, setZoneName] = useState('');
  const [zoneRegion, setZoneRegion] = useState('Nairobi');
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);

  const [rateMethodName, setRateMethodName] = useState('Standard Delivery');
  const [ratePrice, setRatePrice] = useState('');
  const [rateEta, setRateEta] = useState('2-3 business days');
  const [rateFreeThreshold, setRateFreeThreshold] = useState('');

  const [pickupName, setPickupName] = useState('');
  const [pickupType, setPickupType] = useState<'Locker' | 'Agent' | 'Store'>('Agent');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCounty, setPickupCounty] = useState('Nairobi');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupHours, setPickupHours] = useState('Mon-Sat 9am-7pm');

  const [trackingSearch, setTrackingSearch] = useState('');

  const anyModalOpen = isAddZoneOpen || isAddRateOpen || isAddPickupOpen;

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

  const showToast = (msg: string) => setToastMessage(msg);

  const saveZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;
    const newZone: ShippingZone = {
      id: `zone-${Date.now()}`,
      name: zoneName,
      region: zoneRegion,
      counties: selectedCounties.length > 0 ? selectedCounties : [zoneRegion],
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

  const savePickup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupName.trim() || !pickupAddress.trim()) return;
    const newLoc: PickupLocation = {
      id: `pl-${Date.now()}`,
      name: pickupName,
      type: pickupType,
      address: pickupAddress,
      county: pickupCounty,
      phone: pickupPhone || '+254 700 000 000',
      hours: pickupHours,
      status: 'Active',
    };
    setPickupLocations([newLoc, ...pickupLocations]);
    setIsAddPickupOpen(false);
    setPickupName('');
    setPickupAddress('');
    setPickupPhone('');
    showToast(`Pickup location "${newLoc.name}" added`);
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

  const deletePickup = (id: string) => {
    setPickupLocations((prev) => prev.filter((p) => p.id !== id));
    showToast('Pickup location deleted');
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

  const togglePickupStatus = (id: string) => {
    setPickupLocations((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = p.status === 'Active' ? 'Disabled' : 'Active';
        showToast(`${p.name} is now ${next.toLowerCase()}`);
        return { ...p, status: next };
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

  const updateShipmentStatus = (id: string, status: ShipmentStatus) => {
    setShipments((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status, updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16) }
          : s
      )
    );
    showToast(`Shipment status updated to ${status}`);
  };

  const statusBadge = (s: ShipmentStatus) =>
    s === 'Delivered'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'In Transit' || s === 'Out for Delivery' || s === 'Picked Up'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Pending' || s === 'Label Created'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : 'bg-red-50 text-red-600 border-red-100';

  const filteredShipments = shipments.filter((s) => {
    if (!trackingSearch) return true;
    const q = trackingSearch.toLowerCase();
    return (
      s.orderNumber.toLowerCase().includes(q) ||
      s.trackingNumber.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q)
    );
  });

  const regionCounties = KENYA_REGIONS[zoneRegion] || [];

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
                        {zone.region} · {zone.counties.length} counties
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
                          className={`w-full px-2.5 py-2 rounded-sm font-medium text-[13px] transition ${m.status === 'Active'
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
                onClick={() => setIsAddPickupOpen(true)}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add location
              </button>
            </div>

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
                      className="p-1.5 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
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
                      className={`px-2.5 py-1.5 rounded-sm font-medium text-[13px] transition ${loc.status === 'Active'
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
          </>
        )}

        {/* TAB 4: TRACKING */}
        {activeTab === 'Tracking' && (
          <div className="space-y-3">
            {/* Search bar */}
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
                {filteredShipments.length} shipment{filteredShipments.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Shipments table */}
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
                    {filteredShipments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                          No shipments match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredShipments.map((s) => (
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
                              className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
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
                <label className="block font-medium text-slate-700 mb-1">Region</label>
                <select
                  value={zoneRegion}
                  onChange={(e) => {
                    setZoneRegion(e.target.value);
                    setSelectedCounties([]);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  {Object.keys(KENYA_REGIONS).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Select counties in {zoneRegion}
                </label>
                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-sm p-1 bg-white space-y-0.5">
                  {regionCounties.map((county) => {
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
                  <option value="Express Air">Express air</option>
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
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {ALL_COUNTIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
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
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Save location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}