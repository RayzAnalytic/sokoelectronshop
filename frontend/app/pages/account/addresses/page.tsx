'use client';

import React, { useState } from 'react';
import { MapPin, Plus, Edit3, Trash2, X, Check, Phone, User } from 'lucide-react';
import { currentUser } from '@/data/account';

interface Address {
    id: string;
    label: string;
    name: string;
    phone: string;
    street: string;
    town: string;
    county: string;
    postalCode?: string;
    isDefault: boolean;
}

const KENYAN_COUNTIES = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Machakos',
    'Kajiado', 'Uasin Gishu', 'Kakamega', 'Meru', 'Nyeri', 'Kilifi',
];

const EMPTY_FORM: Omit<Address, 'id'> = {
    label: 'Home',
    name: '',
    phone: '',
    street: '',
    town: '',
    county: 'Nairobi',
    postalCode: '',
    isDefault: false,
};

export default function AddressesPage() {
    const [addresses, setAddresses] = useState<Address[]>(currentUser.addresses);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Address | null>(null);
    const [form, setForm] = useState<Omit<Address, 'id'>>(EMPTY_FORM);
    const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
    };

    const openEdit = (addr: Address) => {
        setEditing(addr);
        setForm({ ...addr });
        setModalOpen(true);
    };

    const handleSave = () => {
        if (!form.name.trim() || !form.phone.trim() || !form.street.trim() || !form.town.trim()) {
            flash('Please fill all required fields.');
            return;
        }
        if (editing) {
            setAddresses((prev) =>
                prev.map((a) =>
                    a.id === editing.id
                        ? { ...form, id: editing.id }
                        : form.isDefault
                            ? { ...a, isDefault: false }
                            : a
                )
            );
            flash('Address updated.');
        } else {
            const newAddr: Address = { ...form, id: `addr_${Date.now()}` };
            setAddresses((prev) => [
                ...(form.isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev),
                newAddr,
            ]);
            flash('Address added.');
        }
        setModalOpen(false);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        setAddresses((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        flash('Address removed.');
        setDeleteTarget(null);
    };

    const setDefault = (id: string) => {
        setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
        flash('Default address updated.');
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
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Address
                </button>
            </div>

            {/* Address list */}
            {addresses.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                    <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-sm font-semibold text-slate-900">No addresses saved</h2>
                    <p className="text-xs text-slate-500 mt-1">Add your first delivery address to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {addresses.map((addr) => (
                        <div
                            key={addr.id}
                            className={`bg-white border rounded-sm p-5 relative ${
                                addr.isDefault ? 'border-blue-950 ring-1 ring-blue-950/10' : 'border-slate-200'
                            }`}
                        >
                            {addr.isDefault && (
                                <span className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-950 border border-blue-100">
                                    Default
                                </span>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-8 h-8 rounded-sm bg-slate-100 flex items-center justify-center text-slate-700">
                                    <MapPin className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-slate-900">{addr.label}</span>
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-700">
                                <p className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                    {addr.name}
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                    {addr.phone}
                                </p>
                                <p className="pt-1 text-slate-600 leading-relaxed">
                                    {addr.street}<br />
                                    {addr.town}, {addr.county} {addr.postalCode && `• ${addr.postalCode}`}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                                {!addr.isDefault && (
                                    <button
                                        onClick={() => setDefault(addr.id)}
                                        className="text-[11px] font-medium text-blue-950 hover:underline"
                                    >
                                        Set as default
                                    </button>
                                )}
                                <div className="ml-auto flex items-center gap-1.5">
                                    <button
                                        onClick={() => openEdit(addr)}
                                        className="h-8 w-8 rounded-sm border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
                                        aria-label="Edit"
                                    >
                                        <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(addr)}
                                        className="h-8 w-8 rounded-sm border border-slate-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-600"
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
                    onClick={() => setModalOpen(false)}
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
                                onClick={() => setModalOpen(false)}
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
                                            className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${
                                                form.label === lbl
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
                                <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+2547…" />
                            </div>

                            <Field label="Street / Building / Apt" value={form.street} onChange={(v) => setForm({ ...form, street: v })} />

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label="Town / City" value={form.town} onChange={(v) => setForm({ ...form, town: v })} />
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                        County
                                    </label>
                                    <select
                                        value={form.county}
                                        onChange={(e) => setForm({ ...form, county: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                                    >
                                        {KENYAN_COUNTIES.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <Field label="Postal code" value={form.postalCode ?? ''} onChange={(v) => setForm({ ...form, postalCode: v })} />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isDefault}
                                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                                />
                                <span className="text-xs text-slate-700">Set as default address</span>
                            </label>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-sm text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white font-medium rounded-sm text-xs"
                            >
                                {editing ? 'Save Changes' : 'Add Address'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm"
                    onClick={() => setDeleteTarget(null)}
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
                                <h3 className="text-sm font-bold text-slate-900">Delete address?</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    "{deleteTarget.label}" will be permanently removed from your saved addresses.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-sm text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-sm text-xs"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

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