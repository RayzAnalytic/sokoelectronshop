'use client';

import React, { useEffect, useState } from 'react';
import {
    MapPin, Plus, Edit3, Trash2, X, Check, Phone, User, Loader2,
    AlertCircle,
} from 'lucide-react';
import {
    accountApi,
    ApiError,
    type Address,
    type AddressInput,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
// Must match KENYAN_COUNTIES in the backend's config/settings.py.
// If the backend list changes, this must change too. When a config endpoint
// becomes available, fetch from checkoutApi.config() instead.
const KENYAN_COUNTIES = [
    'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
    'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
    'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale',
    'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit',
    'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi',
    'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya',
    'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana',
    'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
];

const EMPTY_FORM: AddressInput = {
    label: 'Home',
    full_name: '',
    phone: '',
    street: '',
    town: '',
    county: 'Nairobi',
    postal_code: '',
    is_default: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AddressesPage() {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Address | null>(null);
    const [form, setForm] = useState<AddressInput>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [toast, setToast] = useState<string | null>(null);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    // ── Fetch addresses on mount ──
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const list = await accountApi.addresses.list();
                if (cancelled) return;
                setAddresses(list);
            } catch (err) {
                if (cancelled) return;
                setLoadError(
                    err instanceof ApiError
                        ? err.message || 'Could not load your addresses.'
                        : 'Could not load your addresses.',
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ── Open modals ──
    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setModalOpen(true);
    };

    const openEdit = (addr: Address) => {
        setEditing(addr);
        setForm({
            label: addr.label,
            full_name: addr.full_name,
            phone: addr.phone,
            street: addr.street,
            town: addr.town,
            county: addr.county,
            postal_code: addr.postal_code,
            is_default: addr.is_default,
        });
        setFormError('');
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
        setFormError('');
    };

    // ── Save (create or update) ──
    const handleSave = async () => {
        // Client-side required check — matches the backend serializer rules.
        if (!form.full_name.trim() || !form.phone.trim() || !form.street.trim() || !form.town.trim()) {
            setFormError('Please fill in all required fields.');
            return;
        }

        setSaving(true);
        setFormError('');

        try {
            if (editing) {
                const updated = await accountApi.addresses.update(editing.id, form);
                setAddresses((prev) =>
                    prev.map((a) => (a.id === editing.id ? updated : a)),
                );
                // If this one became the default, clear the flag on the rest.
                if (updated.is_default) {
                    setAddresses((prev) =>
                        prev.map((a) =>
                            a.id === updated.id ? a : { ...a, is_default: false },
                        ),
                    );
                }
                flash('Address updated.');
            } else {
                const created = await accountApi.addresses.create(form);
                setAddresses((prev) => {
                    const next = created.is_default
                        ? prev.map((a) => ({ ...a, is_default: false }))
                        : prev;
                    return [...next, created];
                });
                flash('Address added.');
            }
            setModalOpen(false);
        } catch (err) {
            setFormError(
                err instanceof ApiError
                    ? err.message || 'Could not save the address.'
                    : 'Could not save the address.',
            );
        } finally {
            setSaving(false);
        }
    };

    // ── Set default ──
    const handleSetDefault = async (id: number) => {
        const previous = addresses;
        // Optimistic update.
        setAddresses((prev) =>
            prev.map((a) => ({ ...a, is_default: a.id === id })),
        );

        try {
            await accountApi.addresses.setDefault(id);
            flash('Default address updated.');
        } catch (err) {
            setAddresses(previous);
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not update the default address.'
                    : 'Could not update the default address.',
            );
        }
    };

    // ── Delete ──
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);

        const target = deleteTarget;
        const previous = addresses;

        // Optimistic remove.
        setAddresses((prev) => prev.filter((a) => a.id !== target.id));

        try {
            await accountApi.addresses.remove(target.id);
            flash('Address removed.');

            // If we removed the default, the backend promotes another one.
            // Refetch to stay in sync.
            if (target.is_default) {
                const list = await accountApi.addresses.list();
                setAddresses(list);
            }
        } catch (err) {
            setAddresses(previous);
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not delete the address.'
                    : 'Could not delete the address.',
            );
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    return (
        <div className="space-y-5">
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-950" />
                        My Addresses
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Manage delivery addresses used at checkout
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Address
                </button>
            </div>

            {/* Load error */}
            {loadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {loadError}
                </div>
            )}

            {/* Loading */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            className="bg-white border border-slate-200 rounded-sm p-5 space-y-3 animate-pulse"
                        >
                            <div className="h-8 w-8 rounded-sm bg-slate-200" />
                            <div className="h-3 w-2/3 bg-slate-200 rounded" />
                            <div className="h-3 w-1/2 bg-slate-200 rounded" />
                            <div className="h-3 w-3/4 bg-slate-200 rounded" />
                        </div>
                    ))}
                </div>
            ) : addresses.length === 0 ? (
                /* Empty state */
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                    <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-sm font-semibold text-slate-900">
                        No addresses saved
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Add your first delivery address to get started.
                    </p>
                </div>
            ) : (
                /* Address grid */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {addresses.map((addr) => (
                        <div
                            key={addr.id}
                            className={`bg-white border rounded-sm p-5 relative ${addr.is_default
                                ? 'border-blue-950 ring-1 ring-blue-950/10'
                                : 'border-slate-200'
                                }`}
                        >
                            {addr.is_default && (
                                <span className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-950 border border-blue-100">
                                    Default
                                </span>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-8 h-8 rounded-sm bg-slate-100 flex items-center justify-center text-slate-700">
                                    <MapPin className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {addr.label}
                                </span>
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-700">
                                <p className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                    {addr.full_name}
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                    {addr.phone}
                                </p>
                                <p className="pt-1 text-slate-600 leading-relaxed">
                                    {addr.street}
                                    <br />
                                    {addr.town}, {addr.county}
                                    {addr.postal_code && ` • ${addr.postal_code}`}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                                {!addr.is_default && (
                                    <button
                                        onClick={() => handleSetDefault(addr.id)}
                                        className="text-[11px] font-medium text-blue-950 hover:underline"
                                    >
                                        Set as default
                                    </button>
                                )}
                                <div className="ml-auto flex items-center gap-1.5">
                                    <button
                                        onClick={() => openEdit(addr)}
                                        className="h-8 w-8 rounded-sm border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition"
                                        aria-label="Edit"
                                    >
                                        <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(addr)}
                                        className="h-8 w-8 rounded-sm border border-slate-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-600 transition"
                                        aria-label="Delete"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit modal */}
            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white w-full max-w-lg rounded-sm shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                            <h2 className="text-sm font-bold text-slate-900">
                                {editing ? 'Edit Address' : 'Add New Address'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4">
                            {/* Label chips */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    Label
                                </label>
                                <div className="flex gap-2">
                                    {['Home', 'Office', 'Other'].map((lbl) => (
                                        <button
                                            key={lbl}
                                            onClick={() => setForm({ ...form, label: lbl })}
                                            className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${form.label === lbl
                                                ? 'bg-blue-950 text-white border-blue-950'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field
                                    label="Full name"
                                    value={form.full_name}
                                    onChange={(v) => setForm({ ...form, full_name: v })}
                                />
                                <Field
                                    label="Phone"
                                    value={form.phone}
                                    onChange={(v) => setForm({ ...form, phone: v })}
                                    placeholder="+2547…"
                                />
                            </div>

                            <Field
                                label="Street / Building / Apt"
                                value={form.street}
                                onChange={(v) => setForm({ ...form, street: v })}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field
                                    label="Town / City"
                                    value={form.town}
                                    onChange={(v) => setForm({ ...form, town: v })}
                                />
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                        County
                                    </label>
                                    <select
                                        value={form.county}
                                        onChange={(e) =>
                                            setForm({ ...form, county: e.target.value })
                                        }
                                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                                    >
                                        {KENYAN_COUNTIES.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Field
                                    label="Postal code"
                                    value={form.postal_code ?? ''}
                                    onChange={(v) =>
                                        setForm({ ...form, postal_code: v })
                                    }
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!form.is_default}
                                    onChange={(e) =>
                                        setForm({ ...form, is_default: e.target.checked })
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                                />
                                <span className="text-xs text-slate-700">
                                    Set as default address
                                </span>
                            </label>

                            {formError && (
                                <div className="bg-red-50 border border-red-100 rounded-sm px-3 py-2 flex items-start gap-2">
                                    <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-red-800">
                                        {formError}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-sm text-xs transition disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white font-medium rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Saving…
                                    </>
                                ) : editing ? (
                                    'Save Changes'
                                ) : (
                                    'Add Address'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm"
                    onClick={() => !deleting && setDeleteTarget(null)}
                >
                    <div
                        className="bg-white w-full max-w-sm rounded-sm shadow-2xl border border-slate-200 p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <span className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                <Trash2 className="h-4 w-4" />
                            </span>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Delete address?
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    &ldquo;{deleteTarget.label}&rdquo; will be
                                    permanently removed from your saved addresses.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-sm text-xs transition disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Deleting…
                                    </>
                                ) : (
                                    'Delete'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field
// ─────────────────────────────────────────────────────────────────────────────
function Field({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                {label}
            </span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
        </label>
    );
}