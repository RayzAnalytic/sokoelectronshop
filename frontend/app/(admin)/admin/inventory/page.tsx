'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  XCircle,
  Search,
  ChevronDown,
  Upload,
  Check,
  X,
  FileSpreadsheet,
  History,
  Loader2,
  Truck,
  ArrowRightLeft,
  Building2,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  Mail,
  Globe,
  MapPin,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Layers,
  Boxes,
} from 'lucide-react';

// --- TYPES ---
type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
type AdjustmentType = 'Add' | 'Remove' | 'Set';
type AdjustmentReason = 'Restock' | 'Damaged' | 'Return' | 'Correction' | 'Transfer In' | 'Transfer Out';
type SectionTab = 'stock' | 'movements' | 'transfers' | 'suppliers';
type MovementType = 'Sale' | 'Restock' | 'Adjustment' | 'Transfer In' | 'Transfer Out' | 'Return' | 'Damage';
type TransferStatus = 'Pending' | 'In Transit' | 'Completed' | 'Cancelled';

interface StockHistoryItem {
  id: string;
  date: string;
  user: string;
  change: string;
  reason: string;
  notes?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  image: string;
  category: string;
  brand: string;
  warehouse: string;
  currentStock: number;
  reserved: number;
  available: number;
  threshold: number;
  status: StockStatus;
  history: StockHistoryItem[];
  supplierId?: string;
}

interface Movement {
  id: string;
  date: string;
  product: string;
  sku: string;
  type: MovementType;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  user: string;
  reference: string;
  notes?: string;
}

interface Transfer {
  id: string;
  reference: string;
  product: string;
  sku: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  status: TransferStatus;
  requestedBy: string;
  requestedAt: string;
  expectedDate: string;
  notes?: string;
}

interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  country: string;
  city: string;
  productsSupplied: number;
  outstandingBalance: number;
  status: 'Active' | 'Inactive';
  leadTimeDays: number;
  rating: number;
}

const WAREHOUSES = ['Nairobi Main Hub', 'Mombasa Port Depot', 'Westlands Fulfilment', 'Kisumu Regional'];
const CATEGORIES = ['Laptops & Workstations', 'Displays & Monitors', 'Smartphones & 5G', 'Keyboards & Mice', 'Audio'];
const BRANDS = ['Lenovo', 'Dell Technologies', 'Apple', 'Samsung', 'Logitech'];
const STATUSES: StockStatus[] = ['In Stock', 'Low Stock', 'Out of Stock'];

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1', name: 'Lenovo ThinkPad X1 Carbon Gen 10', sku: 'LNV-TPX1-G10', image: '/Lenovo.jpeg',
    category: 'Laptops & Workstations', brand: 'Lenovo', warehouse: 'Nairobi Main Hub',
    currentStock: 35, reserved: 5, available: 30, threshold: 10, status: 'In Stock',
    supplierId: 'sup-1',
    history: [
      { id: 'h-1', date: '2026-09-20 14:32', user: 'Admin Isaac', change: '+15', reason: 'Restock', notes: 'Monthly container shipment arrival' },
      { id: 'h-2', date: '2026-09-12 09:15', user: 'System', change: '-2', reason: 'Correction', notes: 'Order fulfillment dispatch' },
    ],
  },
  {
    id: 'inv-2', name: 'Dell UltraSharp 27 4K USB-C Monitor', sku: 'DEL-U2723QE', image: '/dellmonitor.jpeg',
    category: 'Displays & Monitors', brand: 'Dell Technologies', warehouse: 'Mombasa Port Depot',
    currentStock: 6, reserved: 2, available: 4, threshold: 8, status: 'Low Stock',
    supplierId: 'sup-2',
    history: [
      { id: 'h-3', date: '2026-09-18 11:00', user: 'Admin Isaac', change: '-4', reason: 'Damaged', notes: 'Screen cracked during transit handling' },
    ],
  },
  {
    id: 'inv-3', name: 'Apple iPhone 15 Pro Max 256GB', sku: 'APL-IP15PM-256', image: '/phone.jpeg',
    category: 'Smartphones & 5G', brand: 'Apple', warehouse: 'Nairobi Main Hub',
    currentStock: 12, reserved: 2, available: 10, threshold: 5, status: 'In Stock',
    supplierId: 'sup-3',
    history: [
      { id: 'h-4', date: '2026-09-22 16:45', user: 'System', change: '-5', reason: 'Correction', notes: 'Sold via WhatsApp store' },
    ],
  },
  {
    id: 'inv-4', name: 'Logitech MX Master 3S Wireless Mouse', sku: 'LOG-MXM3S-BLK', image: '/phone.jpeg',
    category: 'Keyboards & Mice', brand: 'Logitech', warehouse: 'Westlands Fulfilment',
    currentStock: 48, reserved: 8, available: 40, threshold: 12, status: 'In Stock',
    supplierId: 'sup-4',
    history: [
      { id: 'h-5', date: '2026-09-15 10:20', user: 'Admin Isaac', change: '+25', reason: 'Restock', notes: 'Supplier delivery batch #892' },
    ],
  },
  {
    id: 'inv-5', name: 'Samsung Odyssey OLED G9 Monitor', sku: 'SAM-G95SC-49', image: '/phone.jpeg',
    category: 'Displays & Monitors', brand: 'Samsung', warehouse: 'Nairobi Main Hub',
    currentStock: 3, reserved: 1, available: 2, threshold: 5, status: 'Low Stock',
    supplierId: 'sup-5',
    history: [
      { id: 'h-6', date: '2026-09-10 14:00', user: 'Admin Isaac', change: '+3', reason: 'Restock', notes: 'Special order import' },
    ],
  },
  {
    id: 'inv-6', name: 'Samsung 55" QLED 4K Smart TV', sku: 'SAM-QN55-4K', image: '/phone.jpeg',
    category: 'Displays & Monitors', brand: 'Samsung', warehouse: 'Nairobi Main Hub',
    currentStock: 20, reserved: 3, available: 17, threshold: 8, status: 'In Stock',
    supplierId: 'sup-5',
    history: [
      { id: 'h-7', date: '2026-09-21 09:00', user: 'Admin Isaac', change: '+20', reason: 'Restock', notes: 'Fresh batch received' },
    ],
  },
  {
    id: 'inv-7', name: 'Laptop — HP Pavilion 15', sku: 'HP-PAV15', image: '/Lenovo.jpeg',
    category: 'Laptops & Workstations', brand: 'Lenovo', warehouse: 'Nairobi Main Hub',
    currentStock: 4, reserved: 1, available: 3, threshold: 5, status: 'Low Stock',
    supplierId: 'sup-1',
    history: [
      { id: 'h-8', date: '2026-09-19 13:20', user: 'Admin Isaac', change: '-2', reason: 'Correction', notes: 'Store dispatch' },
    ],
  },
];

const INITIAL_MOVEMENTS: Movement[] = [
  { id: 'm-1', date: '2026-09-23 16:45', product: 'Apple iPhone 15 Pro Max 256GB', sku: 'APL-IP15PM-256', type: 'Sale', quantity: -5, fromWarehouse: 'Nairobi Main Hub', toWarehouse: 'Customer', user: 'System', reference: 'ORD-8942' },
  { id: 'm-2', date: '2026-09-23 12:10', product: 'Samsung 55" QLED 4K Smart TV', sku: 'SAM-QN55-4K', type: 'Transfer In', quantity: 5, fromWarehouse: 'Mombasa Port Depot', toWarehouse: 'Nairobi Main Hub', user: 'Admin Isaac', reference: 'TRF-2201' },
  { id: 'm-3', date: '2026-09-22 09:30', product: 'Logitech MX Master 3S Wireless Mouse', sku: 'LOG-MXM3S-BLK', type: 'Restock', quantity: 25, fromWarehouse: 'Supplier', toWarehouse: 'Westlands Fulfilment', user: 'Admin Isaac', reference: 'PO-5521' },
  { id: 'm-4', date: '2026-09-21 14:20', product: 'Dell UltraSharp 27 4K USB-C Monitor', sku: 'DEL-U2723QE', type: 'Damage', quantity: -4, fromWarehouse: 'Mombasa Port Depot', toWarehouse: 'Scrap', user: 'Admin Isaac', reference: 'DMG-0091', notes: 'Transit damage' },
  { id: 'm-5', date: '2026-09-20 11:00', product: 'Lenovo ThinkPad X1 Carbon Gen 10', sku: 'LNV-TPX1-G10', type: 'Restock', quantity: 15, fromWarehouse: 'Supplier', toWarehouse: 'Nairobi Main Hub', user: 'Admin Isaac', reference: 'PO-5518' },
  { id: 'm-6', date: '2026-09-19 15:45', product: 'Samsung Odyssey OLED G9 Monitor', sku: 'SAM-G95SC-49', type: 'Sale', quantity: -2, fromWarehouse: 'Nairobi Main Hub', toWarehouse: 'Customer', user: 'System', reference: 'ORD-8910' },
];

const INITIAL_TRANSFERS: Transfer[] = [
  { id: 't-1', reference: 'TRF-2201', product: 'Samsung 55" QLED 4K Smart TV', sku: 'SAM-QN55-4K', quantity: 5, fromWarehouse: 'Mombasa Port Depot', toWarehouse: 'Nairobi Main Hub', status: 'Completed', requestedBy: 'Admin Isaac', requestedAt: '2026-09-23 08:15', expectedDate: '2026-09-23' },
  { id: 't-2', reference: 'TRF-2202', product: 'Logitech MX Master 3S Wireless Mouse', sku: 'LOG-MXM3S-BLK', quantity: 10, fromWarehouse: 'Westlands Fulfilment', toWarehouse: 'Kisumu Regional', status: 'In Transit', requestedBy: 'Admin Isaac', requestedAt: '2026-09-23 13:40', expectedDate: '2026-09-25' },
  { id: 't-3', reference: 'TRF-2203', product: 'Dell UltraSharp 27 4K USB-C Monitor', sku: 'DEL-U2723QE', quantity: 3, fromWarehouse: 'Mombasa Port Depot', toWarehouse: 'Nairobi Main Hub', status: 'Pending', requestedBy: 'Admin Isaac', requestedAt: '2026-09-24 09:00', expectedDate: '2026-09-27', notes: 'Low stock alert on main hub' },
  { id: 't-4', reference: 'TRF-2199', product: 'Apple iPhone 15 Pro Max 256GB', sku: 'APL-IP15PM-256', quantity: 8, fromWarehouse: 'Nairobi Main Hub', toWarehouse: 'Mombasa Port Depot', status: 'Cancelled', requestedBy: 'Admin Isaac', requestedAt: '2026-09-18 10:20', expectedDate: '2026-09-21', notes: 'Customer cancelled B2B order' },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'Lenovo East Africa', contactName: 'Sarah Mwangi', email: 'sarah@lenovo-ea.co.ke', phone: '+254 711 445 566', website: 'https://www.lenovo.com', country: 'Kenya', city: 'Nairobi', productsSupplied: 2, outstandingBalance: 145000, status: 'Active', leadTimeDays: 14, rating: 4.6 },
  { id: 'sup-2', name: 'Dell Kenya Distributor', contactName: 'Peter Njoroge', email: 'peter@dell-dist.co.ke', phone: '+254 722 887 991', website: 'https://www.dell.com', country: 'Kenya', city: 'Mombasa', productsSupplied: 1, outstandingBalance: 78000, status: 'Active', leadTimeDays: 21, rating: 4.2 },
  { id: 'sup-3', name: 'iStore Africa', contactName: 'Joy Kamau', email: 'joy@istore.africa', phone: '+254 733 221 100', website: 'https://www.istore.africa', country: 'Kenya', city: 'Nairobi', productsSupplied: 1, outstandingBalance: 0, status: 'Active', leadTimeDays: 7, rating: 4.9 },
  { id: 'sup-4', name: 'Logitech Official', contactName: 'Daniel Otieno', email: 'daniel@logitech.co.ke', phone: '+254 700 554 433', country: 'Kenya', city: 'Nairobi', productsSupplied: 1, outstandingBalance: 24000, status: 'Active', leadTimeDays: 10, rating: 4.4 },
  { id: 'sup-5', name: 'Samsung Gulf Electronics', contactName: 'Amina Hassan', email: 'amina@samsung-gulf.ae', phone: '+971 4 555 1234', website: 'https://www.samsung.com', country: 'UAE', city: 'Dubai', productsSupplied: 2, outstandingBalance: 320000, status: 'Active', leadTimeDays: 28, rating: 4.7 },
  { id: 'sup-6', name: 'Legacy Imports Ltd', contactName: 'Robert Kimani', email: 'robert@legacy-imports.co.ke', phone: '+254 711 998 877', country: 'Kenya', city: 'Nairobi', productsSupplied: 0, outstandingBalance: 0, status: 'Inactive', leadTimeDays: 30, rating: 3.1 },
];

const formatKES = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);

const MOVEMENT_STYLES: Record<MovementType, string> = {
  Sale: 'bg-blue-50 text-blue-950 border-blue-100',
  Restock: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Adjustment: 'bg-slate-100 text-slate-700 border-slate-200',
  'Transfer In': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Transfer Out': 'bg-violet-50 text-violet-700 border-violet-100',
  Return: 'bg-amber-50 text-amber-700 border-amber-100',
  Damage: 'bg-red-50 text-red-600 border-red-100',
};

const TRANSFER_STYLES: Record<TransferStatus, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  'In Transit': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Cancelled: 'bg-red-50 text-red-600 border-red-100',
};

const SUPPLIER_STATUS_STYLES: Record<Supplier['status'], string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [movements, setMovements] = useState<Movement[]>(INITIAL_MOVEMENTS);
  const [transfers, setTransfers] = useState<Transfer[]>(INITIAL_TRANSFERS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);

  const [activeSection, setActiveSection] = useState<SectionTab>('stock');

  // Stock tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StockStatus | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cardFilter, setCardFilter] = useState<'All' | 'Low Stock' | 'Out of Stock'>('All');

  // Movements tab state
  const [movementTypeFilter, setMovementTypeFilter] = useState<MovementType | null>(null);
  const [movementSearch, setMovementSearch] = useState('');

  // Transfers tab state
  const [transferStatusFilter, setTransferStatusFilter] = useState<TransferStatus | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Suppliers tab state
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<Supplier['status'] | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Modals / drawers
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [activeSheetItem, setActiveSheetItem] = useState<InventoryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [adjType, setAdjType] = useState<AdjustmentType>('Add');
  const [adjQty, setAdjQty] = useState('10');
  const [adjReason, setAdjReason] = useState<AdjustmentReason>('Restock');
  const [adjNotes, setAdjNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [bulkManualRows, setBulkManualRows] = useState<{ id: string; name: string; sku: string; current: number; newQty: string }[]>([]);

  useEffect(() => {
    if (isBulkModalOpen) {
      setBulkManualRows(
        inventory.map((i) => ({
          id: i.id,
          name: i.name,
          sku: i.sku,
          current: i.currentStock,
          newQty: String(i.currentStock),
        }))
      );
    }
  }, [isBulkModalOpen, inventory]);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Summary
  const totalSkus = inventory.length;
  const lowStockCount = inventory.filter((i) => i.status === 'Low Stock').length;
  const outOfStockCount = inventory.filter((i) => i.status === 'Out of Stock').length;
  const totalReserved = inventory.reduce((a, i) => a + i.reserved, 0);
  const totalAvailable = inventory.reduce((a, i) => a + i.available, 0);
  const totalStockValue = inventory.reduce((a, i) => a + i.currentStock * 45000, 0); // placeholder price basis

  // Filtered inventory
  const filteredInventory = inventory.filter((item) => {
    if (cardFilter === 'Low Stock' && item.status !== 'Low Stock') return false;
    if (cardFilter === 'Out of Stock' && item.status !== 'Out of Stock') return false;

    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (selectedCategory && item.category !== selectedCategory) return false;
    if (selectedBrand && item.brand !== selectedBrand) return false;
    if (selectedStatus && item.status !== selectedStatus) return false;
    if (selectedWarehouse && item.warehouse !== selectedWarehouse) return false;
    return true;
  });

  const allSelected = filteredInventory.length > 0 && selectedIds.length === filteredInventory.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filteredInventory.map((i) => i.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  // Filtered movements
  const filteredMovements = useMemo(() => {
    const q = movementSearch.toLowerCase();
    return movements.filter((m) => {
      if (movementTypeFilter && m.type !== movementTypeFilter) return false;
      if (q && !m.product.toLowerCase().includes(q) && !m.sku.toLowerCase().includes(q) && !m.reference.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [movements, movementTypeFilter, movementSearch]);

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => !transferStatusFilter || t.status === transferStatusFilter);
  }, [transfers, transferStatusFilter]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase();
    return suppliers.filter((s) => {
      if (supplierStatusFilter && s.status !== supplierStatusFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !s.contactName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [suppliers, supplierSearch, supplierStatusFilter]);

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    setIsSaving(true);

    setTimeout(() => {
      const qtyNum = parseInt(adjQty) || 0;
      let newCurrent = adjustItem.currentStock;
      let changeStr = '';

      if (adjType === 'Add') {
        newCurrent += qtyNum;
        changeStr = `+${qtyNum}`;
      } else if (adjType === 'Remove') {
        newCurrent = Math.max(0, newCurrent - qtyNum);
        changeStr = `-${qtyNum}`;
      } else {
        const diff = qtyNum - newCurrent;
        newCurrent = qtyNum;
        changeStr = diff >= 0 ? `+${diff}` : `${diff}`;
      }

      const newAvailable = Math.max(0, newCurrent - adjustItem.reserved);
      let newStatus: StockStatus = 'In Stock';
      if (newCurrent === 0) newStatus = 'Out of Stock';
      else if (newCurrent <= adjustItem.threshold) newStatus = 'Low Stock';

      const newHistory: StockHistoryItem = {
        id: `h-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: 'Admin Isaac',
        change: changeStr,
        reason: adjReason,
        notes: adjNotes || `Stock adjusted via ${adjType} operation`,
      };

      // Log movement
      const newMovement: Movement = {
        id: `m-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        product: adjustItem.name,
        sku: adjustItem.sku,
        type: adjReason === 'Restock' ? 'Restock' : adjReason === 'Damaged' ? 'Damage' : adjReason === 'Return' ? 'Return' : 'Adjustment',
        quantity: parseInt(changeStr),
        fromWarehouse: adjustItem.warehouse,
        toWarehouse: adjustItem.warehouse,
        user: 'Admin Isaac',
        reference: `ADJ-${Date.now().toString().slice(-6)}`,
        notes: adjNotes,
      };
      setMovements((prev) => [newMovement, ...prev]);

      setInventory((prev) =>
        prev.map((item) =>
          item.id === adjustItem.id
            ? {
              ...item,
              currentStock: newCurrent,
              available: newAvailable,
              status: newStatus,
              history: [newHistory, ...item.history],
            }
            : item
        )
      );

      setIsSaving(false);
      setAdjustItem(null);
      setAdjQty('10');
      setAdjNotes('');
      setToastMessage(`Updated stock for ${adjustItem.name} (${changeStr} units)`);
    }, 400);
  };

  const handleBulkSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setInventory((prev) =>
        prev.map((item) => {
          const row = bulkManualRows.find((r) => r.id === item.id);
          if (!row) return item;
          const newQty = parseInt(row.newQty) || item.currentStock;
          const diff = newQty - item.currentStock;
          if (diff === 0) return item;

          const newAvailable = Math.max(0, newQty - item.reserved);
          let newStatus: StockStatus = 'In Stock';
          if (newQty === 0) newStatus = 'Out of Stock';
          else if (newQty <= item.threshold) newStatus = 'Low Stock';

          const newHistory: StockHistoryItem = {
            id: `h-${Date.now()}-${Math.random()}`,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            user: 'Admin Isaac',
            change: diff > 0 ? `+${diff}` : `${diff}`,
            reason: 'Correction',
            notes: 'Bulk stock spreadsheet update',
          };

          return {
            ...item,
            currentStock: newQty,
            available: newAvailable,
            status: newStatus,
            history: [newHistory, ...item.history],
          };
        })
      );
      setIsSaving(false);
      setIsBulkModalOpen(false);
      setToastMessage('Bulk inventory updated');
    }, 500);
  };

  const handleTransferCreate = (data: Omit<Transfer, 'id' | 'reference' | 'requestedBy' | 'requestedAt'>) => {
    const newTransfer: Transfer = {
      id: `t-${Date.now()}`,
      reference: `TRF-${Math.floor(2000 + Math.random() * 999)}`,
      requestedBy: 'Admin Isaac',
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      ...data,
    };
    setTransfers((prev) => [newTransfer, ...prev]);

    const newMovement: Movement = {
      id: `m-${Date.now()}`,
      date: newTransfer.requestedAt,
      product: data.product,
      sku: data.sku,
      type: 'Transfer Out',
      quantity: -data.quantity,
      fromWarehouse: data.fromWarehouse,
      toWarehouse: data.toWarehouse,
      user: 'Admin Isaac',
      reference: newTransfer.reference,
      notes: data.notes,
    };
    setMovements((prev) => [newMovement, ...prev]);

    setIsTransferModalOpen(false);
    setToastMessage(`Transfer ${newTransfer.reference} created`);
  };

  const handleSupplierSave = (data: Omit<Supplier, 'id'> & { id?: string }) => {
    if (data.id) {
      setSuppliers((prev) => prev.map((s) => (s.id === data.id ? ({ ...s, ...data, id: data.id } as Supplier) : s)));
    } else {
      const newSupplier: Supplier = {
        id: `sup-${Date.now()}`,
        ...data,
      } as Supplier;
      setSuppliers((prev) => [newSupplier, ...prev]);
    }
    setIsSupplierModalOpen(false);
    setToastMessage('Supplier saved');
  };

  const updateTransferStatus = (id: string, status: TransferStatus) => {
    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setToastMessage(`Transfer marked as ${status}`);
  };

  const activeFilterCount =
    (cardFilter !== 'All' ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedBrand ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (selectedWarehouse ? 1 : 0);

  const clearFilters = () => {
    setCardFilter('All');
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedStatus(null);
    setSelectedWarehouse(null);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
            <h1 className="text-[15px] font-semibold text-slate-900">Inventory</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Stock levels, movements, transfers, and suppliers</p>
          </div>
          <div className="flex items-center gap-2">
            {activeSection === 'stock' && (
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bulk update</span>
              </button>
            )}
            {activeSection === 'transfers' && (
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>New transfer</span>
              </button>
            )}
            {activeSection === 'suppliers' && (
              <button
                onClick={() => setIsSupplierModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add supplier</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION TABS */}
        <div className="max-w-[1600px] mx-auto px-3 flex gap-0.5 overflow-x-auto">
          {[
            { id: 'stock', label: 'Stock Levels', icon: Boxes },
            { id: 'movements', label: 'Inventory Movements', icon: TrendingUp },
            { id: 'transfers', label: 'Stock Transfers', icon: ArrowRightLeft },
            { id: 'suppliers', label: 'Suppliers', icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as SectionTab)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
                    ? 'border-blue-950 text-blue-950 bg-blue-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* ====================================================== */}
        {/* SECTION: STOCK LEVELS */}
        {/* ====================================================== */}
        {activeSection === 'stock' && (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { key: 'All', label: 'Total SKUs', value: totalSkus, Icon: Package, tint: 'bg-blue-50 text-blue-950', activeRing: 'ring-blue-950' },
                { key: 'Low Stock', label: 'Low stock', value: lowStockCount, Icon: AlertTriangle, tint: 'bg-amber-50 text-amber-700', activeRing: 'ring-amber-500' },
                { key: 'Out of Stock', label: 'Out of stock', value: outOfStockCount, Icon: XCircle, tint: 'bg-red-50 text-red-600', activeRing: 'ring-red-500' },
                { key: null, label: 'Reserved units', value: totalReserved, Icon: Layers, tint: 'bg-indigo-50 text-indigo-700', activeRing: '' },
                { key: null, label: 'Available units', value: totalAvailable, Icon: Check, tint: 'bg-emerald-50 text-emerald-700', activeRing: '' },
              ].map(({ key, label, value, Icon, tint, activeRing }, idx) => {
                const isFilter = key !== null;
                const active = isFilter && cardFilter === key;
                return (
                  <button
                    key={idx}
                    onClick={() => isFilter && setCardFilter(key as any)}
                    disabled={!isFilter}
                    className={`text-left bg-white border rounded-sm p-2 flex items-center justify-between gap-2 transition ${active ? `border-blue-950 ring-1 ${activeRing}` : 'border-slate-200'
                      } ${isFilter ? 'hover:border-slate-300 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
                      <p className="text-[15px] font-bold text-slate-900 mt-0.5">{value.toLocaleString()}</p>
                    </div>
                    <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* FILTER BAR */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products or SKU…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown label="Category" value={selectedCategory} options={CATEGORIES} onChange={setSelectedCategory} />
                <FilterDropdown label="Brand" value={selectedBrand} options={BRANDS} onChange={setSelectedBrand} />
                <FilterDropdown
                  label="Status"
                  value={selectedStatus}
                  options={STATUSES as unknown as string[]}
                  onChange={(v) => setSelectedStatus(v as StockStatus | null)}
                />
                <FilterDropdown label="Warehouse" value={selectedWarehouse} options={WAREHOUSES} onChange={setSelectedWarehouse} />
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
                  >
                    Clear ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>

            {/* BULK ACTIONS */}
            {selectedIds.length > 0 && (
              <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="bg-blue-900 font-medium px-2 py-0.5 rounded-sm">{selectedIds.length} selected</span>
                  <span className="text-blue-200 hidden sm:inline">Bulk actions</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
                  >
                    Bulk update
                  </button>
                  <button
                    onClick={() => {
                      setToastMessage(`${selectedIds.length} items exported as CSV`);
                      setSelectedIds([]);
                    }}
                    className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            )}

            {/* STOCK TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                        />
                      </th>
                      <th className="py-2 px-3 font-medium">Product / SKU</th>
                      <th className="py-2 px-3 font-medium">Warehouse</th>
                      <th className="py-2 px-3 font-medium text-center">Current</th>
                      <th className="py-2 px-3 font-medium text-center">Reserved</th>
                      <th className="py-2 px-3 font-medium text-center">Available</th>
                      <th className="py-2 px-3 font-medium text-center">Threshold</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                          No inventory items match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map((item) => {
                        const statusBadge =
                          item.status === 'In Stock'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : item.status === 'Low Stock'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-600 border-red-200';
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => setActiveSheetItem(item)}
                          >
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(item.id)}
                                onChange={() => toggleRow(item.id)}
                                className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate max-w-[240px]">{item.name}</p>
                                  <p className="font-mono text-[13px] text-slate-400">{item.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{item.warehouse}</td>
                            <td className="py-2 px-3 text-center font-medium text-slate-900">{item.currentStock}</td>
                            <td className="py-2 px-3 text-center text-slate-500">{item.reserved}</td>
                            <td className="py-2 px-3 text-center font-medium text-blue-950">{item.available}</td>
                            <td className="py-2 px-3 text-center text-slate-400 font-mono">{item.threshold}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setAdjustItem(item)}
                                className="bg-white border border-slate-200 hover:bg-blue-950 hover:border-blue-950 hover:text-white text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
                              >
                                Adjust
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ====================================================== */}
        {/* SECTION: INVENTORY MOVEMENTS */}
        {/* ====================================================== */}
        {activeSection === 'movements' && (
          <>
            {/* SUMMARY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Movements', value: movements.length, icon: TrendingUp, color: 'text-blue-950 bg-blue-50' },
                { label: 'Inbound', value: movements.filter((m) => m.quantity > 0).length, icon: ArrowDownRight, color: 'text-emerald-700 bg-emerald-50' },
                { label: 'Outbound', value: movements.filter((m) => m.quantity < 0).length, icon: ArrowUpRight, color: 'text-red-600 bg-red-50' },
                { label: 'Net Units', value: movements.reduce((a, m) => a + m.quantity, 0).toLocaleString(), icon: Layers, color: 'text-indigo-700 bg-indigo-50' },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-500 truncate">{s.label}</p>
                    <p className="text-[15px] font-bold text-slate-900 mt-0.5">{s.value}</p>
                  </div>
                  <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${s.color}`}>
                    <s.icon className="w-4 h-4" />
                  </span>
                </div>
              ))}
            </div>

            {/* FILTER BAR */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by product, SKU, or reference…"
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label="Type"
                  value={movementTypeFilter}
                  options={['Sale', 'Restock', 'Adjustment', 'Transfer In', 'Transfer Out', 'Return', 'Damage']}
                  onChange={(v) => setMovementTypeFilter(v as MovementType | null)}
                />
              </div>
            </div>

            {/* MOVEMENTS TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium">Product / SKU</th>
                      <th className="py-2 px-3 font-medium">Type</th>
                      <th className="py-2 px-3 font-medium text-center">Qty</th>
                      <th className="py-2 px-3 font-medium">From</th>
                      <th className="py-2 px-3 font-medium">To</th>
                      <th className="py-2 px-3 font-medium">Reference</th>
                      <th className="py-2 px-3 font-medium">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                          No movements match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-slate-500 font-mono text-[13px]">{m.date}</td>
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900 truncate max-w-[220px]">{m.product}</p>
                            <p className="font-mono text-[13px] text-slate-400">{m.sku}</p>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${MOVEMENT_STYLES[m.type]}`}>
                              {m.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-mono font-semibold ${m.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{m.fromWarehouse}</td>
                          <td className="py-2 px-3 text-slate-600">{m.toWarehouse}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{m.reference}</td>
                          <td className="py-2 px-3 text-slate-600">{m.user}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ====================================================== */}
        {/* SECTION: STOCK TRANSFERS */}
        {/* ====================================================== */}
        {activeSection === 'transfers' && (
          <>
            {/* SUMMARY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Transfers', value: transfers.length, icon: ArrowRightLeft, color: 'text-blue-950 bg-blue-50', status: null },
                { label: 'Pending', value: transfers.filter((t) => t.status === 'Pending').length, icon: AlertTriangle, color: 'text-amber-700 bg-amber-50', status: 'Pending' as TransferStatus },
                { label: 'In Transit', value: transfers.filter((t) => t.status === 'In Transit').length, icon: Truck, color: 'text-indigo-700 bg-indigo-50', status: 'In Transit' as TransferStatus },
                { label: 'Completed', value: transfers.filter((t) => t.status === 'Completed').length, icon: Check, color: 'text-emerald-700 bg-emerald-50', status: 'Completed' as TransferStatus },
              ].map((s) => {
                const active = s.status && transferStatusFilter === s.status;
                return (
                  <button
                    key={s.label}
                    onClick={() => s.status && setTransferStatusFilter(active ? null : s.status)}
                    className={`text-left bg-white border rounded-sm p-2 flex items-center justify-between gap-2 transition ${active ? 'border-blue-950 ring-1 ring-blue-950' : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-500 truncate">{s.label}</p>
                      <p className="text-[15px] font-bold text-slate-900 mt-0.5">{s.value}</p>
                    </div>
                    <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${s.color}`}>
                      <s.icon className="w-4 h-4" />
                    </span>
                  </button>
                );
              })}
            </div>

            {transferStatusFilter && (
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-slate-500">Filtered by</span>
                <span className="font-medium text-blue-950 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-100">
                  {transferStatusFilter}
                </span>
                <button onClick={() => setTransferStatusFilter(null)} className="text-red-600 hover:underline font-medium">
                  Clear
                </button>
              </div>
            )}

            {/* TRANSFERS TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Reference</th>
                      <th className="py-2 px-3 font-medium">Product / SKU</th>
                      <th className="py-2 px-3 font-medium text-center">Qty</th>
                      <th className="py-2 px-3 font-medium">From → To</th>
                      <th className="py-2 px-3 font-medium">Requested</th>
                      <th className="py-2 px-3 font-medium">Expected</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                          No transfers match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTransfers.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono font-medium text-blue-950">{t.reference}</td>
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900 truncate max-w-[220px]">{t.product}</p>
                            <p className="font-mono text-[13px] text-slate-400">{t.sku}</p>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-slate-900">{t.quantity}</td>
                          <td className="py-2 px-3 text-slate-600">
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[110px]">{t.fromWarehouse}</span>
                              <ArrowRightLeft className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[110px]">{t.toWarehouse}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[13px]">{t.requestedAt}</td>
                          <td className="py-2 px-3 text-slate-600 font-mono text-[13px]">{t.expectedDate}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${TRANSFER_STYLES[t.status]}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {t.status === 'Pending' && (
                              <button
                                onClick={() => updateTransferStatus(t.id, 'In Transit')}
                                className="bg-white border border-slate-200 hover:bg-blue-950 hover:border-blue-950 hover:text-white text-slate-700 font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition"
                              >
                                Dispatch
                              </button>
                            )}
                            {t.status === 'In Transit' && (
                              <button
                                onClick={() => updateTransferStatus(t.id, 'Completed')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition"
                              >
                                Complete
                              </button>
                            )}
                            {(t.status === 'Completed' || t.status === 'Cancelled') && (
                              <span className="text-[13px] text-slate-400">No actions</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ====================================================== */}
        {/* SECTION: SUPPLIERS */}
        {/* ====================================================== */}
        {activeSection === 'suppliers' && (
          <>
            {/* SUMMARY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Suppliers', value: suppliers.length, icon: Building2, color: 'text-blue-950 bg-blue-50', status: null },
                { label: 'Active', value: suppliers.filter((s) => s.status === 'Active').length, icon: Check, color: 'text-emerald-700 bg-emerald-50', status: 'Active' as Supplier['status'] },
                { label: 'Inactive', value: suppliers.filter((s) => s.status === 'Inactive').length, icon: XCircle, color: 'text-slate-600 bg-slate-100', status: 'Inactive' as Supplier['status'] },
                { label: 'Outstanding', value: formatKES(suppliers.reduce((a, s) => a + s.outstandingBalance, 0)), icon: TrendingUp, color: 'text-amber-700 bg-amber-50', status: null },
              ].map((s) => {
                const active = s.status && supplierStatusFilter === s.status;
                return (
                  <button
                    key={s.label}
                    onClick={() => s.status && setSupplierStatusFilter(active ? null : s.status)}
                    disabled={!s.status}
                    className={`text-left bg-white border rounded-sm p-2 flex items-center justify-between gap-2 transition ${active ? 'border-blue-950 ring-1 ring-blue-950' : 'border-slate-200'
                      } ${s.status ? 'hover:border-slate-300 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-500 truncate">{s.label}</p>
                      <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">{s.value}</p>
                    </div>
                    <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${s.color}`}>
                      <s.icon className="w-4 h-4" />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* FILTER */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search suppliers by name, contact, or email…"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
            </div>

            {/* SUPPLIERS TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Supplier</th>
                      <th className="py-2 px-3 font-medium">Contact</th>
                      <th className="py-2 px-3 font-medium">Location</th>
                      <th className="py-2 px-3 font-medium text-center">Products</th>
                      <th className="py-2 px-3 font-medium text-center">Lead time</th>
                      <th className="py-2 px-3 font-medium text-right">Outstanding</th>
                      <th className="py-2 px-3 font-medium text-center">Rating</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                          No suppliers match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900">{s.name}</p>
                            {s.website && (
                              <a
                                href={s.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[13px] text-blue-950 hover:underline inline-flex items-center gap-1"
                              >
                                <Globe className="w-3 h-3" />
                                {s.website.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <p className="text-slate-800">{s.contactName}</p>
                            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {s.email}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[13px] text-slate-500">
                              <Phone className="w-3 h-3" /> {s.phone}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {s.city}, {s.country}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-slate-800">
                              {s.productsSupplied}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 font-mono">
                            {s.leadTimeDays}d
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                            {s.outstandingBalance > 0 ? formatKES(s.outstandingBalance) : '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-amber-700">
                              ★ {s.rating.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${SUPPLIER_STATUS_STYLES[s.status]}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ---- ADJUST MODAL ---- */}
      {adjustItem && (
        <Modal onClose={() => setAdjustItem(null)} title="Adjust stock" subtitle={adjustItem.name}>
          <form onSubmit={handleAdjustSubmit} className="space-y-3 text-[13px]">
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <span className="text-slate-600">Current stock</span>
              <span className="font-medium text-slate-900 bg-white px-3 py-0.5 rounded-sm border border-slate-200">
                {adjustItem.currentStock} units
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Adjustment type</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-0.5 rounded-sm">
                {(['Add', 'Remove', 'Set'] as AdjustmentType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdjType(t)}
                    className={`py-2 rounded-sm text-[13px] font-medium transition ${adjType === t
                        ? t === 'Add'
                          ? 'bg-emerald-600 text-white'
                          : t === 'Remove'
                            ? 'bg-red-600 text-white'
                            : 'bg-blue-950 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    {t === 'Add' ? 'Add (+)' : t === 'Remove' ? 'Remove (−)' : 'Set (=)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                min="0"
                required
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Reason</label>
              <select
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value as AdjustmentReason)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                <option value="Restock">Restock</option>
                <option value="Damaged">Damaged</option>
                <option value="Return">Customer return</option>
                <option value="Correction">Inventory correction</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Notes (optional)</label>
              <textarea
                rows={2}
                placeholder="Add context…"
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isSaving ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---- BULK MODAL ---- */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white border border-slate-200 rounded-sm max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <h2 className="text-[15px] font-semibold text-slate-900">Bulk stock update</h2>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <label
                className="block border-2 border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/20 rounded-sm p-6 text-center cursor-pointer transition"
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="w-7 h-7 mx-auto text-slate-400" />
                <p className="text-[13px] font-medium text-slate-900 mt-2">Upload CSV spreadsheet</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Columns: SKU, New Quantity</p>
                <span className="inline-block mt-2 bg-white border border-slate-200 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">
                  Browse files
                </span>
              </label>

              <div>
                <p className="font-medium text-slate-700 mb-1">Manual entry</p>
                <div className="border border-slate-200 rounded-sm overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-2 px-3 font-medium">Product / SKU</th>
                        <th className="py-2 px-3 font-medium text-center">Current</th>
                        <th className="py-2 px-3 font-medium text-center">New</th>
                        <th className="py-2 px-3 font-medium text-center">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkManualRows.map((row) => {
                        const newQ = parseInt(row.newQty) || row.current;
                        const diff = newQ - row.current;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <p className="font-medium text-slate-900 truncate max-w-[220px]">{row.name}</p>
                              <p className="font-mono text-[13px] text-slate-400">{row.sku}</p>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600">{row.current}</td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                value={row.newQty}
                                onChange={(e) =>
                                  setBulkManualRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, newQty: e.target.value } : r))
                                  )
                                }
                                className="w-20 bg-white border border-slate-200 rounded-sm px-2 py-1 text-center font-medium text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-sm text-[13px] font-medium ${diff > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : diff < 0
                                      ? 'bg-red-50 text-red-600'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSave}
                disabled={isSaving}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isSaving ? 'Saving…' : 'Apply updates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- TRANSFER MODAL ---- */}
      {isTransferModalOpen && (
        <TransferModal
          inventory={inventory}
          warehouses={WAREHOUSES}
          onClose={() => setIsTransferModalOpen(false)}
          onSave={handleTransferCreate}
        />
      )}

      {/* ---- SUPPLIER MODAL ---- */}
      {isSupplierModalOpen && (
        <SupplierModal
          onClose={() => setIsSupplierModalOpen(false)}
          onSave={handleSupplierSave}
        />
      )}

      {/* ---- HISTORY DRAWER ---- */}
      {activeSheetItem && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setActiveSheetItem(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-md h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <History className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-slate-900">Stock history</h2>
                  <p className="text-[13px] text-slate-500 truncate">{activeSheetItem.name}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveSheetItem(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[13px] text-slate-500">Current</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">{activeSheetItem.currentStock}</p>
                </div>
                <div>
                  <p className="text-[13px] text-slate-500">Reserved</p>
                  <p className="text-[15px] font-bold text-slate-700 mt-0.5">{activeSheetItem.reserved}</p>
                </div>
                <div>
                  <p className="text-[13px] text-slate-500">Available</p>
                  <p className="text-[15px] font-bold text-blue-950 mt-0.5">{activeSheetItem.available}</p>
                </div>
              </div>

              <div>
                <p className="font-medium text-slate-700 mb-2">Audit trail</p>
                <ul className="space-y-2">
                  {activeSheetItem.history.map((h, idx) => {
                    const positive = h.change.startsWith('+');
                    return (
                      <li
                        key={h.id || idx}
                        className="bg-white border border-slate-200 rounded-sm p-2 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">{h.reason}</span>
                          <span
                            className={`font-mono px-2 py-0.5 rounded-sm text-[13px] font-medium ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                              }`}
                          >
                            {h.change}
                          </span>
                        </div>
                        {h.notes && <p className="text-[13px] text-slate-600">{h.notes}</p>}
                        <div className="flex items-center justify-between text-[13px] text-slate-400 pt-1 border-t border-slate-100">
                          <span>{h.user}</span>
                          <span>{h.date}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[13px] text-slate-500 font-mono">SKU: {activeSheetItem.sku}</span>
              <button
                onClick={() => {
                  const item = activeSheetItem;
                  setActiveSheetItem(null);
                  setAdjustItem(item);
                }}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Adjust stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Transfer Modal ─────────── */
function TransferModal({
  inventory,
  warehouses,
  onClose,
  onSave,
}: {
  inventory: InventoryItem[];
  warehouses: string[];
  onClose: () => void;
  onSave: (data: Omit<Transfer, 'id' | 'reference' | 'requestedBy' | 'requestedAt'>) => void;
}) {
  const [productId, setProductId] = useState(inventory[0]?.id || '');
  const selected = inventory.find((i) => i.id === productId);

  const [quantity, setQuantity] = useState('1');
  const [fromWarehouse, setFromWarehouse] = useState(selected?.warehouse || warehouses[0]);
  const [toWarehouse, setToWarehouse] = useState(warehouses.find((w) => w !== selected?.warehouse) || warehouses[1]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (selected) {
      setFromWarehouse(selected.warehouse);
      const alt = warehouses.find((w) => w !== selected.warehouse);
      if (alt) setToWarehouse(alt);
    }
  }, [productId, selected, warehouses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    onSave({
      product: selected.name,
      sku: selected.sku,
      quantity: parseInt(quantity) || 1,
      fromWarehouse,
      toWarehouse,
      status: 'Pending',
      expectedDate: expectedDate || new Date().toISOString().substring(0, 10),
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">New stock transfer</h3>
            <p className="text-[13px] text-slate-500">Move inventory between warehouses</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-[13px]">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            >
              {inventory.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">From</label>
              <select
                value={fromWarehouse}
                onChange={(e) => setFromWarehouse(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">To</label>
              <select
                value={toWarehouse}
                onChange={(e) => setToWarehouse(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Expected date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Rebalancing stock"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          {selected && (
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between text-[13px]">
              <span className="text-slate-600">Available at source</span>
              <span className="font-mono font-medium text-slate-900">{selected.available} units</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Create transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────── Supplier Modal ─────────── */
function SupplierModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: Omit<Supplier, 'id'> & { id?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('Kenya');
  const [city, setCity] = useState('Nairobi');
  const [leadTimeDays, setLeadTimeDays] = useState('14');
  const [rating, setRating] = useState('4.5');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      contactName,
      email,
      phone,
      website: website || undefined,
      country,
      city,
      productsSupplied: 0,
      outstandingBalance: 0,
      status: 'Active',
      leadTimeDays: parseInt(leadTimeDays) || 14,
      rating: parseFloat(rating) || 4.5,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Add supplier</h3>
            <p className="text-[13px] text-slate-500">Create a new vendor record</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 text-[13px]">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Supplier name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Contact name *</label>
              <input
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone *</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Website</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Lead time (days)</label>
              <input
                type="number"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Rating (0–5)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Save supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────── FilterDropdown ─────────── */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = value !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
            ? 'bg-blue-50 border-blue-950 text-blue-950'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {value ?? label}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${!isActive ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            All {label.toLowerCase()}
          </button>
          <div className="border-t border-slate-100 my-1" />
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="truncate">{opt}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────── Modal ─────────── */
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm max-w-md w-full max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-[13px] text-slate-500 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}