// components/admin/AddDiscountModal.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Percent,
  DollarSign,
  Truck,
  Gift,
  Check,
  AlertCircle,
  ChevronDown,
  Eye,
  Zap,
  Flame,
  Search,
  CheckSquare,
  Square,
  Calendar,
  Tag,
  Users,
  Target,
  Image as ImageIcon,
  Layers,
  PackagePlus,
  Plus,
  Upload,
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  Info,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import AddProductForDiscountModal from './AddProductForDiscountModal';
import { useProducts } from '@/lib/store/products';
import type {
  Discount,
  DiscountPayload,
  DiscountType,
  PromotionType,
  AppliesTo,
} from '@/lib/store/discounts';

const CATEGORIES = [
  'Phones',
  'Laptops',
  'Tablets',
  'TVs',
  'Audio',
  'Accessories',
  'Gaming',
  'Smartwatches',
];

const TYPE_ICONS: Record<string, any> = {
  Percentage: Percent,
  'Fixed Amount': DollarSign,
  'Free Shipping': Truck,
  'Buy X Get Y': Gift,
};

const toLocalInput = (s: string) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (s: string) => s.replace('T', ' ');

const EMPTY: DiscountPayload = {
  code: '',
  description: '',
  type: 'Percentage',
  value: '',
  minOrder: 0,
  maxCap: 0,
  usageLimit: 100,
  perCustomer: 1,
  startDate: '',
  endDate: '',
  status: 'Scheduled',
  appliesTo: 'All Products',
  eligibility: 'All Customers',
  targetAudience: 'All People & Customers',
  isMostDeal: false,
  image: '',

  displayOnDealsPage: true,
  promotionType: 'Percentage Discount',
  dealTitle: '',
  badgeText: '',
  priority: 0,
  linkedProductIds: [],
  linkedCategories: [],
};

// ═══════════════════════════════════════════════════════════════
// IMPORT: Types & parsing
// ═══════════════════════════════════════════════════════════════
type ImportFormat = 'CSV' | 'JSON' | 'Template';

interface ImportRow {
  code: string;
  description?: string;
  type?: DiscountType;
  value?: string;
  minOrder?: number;
  usageLimit?: number;
  perCustomer?: number;
  startDate?: string;
  endDate?: string;
  error?: string;
  valid: boolean;
}

// CSV template header — shown to the user and used for parsing
const CSV_HEADER = [
  'code',
  'description',
  'type',
  'value',
  'minOrder',
  'usageLimit',
  'perCustomer',
  'startDate',
  'endDate',
];

const TEMPLATE_ROWS: ImportRow[] = [
  {
    code: 'WELCOME10',
    description: '10% off for new customers',
    type: 'Percentage',
    value: '10%',
    minOrder: 2000,
    usageLimit: 500,
    perCustomer: 1,
    startDate: '2026-10-01 00:00',
    endDate: '2026-12-31 23:59',
    valid: true,
  },
  {
    code: 'MPESA200',
    description: 'Flat KES 200 off M-Pesa payments',
    type: 'Fixed Amount',
    value: 'KES 200',
    minOrder: 1500,
    usageLimit: 1000,
    perCustomer: 2,
    startDate: '2026-10-01 00:00',
    endDate: '2026-11-30 23:59',
    valid: true,
  },
  {
    code: 'FREESHIP',
    description: 'Free delivery on all orders',
    type: 'Free Shipping',
    value: 'Free',
    minOrder: 0,
    usageLimit: 10000,
    perCustomer: 5,
    startDate: '2026-10-01 00:00',
    endDate: '2026-12-31 23:59',
    valid: true,
  },
];

// Very small CSV parser (handles quoted values with commas)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') i++;
        if (cell !== '' || row.length > 0) {
          row.push(cell.trim());
          rows.push(row);
          row = [];
          cell = '';
        }
      } else {
        cell += c;
      }
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function normaliseType(raw: string): DiscountType {
  const t = raw.trim().toLowerCase();
  if (t === 'percentage' || t === 'percent' || t === '%') return 'Percentage';
  if (t === 'fixed amount' || t === 'fixed' || t === 'amount') return 'Fixed Amount';
  if (t === 'free shipping' || t === 'shipping' || t === 'free') return 'Free Shipping';
  if (t === 'buy x get y' || t === 'bxgy' || t === 'bogo') return 'Buy X Get Y';
  return 'Percentage';
}

function validateRow(row: Partial<ImportRow>, index: number): ImportRow {
  const errors: string[] = [];
  if (!row.code || !row.code.trim()) errors.push('Code required');
  else if (!/^[A-Z0-9_-]+$/i.test(row.code.trim()))
    errors.push('Code A–Z, 0–9, _ or - only');

  if (!row.value || !row.value.trim()) errors.push('Value required');
  if (!row.startDate) errors.push('Start date required');
  if (!row.endDate) errors.push('End date required');
  if (
    row.startDate &&
    row.endDate &&
    new Date(row.endDate) <= new Date(row.startDate)
  )
    errors.push('End must be after start');

  const code = (row.code || '').trim().toUpperCase();

  return {
    code,
    description: row.description || '',
    type: row.type || 'Percentage',
    value: row.value || '',
    minOrder: Number(row.minOrder) || 0,
    usageLimit: Number(row.usageLimit) || 100,
    perCustomer: Number(row.perCustomer) || 1,
    startDate: row.startDate || '',
    endDate: row.endDate || '',
    valid: errors.length === 0,
    error: errors.join(' · ') || undefined,
  };
}

function rowsFromCSV(text: string): ImportRow[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  let data = rows;
  const first = rows[0].map((c) => c.toLowerCase());
  if (first.includes('code') || first.includes('discount code')) {
    data = rows.slice(1);
  }

  const headerMap = rows[0].map((c) => c.toLowerCase().trim());
  const findIndex = (...keys: string[]) =>
    headerMap.findIndex((h) => keys.some((k) => h === k));

  const iCode = findIndex('code', 'discount code', 'coupon');
  const iDesc = findIndex('description', 'desc');
  const iType = findIndex('type', 'discount type');
  const iValue = findIndex('value', 'amount', 'discount value');
  const iMin = findIndex('minorder', 'min order', 'minimum');
  const iUsage = findIndex('usagelimit', 'usage limit', 'max uses', 'max uses');
  const iPer = findIndex('percustomer', 'per customer', 'per customer limit');
  const iStart = findIndex('startdate', 'start date', 'starts');
  const iEnd = findIndex('enddate', 'end date', 'expires');

  const hasHeader = iCode >= 0;

  if (!hasHeader) {
    return data
      .filter((r) => r.some((c) => c))
      .map((r, i) =>
        validateRow(
          {
            code: r[0],
            description: r[1],
            type: normaliseType(r[2] || ''),
            value: r[3],
            minOrder: Number(r[4]) || 0,
            usageLimit: Number(r[5]) || 100,
            perCustomer: Number(r[6]) || 1,
            startDate: r[7],
            endDate: r[8],
          },
          i
        )
      );
  }

  return data
    .filter((r) => r.some((c) => c))
    .map((r, i) =>
      validateRow(
        {
          code: iCode >= 0 ? r[iCode] : '',
          description: iDesc >= 0 ? r[iDesc] : '',
          type: iType >= 0 ? normaliseType(r[iType]) : 'Percentage',
          value: iValue >= 0 ? r[iValue] : '',
          minOrder: iMin >= 0 ? Number(r[iMin]) || 0 : 0,
          usageLimit: iUsage >= 0 ? Number(r[iUsage]) || 100 : 100,
          perCustomer: iPer >= 0 ? Number(r[iPer]) || 1 : 1,
          startDate: iStart >= 0 ? r[iStart] : '',
          endDate: iEnd >= 0 ? r[iEnd] : '',
        },
        i
      )
    );
}

function rowsFromJSON(text: string): ImportRow[] {
  try {
    const parsed = JSON.parse(text);
    const list: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.discounts)
        ? parsed.discounts
        : [];
    return list.map((d, i) =>
      validateRow(
        {
          code: d.code,
          description: d.description,
          type: normaliseType(d.type || 'Percentage'),
          value: String(d.value || ''),
          minOrder: Number(d.minOrder) || 0,
          usageLimit: Number(d.usageLimit) || 100,
          perCustomer: Number(d.perCustomer) || 1,
          startDate: d.startDate,
          endDate: d.endDate,
        },
        i
      )
    );
  } catch {
    return [];
  }
}

interface Props {
  open: boolean;
  initial: Discount | null;
  onClose: () => void;
  onSave: (payload: DiscountPayload) => void;
  /**
   * Optional bulk-import callback.
   * If provided, the modal will call this with multiple payloads.
   */
  onImportBulk?: (payloads: DiscountPayload[]) => void;
}

export default function AddDiscountModal({
  open,
  initial,
  onClose,
  onSave,
  onImportBulk,
}: Props) {
  // ✅ useShallow gives a stable snapshot for the freshly-derived array
  //    returned by getAll(). This kills both the getServerSnapshot warning
  //    AND the "Cannot read properties of undefined (reading 'slice')" crash.
  const allCatalogueProducts = useProducts(
    useShallow((s) => s.getAll())
  );

  const [form, setForm] = useState<DiscountPayload>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Product picker
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerTab, setProductPickerTab] = useState<
    'catalogue' | 'new'
  >('catalogue');
  const [addProductOpen, setAddProductOpen] = useState(false);

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<ImportFormat>('CSV');
  const [importText, setImportText] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load incoming values into the form when the modal opens
  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
            ...EMPTY,
            ...initial,
            startDate: toLocalInput(initial.startDate),
            endDate: toLocalInput(initial.endDate),
          }
          : { ...EMPTY }
      );
      setErrors({});
      setProductSearch('');
      setShowProductPicker(false);
      setProductPickerTab('catalogue');
      // Reset import
      setIsImportOpen(false);
      setImportTab('CSV');
      setImportText('');
      setImportRows([]);
      setImportError(null);
      setImportSuccess(null);
    }
  }, [open, initial]);

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !addProductOpen && !isImportOpen) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, addProductOpen, isImportOpen]);

  const setField = <K extends keyof DiscountPayload>(
    key: K,
    value: DiscountPayload[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key as string];
        return n;
      });
    }
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const source = allCatalogueProducts;
    if (!q) return source;
    return source.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [productSearch, allCatalogueProducts]);

  const toggleProduct = (id: string) => {
    setForm((f) => {
      const has = f.linkedProductIds.includes(id);
      return {
        ...f,
        linkedProductIds: has
          ? f.linkedProductIds.filter((x) => x !== id)
          : [...f.linkedProductIds, id],
      };
    });
    if (errors.linkedProductIds) {
      setErrors((e) => {
        const n = { ...e };
        delete n.linkedProductIds;
        return n;
      });
    }
  };

  const toggleCategory = (cat: string) => {
    setForm((f) => {
      const has = f.linkedCategories.includes(cat);
      return {
        ...f,
        linkedCategories: has
          ? f.linkedCategories.filter((x) => x !== cat)
          : [...f.linkedCategories, cat],
      };
    });
    if (errors.linkedCategories) {
      setErrors((e) => {
        const n = { ...e };
        delete n.linkedCategories;
        return n;
      });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = 'Code is required';
    if (!/^[A-Z0-9_-]+$/.test(form.code.trim()))
      e.code = 'A-Z, 0-9, _ and - only';
    if (!form.description.trim())
      e.description = 'Description is required';
    if (!form.value.trim()) e.value = 'Value is required';
    if (!form.startDate) e.startDate = 'Start date is required';
    if (!form.endDate) e.endDate = 'End date is required';
    if (
      form.startDate &&
      form.endDate &&
      form.endDate <= form.startDate
    )
      e.endDate = 'End must be after start';
    if (
      form.appliesTo === 'Specific Products' &&
      form.linkedProductIds.length === 0
    )
      e.linkedProductIds = 'Select at least one product';
    if (
      form.appliesTo === 'Specific Categories' &&
      form.linkedCategories.length === 0
    )
      e.linkedCategories = 'Select at least one category';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      ...form,
      code: form.code.trim().toUpperCase(),
      startDate: fromLocalInput(form.startDate),
      endDate: fromLocalInput(form.endDate),
      id: initial?.id,
    });
    onClose();
  };

  // ──────────────── Import helpers ────────────────
  const resetImport = () => {
    setImportText('');
    setImportRows([]);
    setImportError(null);
    setImportSuccess(null);
  };

  const handleLoadTemplate = () => {
    setImportTab('Template');
    setImportRows(TEMPLATE_ROWS);
    setImportText('');
    setImportError(null);
    setImportSuccess(null);
  };

  const handleParseText = () => {
    setImportError(null);
    setImportSuccess(null);
    if (!importText.trim()) {
      setImportError('Paste some content or upload a file first.');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      let rows: ImportRow[] = [];
      if (importTab === 'CSV') {
        rows = rowsFromCSV(importText);
      } else if (importTab === 'JSON') {
        rows = rowsFromJSON(importText);
      } else {
        rows = [];
      }
      if (rows.length === 0) {
        setImportError(
          `No ${importTab} rows detected. Check the format and try again.`
        );
        setImportRows([]);
      } else {
        setImportRows(rows);
        const invalid = rows.filter((r) => !r.valid).length;
        setImportSuccess(
          `Parsed ${rows.length} row${rows.length === 1 ? '' : 's'}` +
          (invalid > 0 ? ` · ${invalid} need fixing` : ' · all valid')
        );
      }
      setIsProcessing(false);
    }, 350);
  };

  const handleFileUpload = (file: File) => {
    setImportError(null);
    setImportSuccess(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      setImportText(text);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'json') setImportTab('JSON');
      else setImportTab('CSV');
      setIsProcessing(true);
      setTimeout(() => {
        const rows =
          ext === 'json' ? rowsFromJSON(text) : rowsFromCSV(text);
        if (rows.length === 0) {
          setImportError('No valid rows found in the file.');
          setImportRows([]);
        } else {
          setImportRows(rows);
          const invalid = rows.filter((r) => !r.valid).length;
          setImportSuccess(
            `Imported ${rows.length} row${rows.length === 1 ? '' : 's'} from ${file.name}` +
            (invalid > 0 ? ` · ${invalid} need fixing` : ' · all valid')
          );
        }
        setIsProcessing(false);
      }, 400);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDownloadTemplate = () => {
    const csv = [
      CSV_HEADER.join(','),
      ...TEMPLATE_ROWS.map((r) =>
        [
          r.code,
          `"${r.description}"`,
          r.type,
          r.value,
          r.minOrder,
          r.usageLimit,
          r.perCustomer,
          r.startDate,
          r.endDate,
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'discounts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyImport = () => {
    const valid = importRows.filter((r) => r.valid);
    if (valid.length === 0) {
      setImportError('No valid rows to import. Fix errors and try again.');
      return;
    }

    const payloads: DiscountPayload[] = valid.map((r) => ({
      ...EMPTY,
      code: r.code.trim().toUpperCase(),
      description: r.description || `Imported discount ${r.code}`,
      type: r.type || 'Percentage',
      value: r.value || '',
      minOrder: r.minOrder ?? 0,
      usageLimit: r.usageLimit ?? 100,
      perCustomer: r.perCustomer ?? 1,
      startDate: r.startDate || '',
      endDate: r.endDate || '',
      status: 'Scheduled',
      isMostDeal: false,
      displayOnDealsPage: true,
      promotionType: 'Percentage Discount',
      appliesTo: 'All Products',
      eligibility: 'All Customers',
      targetAudience: 'All People & Customers',
      linkedProductIds: [],
      linkedCategories: [],
    }));

    if (payloads.length === 1) {
      setForm(payloads[0]);
      setIsImportOpen(false);
      setImportSuccess(null);
      setImportError(null);
      setImportRows([]);
      return;
    }

    if (onImportBulk) {
      onImportBulk(payloads);
      setIsImportOpen(false);
      onClose();
    } else {
      setForm(payloads[0]);
      setIsImportOpen(false);
      setImportSuccess(`Imported first row. ${payloads.length - 1} more were skipped.`);
    }
  };

  if (!open) return null;

  const TypeIcon = TYPE_ICONS[form.type] ?? Percent;

  const previewProducts =
    form.appliesTo === 'Specific Products'
      ? allCatalogueProducts
        .filter((p: { id: string }) => form.linkedProductIds.includes(p.id))
        .slice(0, 3)
      : form.appliesTo === 'Specific Categories'
        ? allCatalogueProducts
          .filter((p: { category: string }) =>
            form.linkedCategories.includes(p.category)
          )
          .slice(0, 3)
        : allCatalogueProducts.slice(0, 3);

  const validImportCount = importRows.filter((r) => r.valid).length;
  const invalidImportCount = importRows.length - validImportCount;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">
              {initial ? 'Edit discount' : 'Create discount'}
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Configure the coupon and how it appears on the storefront
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {!initial && (
              <button
                type="button"
                onClick={() => {
                  setIsImportOpen(true);
                  setImportError(null);
                  setImportSuccess(null);
                }}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* BODY */}
        <div className="overflow-y-auto p-3 space-y-4">
          {/* 1. BASICS */}
          <Section icon={<Tag className="w-3.5 h-3.5" />} title="Basics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Code"
                value={form.code}
                onChange={(v) => setField('code', v.toUpperCase())}
                placeholder="SOKOWEEKEND15"
                error={errors.code}
                mono
              />
              <Field
                label="Display image URL"
                value={form.image}
                onChange={(v) => setField('image', v)}
                placeholder="https://…"
                icon={<ImageIcon className="w-3.5 h-3.5" />}
              />
            </div>
            <Field
              label="Description"
              value={form.description}
              onChange={(v) => setField('description', v)}
              placeholder="Short summary shown on the card"
              error={errors.description}
            />
          </Section>

          {/* 2. MECHANICS */}
          <Section
            icon={<TypeIcon className="w-3.5 h-3.5" />}
            title="Discount mechanics"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onChange={(v) => setField('type', v as DiscountType)}
                  options={[
                    'Percentage',
                    'Fixed Amount',
                    'Free Shipping',
                    'Buy X Get Y',
                  ]}
                />
              </div>
              <Field
                label="Value"
                value={form.value}
                onChange={(v) => setField('value', v)}
                placeholder={
                  form.type === 'Percentage' ? '15%' : 'KES 500'
                }
                error={errors.value}
                mono
              />
              <Field
                label="Minimum order (KES)"
                value={String(form.minOrder)}
                onChange={(v) => setField('minOrder', Number(v) || 0)}
                type="number"
                mono
              />
              <Field
                label="Max cap (KES, 0 = none)"
                value={String(form.maxCap)}
                onChange={(v) => setField('maxCap', Number(v) || 0)}
                type="number"
                mono
              />
            </div>
          </Section>

          {/* 3. LIMITS */}
          <Section icon={<Users className="w-3.5 h-3.5" />} title="Limits">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Total usage limit"
                value={String(form.usageLimit)}
                onChange={(v) => setField('usageLimit', Number(v) || 0)}
                type="number"
                mono
              />
              <Field
                label="Per customer"
                value={String(form.perCustomer)}
                onChange={(v) => setField('perCustomer', Number(v) || 0)}
                type="number"
                mono
              />
            </div>
          </Section>

          {/* 4. SCHEDULE */}
          <Section
            icon={<Calendar className="w-3.5 h-3.5" />}
            title="Schedule"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Start date & time"
                value={form.startDate}
                onChange={(v) => setField('startDate', v)}
                type="datetime-local"
                error={errors.startDate}
              />
              <Field
                label="End date & time"
                value={form.endDate}
                onChange={(v) => setField('endDate', v)}
                type="datetime-local"
                error={errors.endDate}
              />
            </div>
            <p className="text-[13px] text-slate-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
              Deals disappear from the storefront the moment this end time
              passes.
            </p>
          </Section>

          {/* 5. TARGETING */}
          <Section icon={<Target className="w-3.5 h-3.5" />} title="Targeting">
            <div>
              <Label>Applies to</Label>
              <Select
                value={form.appliesTo}
                onChange={(v) => setField('appliesTo', v as AppliesTo)}
                options={[
                  'All Products',
                  'Specific Products',
                  'Specific Categories',
                ]}
              />
            </div>

            {/* Specific Categories */}
            {form.appliesTo === 'Specific Categories' && (
              <div>
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const on = form.linkedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-[13px] font-medium border transition ${on
                          ? 'bg-blue-950 text-white border-blue-950'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        {on ? (
                          <CheckSquare className="w-3 h-3" />
                        ) : (
                          <Square className="w-3 h-3" />
                        )}
                        {cat}
                      </button>
                    );
                  })}
                </div>
                {errors.linkedCategories && (
                  <p className="text-[13px] text-red-600 mt-1">
                    {errors.linkedCategories}
                  </p>
                )}
              </div>
            )}

            {/* Specific Products */}
            {form.appliesTo === 'Specific Products' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Products</Label>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker((s) => !s)}
                    className="text-[13px] font-medium text-blue-950 hover:underline"
                  >
                    {showProductPicker ? 'Close picker' : 'Pick products'}
                  </button>
                </div>

                {/* Selected chips */}
                {form.linkedProductIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.linkedProductIds.map((id) => {
                      const p = allCatalogueProducts.find(
                        (x) => x.id === id
                      );
                      if (!p) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-[13px] px-2 py-0.5 rounded-sm"
                        >
                          <span className="truncate max-w-[180px]">
                            {p.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleProduct(id)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {showProductPicker && (
                  <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
                    {/* Tabs */}
                    <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => setProductPickerTab('catalogue')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-medium transition ${productPickerTab === 'catalogue'
                          ? 'bg-white text-blue-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Browse catalogue
                        <span className="ml-1 px-1.5 py-0.5 rounded-sm text-[11px] bg-slate-200 text-slate-700">
                          {allCatalogueProducts.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductPickerTab('new')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-medium transition ${productPickerTab === 'new'
                          ? 'bg-white text-blue-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        Add new product
                      </button>
                    </div>

                    {/* Tab: catalogue */}
                    {productPickerTab === 'catalogue' && (
                      <>
                        <div className="relative border-b border-slate-100">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            value={productSearch}
                            onChange={(e) =>
                              setProductSearch(e.target.value)
                            }
                            placeholder="Search by name, brand, or category…"
                            className="w-full pl-8 pr-3 py-2 text-[13px] focus:outline-none"
                          />
                        </div>
                        <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {filteredProducts.length === 0 ? (
                            <li className="p-3 text-center text-[13px] text-slate-400">
                              No products match.{' '}
                              <button
                                type="button"
                                onClick={() => setProductPickerTab('new')}
                                className="text-blue-950 font-medium hover:underline"
                              >
                                Add a new one?
                              </button>
                            </li>
                          ) : (
                            filteredProducts.map((p) => {
                              const id = String(p.id);
                              const on = form.linkedProductIds.includes(id);
                              return (
                                <li key={id}>
                                  <button
                                    type="button"
                                    onClick={() => toggleProduct(id)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition ${on
                                      ? 'bg-blue-50'
                                      : 'hover:bg-slate-50'
                                      }`}
                                  >
                                    {on ? (
                                      <CheckSquare className="w-4 h-4 text-blue-950 shrink-0" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                    )}
                                    <img
                                      src={p.images[0]}
                                      alt=""
                                      className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[13px] font-medium text-slate-900 truncate">
                                        {p.name}
                                      </p>
                                      <p className="text-[13px] text-slate-500">
                                        {p.brand} · KES{' '}
                                        {p.price.toLocaleString()}
                                      </p>
                                    </div>
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </>
                    )}

                    {/* Tab: add new */}
                    {productPickerTab === 'new' && (
                      <div className="p-4 text-center">
                        <PackagePlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[13px] font-medium text-slate-900">
                          Create a brand-new product
                        </p>
                        <p className="text-[13px] text-slate-500 mt-1 mb-3">
                          It&apos;s added to the catalogue and selected here
                          automatically.
                        </p>
                        <button
                          type="button"
                          onClick={() => setAddProductOpen(true)}
                          className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Open product builder
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {errors.linkedProductIds && (
                  <p className="text-[13px] text-red-600">
                    {errors.linkedProductIds}
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* 6. ELIGIBILITY */}
          <Section icon={<Users className="w-3.5 h-3.5" />} title="Eligibility">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Who can use it</Label>
                <Select
                  value={form.eligibility}
                  onChange={(v) => setField('eligibility', v)}
                  options={[
                    'All Customers',
                    'First-time Buyers',
                    'Returning Customers',
                    'VIP Segment',
                  ]}
                />
              </div>
              <div>
                <Label>Target audience</Label>
                <Select
                  value={form.targetAudience}
                  onChange={(v) => setField('targetAudience', v)}
                  options={[
                    'All People & Customers',
                    'Newsletter Subscribers',
                    'WhatsApp Opt-ins',
                  ]}
                />
              </div>
            </div>
          </Section>

          {/* 7. STOREFRONT */}
          <Section
            icon={<Eye className="w-3.5 h-3.5" />}
            title="Storefront display"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Promotion type (Deals page)</Label>
                <Select
                  value={form.promotionType}
                  onChange={(v) =>
                    setField('promotionType', v as PromotionType)
                  }
                  options={[
                    'Percentage Discount',
                    'Fixed Amount Discount',
                    'Sale Price',
                    'Campaign',
                  ]}
                />
              </div>
              <Field
                label="Badge text override"
                value={form.badgeText}
                onChange={(v) => setField('badgeText', v.toUpperCase())}
                placeholder="15% OFF"
                mono
              />
              <Field
                label="Deal title (marketing)"
                value={form.dealTitle}
                onChange={(v) => setField('dealTitle', v)}
                placeholder="Weekend Flash Sale"
              />
              <Field
                label="Priority (higher shows first)"
                value={String(form.priority)}
                onChange={(v) => setField('priority', Number(v) || 0)}
                type="number"
                mono
              />
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-100">
              <ToggleRow
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Show on Deals page"
                desc="Renders these products on /pages/products/specialdeals"
                value={form.displayOnDealsPage}
                onChange={(v) => setField('displayOnDealsPage', v)}
              />
              <ToggleRow
                icon={<Flame className="w-3.5 h-3.5" />}
                label="Mark as Top Deal"
                desc="Pins to the customer catalog and WhatsApp broadcasts"
                value={form.isMostDeal}
                onChange={(v) => setField('isMostDeal', v)}
              />
            </div>
          </Section>

          {/* 8. PREVIEW */}
          <Section icon={<Zap className="w-3.5 h-3.5" />} title="Preview">
            {!form.displayOnDealsPage ? (
              <p className="text-[13px] text-slate-500 italic">
                Not shown on the Deals page — nothing to preview.
              </p>
            ) : previewProducts.length === 0 ? (
              <p className="text-[13px] text-slate-500 italic">
                Select products or categories to see a preview.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {previewProducts.map((p: any) => (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                  >
                    <div className="aspect-square bg-slate-100 relative">
                      <img
                        src={p.images[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-0 left-0 px-2 py-0.5 text-[10px] font-bold text-white bg-blue-950 rounded-br-sm">
                        {form.badgeText || form.value}
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] uppercase text-slate-500 truncate">
                        {p.brand}
                      </p>
                      <p className="text-[12px] font-semibold text-slate-900 truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Ends{' '}
                        {form.endDate
                          ? new Date(form.endDate).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* FOOTER */}
        <footer className="flex items-center justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            <Check className="w-3.5 h-3.5" />
            {initial ? 'Save changes' : 'Create discount'}
          </button>
        </footer>
      </div>

      {/* IMPORT MODAL (nested) */}
      {isImportOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
          onClick={() => setIsImportOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-950" />
                  Import discounts
                </h2>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Bulk-create discount codes from CSV, JSON, or a ready template
                </p>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Body */}
            <div className="overflow-y-auto p-3 space-y-3">
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-sm">
                {(
                  [
                    { id: 'CSV' as ImportFormat, label: 'CSV', icon: FileSpreadsheet },
                    { id: 'JSON' as ImportFormat, label: 'JSON', icon: FileText },
                    { id: 'Template' as ImportFormat, label: 'Template', icon: Download },
                  ]
                ).map((t) => {
                  const Icon = t.icon;
                  const active = importTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setImportTab(t.id);
                        resetImport();
                      }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition ${active
                        ? 'bg-white text-blue-950 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              {importTab === 'CSV' && (
                <div className="space-y-3">
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/20 rounded-sm p-6 text-center transition"
                  >
                    <FileSpreadsheet className="w-7 h-7 mx-auto text-slate-400" />
                    <p className="text-[13px] font-medium text-slate-900 mt-2">
                      Drop a CSV file here
                    </p>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      or paste rows below
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Choose file
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download template
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                      }}
                    />
                  </div>

                  <div>
                    <Label>Paste CSV content</Label>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={5}
                      placeholder={`${CSV_HEADER.join(',')}\nWELCOME10,"10% off",Percentage,10%,2000,500,1,2026-10-01 00:00,2026-12-31 23:59`}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleParseText}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ClipboardPaste className="w-3.5 h-3.5" />
                      )}
                      {isProcessing ? 'Parsing…' : 'Parse CSV'}
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadTemplate}
                      className="text-[13px] font-medium text-blue-950 hover:underline"
                    >
                      Load example rows
                    </button>
                  </div>
                </div>
              )}

              {importTab === 'JSON' && (
                <div className="space-y-3">
                  <div>
                    <Label>Paste JSON</Label>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={7}
                      placeholder={`[
  {
    "code": "WELCOME10",
    "description": "10% off for new customers",
    "type": "Percentage",
    "value": "10%",
    "minOrder": 2000,
    "usageLimit": 500,
    "perCustomer": 1,
    "startDate": "2026-10-01 00:00",
    "endDate": "2026-12-31 23:59"
  }
]`}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950 resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleParseText}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ClipboardPaste className="w-3.5 h-3.5" />
                    )}
                    {isProcessing ? 'Parsing…' : 'Parse JSON'}
                  </button>
                </div>
              )}

              {importTab === 'Template' && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-[13px] text-blue-900">
                      The template includes 3 example discount codes you can use
                      as-is or edit before applying.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleLoadTemplate}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Load template rows
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download CSV
                    </button>
                  </div>
                </div>
              )}

              {/* Status banners */}
              {importError && (
                <div className="bg-red-50 border border-red-100 rounded-sm p-2 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-red-700">{importError}</p>
                </div>
              )}
              {importSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-emerald-800">{importSuccess}</p>
                </div>
              )}

              {/* Preview parsed rows */}
              {importRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Preview ({importRows.length})</Label>
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="text-emerald-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {validImportCount} valid
                      </span>
                      {invalidImportCount > 0 && (
                        <span className="text-red-600 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {invalidImportCount} invalid
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-sm overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="py-2 px-3 font-medium">Code</th>
                          <th className="py-2 px-3 font-medium">Type</th>
                          <th className="py-2 px-3 font-medium">Value</th>
                          <th className="py-2 px-3 font-medium text-right">
                            Min order
                          </th>
                          <th className="py-2 px-3 font-medium text-right">
                            Max uses
                          </th>
                          <th className="py-2 px-3 font-medium">Expires</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importRows.map((r, i) => (
                          <tr
                            key={i}
                            className={
                              r.valid ? '' : 'bg-red-50/40'
                            }
                          >
                            <td className="py-2 px-3 font-mono font-medium text-blue-950">
                              {r.code || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {r.type || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-900 font-medium">
                              {r.value || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {r.minOrder ? `KES ${r.minOrder.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {r.usageLimit ?? '—'}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500">
                              {r.endDate || '—'}
                            </td>
                            <td className="py-2 px-3">
                              {r.valid ? (
                                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Ready
                                </span>
                              ) : (
                                <span
                                  title={r.error}
                                  className="inline-flex items-center gap-1 text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-sm"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  Fix
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={resetImport}
                className="text-[13px] font-medium text-slate-600 hover:text-slate-900"
              >
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyImport}
                  disabled={validImportCount === 0}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-3.5 h-3.5" />
                  {validImportCount === 1
                    ? 'Apply 1 row'
                    : `Apply ${validImportCount} rows`}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Nested product builder */}
      <AddProductForDiscountModal
        open={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        onCreated={(created) => {
          setForm((f) => ({
            ...f,
            linkedProductIds: f.linkedProductIds.includes(created.id)
              ? f.linkedProductIds
              : [...f.linkedProductIds, created.id],
          }));
          setProductPickerTab('catalogue');
        }}
      />
    </div>
  );
}

/* ══════════ Sub-components ══════════ */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 rounded-sm">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
        <span className="w-6 h-6 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      </header>
      <div className="p-3 space-y-3">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  icon,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="relative">
        {icon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-white border rounded-sm py-2 text-[13px] focus:outline-none focus:ring-1 ${icon ? 'pl-8 pr-3' : 'px-3'
            } ${error
              ? 'border-red-400 focus:ring-red-500'
              : 'border-slate-200 focus:ring-blue-950'
            } ${mono ? 'font-mono' : ''}`}
        />
      </div>
      {error && <p className="text-[13px] text-red-600 mt-1">{error}</p>}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-sm py-2 pl-3 pr-8 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 appearance-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex items-start gap-2">
        <span className="w-6 h-6 rounded-sm bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-900">{label}</p>
          <p className="text-[13px] text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${value ? 'bg-blue-950' : 'bg-slate-300'
          }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'
            }`}
        />
      </button>
    </div>
  );
}