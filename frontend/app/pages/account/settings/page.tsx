'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    User, Mail, Phone, Lock, MapPin, Bell, Trash2, Plus, Edit3, Check,
    X, AlertCircle, Loader2, ChevronDown, ShieldAlert,
} from 'lucide-react';
import { currentUser } from '@/data/account';

// ---------- Types ----------
type PrefKey = 'whatsappUpdates' | 'emailPromotions' | 'smsPromotions' | 'newsletter';
type Prefs = Record<PrefKey, boolean>;

interface Address {
    id: string;
    label: string;
    name: string;
    phone: string;
    street: string;
    town: string;
    county: string;
    postalCode: string;
    isDefault: boolean;
}

type AddressDraft = Omit<Address, 'id'>;

// ---------- Storage keys ----------
const PREFS_KEY = 'account:preferences';
const PROFILE_KEY = 'account:profile';
const ADDRESSES_KEY = 'account:addresses';

const DEFAULT_PREFS: Prefs = {
    whatsappUpdates: currentUser.preferences.whatsappUpdates,
    emailPromotions: currentUser.preferences.emailPromotions,
    smsPromotions: currentUser.preferences.smsPromotions,
    newsletter: currentUser.preferences.newsletter,
};

const DEFAULT_PROFILE = {
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    email: currentUser.email,
    phone: currentUser.phone,
};

const DEFAULT_ADDRESSES: Address[] = currentUser.addresses.map((a) => ({ ...a }));

const KENYAN_COUNTIES = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Machakos',
    'Kajiado', 'Uasin Gishu', 'Kakamega', 'Meru', 'Nyeri', 'Kilifi',
];

// ---------- Helpers ----------
const genId = () =>
    `addr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyDraft = (): AddressDraft => ({
    label: '',
    name: '',
    phone: '',
    street: '',
    town: '',
    county: 'Nairobi',
    postalCode: '',
    isDefault: false,
});

export default function SettingsPage() {
    // ── Profile ──
    const [profile, setProfile] = useState(DEFAULT_PROFILE);
    const [profileSaving, setProfileSaving] = useState(false);

    // ── Password ──
    const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
    const [passwordSaving, setPasswordSaving] = useState(false);

    // ── Preferences ──
    const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
    const [prefsSaving, setPrefsSaving] = useState(false);

    // ── Addresses ──
    const [addresses, setAddresses] = useState<Address[]>(DEFAULT_ADDRESSES);
    const [addressModal, setAddressModal] = useState<
        | { mode: 'add'; draft: AddressDraft }
        | { mode: 'edit'; id: string; draft: AddressDraft }
        | null
    >(null);
    const [addressDraftErrors, setAddressDraftErrors] = useState<Record<string, string>>({});
    const [addressSaving, setAddressSaving] = useState(false);

    // ── Delete confirms ──
    const [deleteAddressTarget, setDeleteAddressTarget] = useState<Address | null>(null);
    const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
    const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');

    // ── Toast ──
    const [savedMsg, setSavedMsg] = useState<string | null>(null);
    const flash = (msg: string) => {
        setSavedMsg(msg);
        setTimeout(() => setSavedMsg(null), 2500);
    };

    // ── Hydrate from localStorage on mount ──
    useEffect(() => {
        try {
            const rawProfile = localStorage.getItem(PROFILE_KEY);
            if (rawProfile) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(rawProfile) });

            const rawPrefs = localStorage.getItem(PREFS_KEY);
            if (rawPrefs) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(rawPrefs) });

            const rawAddresses = localStorage.getItem(ADDRESSES_KEY);
            if (rawAddresses) setAddresses(JSON.parse(rawAddresses));
        } catch {
            // ignore corrupt storage
        }
    }, []);

    // ── Handlers ──
    const togglePref = (key: PrefKey) => {
        setPrefs((p) => ({ ...p, [key]: !p[key] }));
    };

    const saveProfile = async () => {
        setProfileSaving(true);
        await new Promise((r) => setTimeout(r, 500));
        try {
            localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
            flash('Profile updated.');
        } catch {
            flash('Could not save profile.');
        } finally {
            setProfileSaving(false);
        }
    };

    const savePreferences = async () => {
        setPrefsSaving(true);
        await new Promise((r) => setTimeout(r, 400));
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
            flash('Preferences saved.');
        } catch {
            flash('Could not save preferences.');
        } finally {
            setPrefsSaving(false);
        }
    };

    const updatePassword = async () => {
        const errors: Record<string, string> = {};
        if (!passwords.current) errors.current = 'Enter your current password';
        if (!passwords.next) errors.next = 'Enter a new password';
        else if (passwords.next.length < 8) errors.next = 'Password must be at least 8 characters';
        if (!passwords.confirm) errors.confirm = 'Confirm your new password';
        else if (passwords.confirm !== passwords.next) errors.confirm = 'Passwords do not match';

        setPasswordErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setPasswordSaving(true);
        await new Promise((r) => setTimeout(r, 700));
        setPasswordSaving(false);
        setPasswords({ current: '', next: '', confirm: '' });
        flash('Password updated.');
    };

    // ── Address modal ──
    const openAddAddress = () => {
        setAddressDraftErrors({});
        setAddressModal({ mode: 'add', draft: emptyDraft() });
    };

    const openEditAddress = (addr: Address) => {
        setAddressDraftErrors({});
        const { id, ...draft } = addr;
        setAddressModal({ mode: 'edit', id, draft });
    };

    const closeAddressModal = () => {
        if (addressSaving) return;
        setAddressModal(null);
        setAddressDraftErrors({});
    };

    const updateDraft = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => {
        if (!addressModal) return;
        setAddressModal({ ...addressModal, draft: { ...addressModal.draft, [key]: value } });
        if (addressDraftErrors[key]) {
            setAddressDraftErrors((prev) => {
                const next = { ...prev };
                delete next[key as string];
                return next;
            });
        }
    };

    const validateDraft = (draft: AddressDraft) => {
        const errors: Record<string, string> = {};
        if (!draft.label.trim()) errors.label = 'Label is required';
        if (!draft.name.trim()) errors.name = 'Full name is required';
        if (!draft.phone.trim()) errors.phone = 'Phone is required';
        if (!draft.street.trim()) errors.street = 'Street is required';
        if (!draft.town.trim()) errors.town = 'Town is required';
        if (!draft.county.trim()) errors.county = 'County is required';
        return errors;
    };

    const saveAddress = async () => {
        if (!addressModal) return;
        const errors = validateDraft(addressModal.draft);
        setAddressDraftErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setAddressSaving(true);
        await new Promise((r) => setTimeout(r, 500));

        setAddresses((prev) => {
            let next: Address[];
            const draft = addressModal.draft;

            if (addressModal.mode === 'add') {
                const newAddr: Address = { id: genId(), ...draft };
                next = draft.isDefault
                    ? [...prev.map((a) => ({ ...a, isDefault: false })), newAddr]
                    : [...prev, newAddr];
            } else {
                next = prev.map((a) => {
                    if (a.id === addressModal.id) return { ...a, ...draft };
                    return draft.isDefault ? { ...a, isDefault: false } : a;
                });
            }

            try {
                localStorage.setItem(ADDRESSES_KEY, JSON.stringify(next));
            } catch {
                /* ignore */
            }
            return next;
        });

        setAddressSaving(false);
        setAddressModal(null);
        flash(addressModal.mode === 'add' ? 'Address added.' : 'Address updated.');
    };

    // ── Delete address ──
    const confirmDeleteAddress = async () => {
        if (!deleteAddressTarget) return;
        const id = deleteAddressTarget.id;
        await new Promise((r) => setTimeout(r, 300));
        setAddresses((prev) => {
            const next = prev.filter((a) => a.id !== id);
            try {
                localStorage.setItem(ADDRESSES_KEY, JSON.stringify(next));
            } catch {
                /* ignore */
            }
            return next;
        });
        setDeleteAddressTarget(null);
        flash('Address removed.');
    };

    // ── Delete account ──
    const confirmDeleteAccount = async () => {
        if (deleteAccountConfirm !== 'DELETE') return;
        await new Promise((r) => setTimeout(r, 600));
        try {
            localStorage.removeItem(PROFILE_KEY);
            localStorage.removeItem(PREFS_KEY);
            localStorage.removeItem(ADDRESSES_KEY);
        } catch {
            /* ignore */
        }
        setDeleteAccountOpen(false);
        setDeleteAccountConfirm('');
        flash('Account deletion requested.');
    };

    const anyModalOpen = !!(addressModal || deleteAddressTarget || deleteAccountOpen);

    // Freeze body scroll while a modal is open
    useEffect(() => {
        if (anyModalOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [anyModalOpen]);

    // ESC closes the topmost modal
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (addressModal) closeAddressModal();
            else if (deleteAddressTarget) setDeleteAddressTarget(null);
            else if (deleteAccountOpen) {
                setDeleteAccountOpen(false);
                setDeleteAccountConfirm('');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [addressModal, deleteAddressTarget, deleteAccountOpen, addressSaving]);

    return (
        <div className="space-y-5 relative">
            {/* ── Page content — dims and blurs when a modal is open ── */}
            <div
                className={`space-y-5 transition-all duration-200 ${
                    anyModalOpen ? 'filter blur-[2px] brightness-75 pointer-events-none select-none' : ''
                }`}
            >
                {/* Header */}
                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <h1 className="text-lg font-bold text-slate-900">Account Settings</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Manage your profile, security, addresses, and preferences
                    </p>
                </div>

                {/* 1. Profile */}
                <section className="bg-white border border-slate-200 rounded-sm">
                    <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
                    </header>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="First name"
                                value={profile.firstName}
                                onChange={(v) => setProfile({ ...profile, firstName: v })}
                            />
                            <Field
                                label="Last name"
                                value={profile.lastName}
                                onChange={(v) => setProfile({ ...profile, lastName: v })}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Email"
                                value={profile.email}
                                onChange={(v) => setProfile({ ...profile, email: v })}
                                icon={<Mail className="h-3.5 w-3.5" />}
                                type="email"
                            />
                            <Field
                                label="Phone"
                                value={profile.phone}
                                onChange={(v) => setProfile({ ...profile, phone: v })}
                                icon={<Phone className="h-3.5 w-3.5" />}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={saveProfile}
                                disabled={profileSaving}
                                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {profileSaving ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    'Save Profile'
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* 2. Password */}
                <section className="bg-white border border-slate-200 rounded-sm">
                    <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-slate-500" />
                        <h2 className="text-sm font-semibold text-slate-900">Password</h2>
                    </header>
                    <div className="p-5 space-y-4">
                        <Field
                            label="Current password"
                            type="password"
                            value={passwords.current}
                            onChange={(v) => setPasswords({ ...passwords, current: v })}
                            error={passwordErrors.current}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="New password"
                                type="password"
                                value={passwords.next}
                                onChange={(v) => setPasswords({ ...passwords, next: v })}
                                error={passwordErrors.next}
                            />
                            <Field
                                label="Confirm new password"
                                type="password"
                                value={passwords.confirm}
                                onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                                error={passwordErrors.confirm}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={updatePassword}
                                disabled={passwordSaving}
                                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {passwordSaving ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Updating…
                                    </>
                                ) : (
                                    'Update Password'
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* 3. Addresses */}
                <section className="bg-white border border-slate-200 rounded-sm">
                    <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-500" />
                            <h2 className="text-sm font-semibold text-slate-900">Addresses</h2>
                        </div>
                        <button
                            type="button"
                            onClick={openAddAddress}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-950 hover:underline"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Address
                        </button>
                    </header>
                    {addresses.length === 0 ? (
                        <div className="p-10 text-center">
                            <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-500">
                                No addresses saved yet.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {addresses.map((addr) => (
                                <li key={addr.id} className="p-5 flex items-start justify-between gap-3">
                                    <div className="text-xs text-slate-700 leading-relaxed">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-semibold text-slate-900">
                                                {addr.label}
                                            </span>
                                            {addr.isDefault && (
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-950 border border-blue-100">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p>
                                            {addr.name} • {addr.phone}
                                        </p>
                                        <p>{addr.street}</p>
                                        <p>
                                            {addr.town}, {addr.county} {addr.postalCode}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => openEditAddress(addr)}
                                            className="h-8 w-8 rounded-sm border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition"
                                            aria-label="Edit address"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteAddressTarget(addr)}
                                            className="h-8 w-8 rounded-sm border border-slate-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-red-600 transition"
                                            aria-label="Delete address"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* 4. Communication preferences */}
                <section className="bg-white border border-slate-200 rounded-sm">
                    <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Bell className="h-4 w-4 text-slate-500" />
                        <h2 className="text-sm font-semibold text-slate-900">
                            Communication Preferences
                        </h2>
                    </header>
                    <div className="p-5 space-y-3">
                        {(
                            [
                                { key: 'whatsappUpdates', label: 'Order updates via WhatsApp', desc: 'Get delivery and payment alerts on WhatsApp' },
                                { key: 'emailPromotions', label: 'Promotions via email', desc: 'Deals, new arrivals, and special offers' },
                                { key: 'smsPromotions', label: 'Promotions via SMS', desc: 'Occasional SMS-only discounts' },
                                { key: 'newsletter', label: 'Newsletter', desc: 'Weekly roundup of tech news and picks' },
                            ] as const
                        ).map(({ key, label, desc }) => (
                            <PrefToggle
                                key={key}
                                label={label}
                                desc={desc}
                                value={prefs[key]}
                                onToggle={() => togglePref(key)}
                            />
                        ))}
                        <div className="flex justify-end pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={savePreferences}
                                disabled={prefsSaving}
                                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {prefsSaving ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    'Save Preferences'
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* 5. Danger zone */}
                <section className="bg-white border border-red-200 rounded-sm">
                    <header className="px-5 py-4 border-b border-red-100 flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
                    </header>
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-slate-900">Delete account</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Permanently delete your account and all associated data. This cannot
                                be undone.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setDeleteAccountOpen(true)}
                            className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-sm text-xs shrink-0 transition"
                        >
                            Delete Account
                        </button>
                    </div>
                </section>
            </div>

            {/* ── Toast ── */}
            {savedMsg && (
                <div className="fixed bottom-6 right-6 z-[80] bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {savedMsg}
                </div>
            )}

            {/* ── Address modal ── */}
            {addressModal && (
                <Modal onClose={closeAddressModal} title={addressModal.mode === 'add' ? 'Add Address' : 'Edit Address'}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Label"
                                value={addressModal.draft.label}
                                onChange={(v) => updateDraft('label', v)}
                                placeholder="e.g. Home, Office"
                                error={addressDraftErrors.label}
                            />
                            <Field
                                label="Full name"
                                value={addressModal.draft.name}
                                onChange={(v) => updateDraft('name', v)}
                                placeholder="Recipient name"
                                error={addressDraftErrors.name}
                            />
                        </div>

                        <Field
                            label="Phone"
                            value={addressModal.draft.phone}
                            onChange={(v) => updateDraft('phone', v)}
                            placeholder="+254 7XX XXX XXX"
                            icon={<Phone className="h-3.5 w-3.5" />}
                            error={addressDraftErrors.phone}
                        />

                        <Field
                            label="Street address"
                            value={addressModal.draft.street}
                            onChange={(v) => updateDraft('street', v)}
                            placeholder="Building, street, apartment"
                            error={addressDraftErrors.street}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field
                                label="Town / city"
                                value={addressModal.draft.town}
                                onChange={(v) => updateDraft('town', v)}
                                placeholder="e.g. Nairobi"
                                error={addressDraftErrors.town}
                            />
                            <div>
                                <label className="block">
                                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                        County
                                    </span>
                                    <div className="relative">
                                        <select
                                            value={addressModal.draft.county}
                                            onChange={(e) => updateDraft('county', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-sm py-2 px-3 pr-8 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950 appearance-none"
                                        >
                                            {KENYAN_COUNTIES.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    </div>
                                    {addressDraftErrors.county && (
                                        <p className="text-[11px] text-red-600 mt-1">
                                            {addressDraftErrors.county}
                                        </p>
                                    )}
                                </label>
                            </div>
                            <Field
                                label="Postal code"
                                value={addressModal.draft.postalCode}
                                onChange={(v) => updateDraft('postalCode', v)}
                                placeholder="Optional"
                            />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={addressModal.draft.isDefault}
                                onChange={(e) => updateDraft('isDefault', e.target.checked)}
                                className="h-4 w-4 rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950"
                            />
                            <span className="text-xs text-slate-700">
                                Set as default shipping address
                            </span>
                        </label>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={closeAddressModal}
                                disabled={addressSaving}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveAddress}
                                disabled={addressSaving}
                                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {addressSaving ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Saving…
                                    </>
                                ) : addressModal.mode === 'add' ? (
                                    'Add Address'
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Delete address confirm ── */}
            {deleteAddressTarget && (
                <Modal onClose={() => setDeleteAddressTarget(null)} maxWidth="max-w-md">
                    <div className="text-center space-y-3">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto border border-red-100">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                                Delete &ldquo;{deleteAddressTarget.label}&rdquo;?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                This address will be removed from your account. This action cannot
                                be undone.
                            </p>
                        </div>
                        <div className="flex justify-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setDeleteAddressTarget(null)}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteAddress}
                                className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-sm text-xs transition"
                            >
                                Delete Address
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Delete account confirm ── */}
            {deleteAccountOpen && (
                <Modal onClose={() => {
                    setDeleteAccountOpen(false);
                    setDeleteAccountConfirm('');
                }} maxWidth="max-w-md">
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto border border-red-100">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Delete your account?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                This permanently removes your profile, addresses, preferences, and
                                order history. This cannot be undone.
                            </p>
                        </div>
                        <div>
                            <label className="block">
                                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                    Type DELETE to confirm
                                </span>
                                <input
                                    type="text"
                                    value={deleteAccountConfirm}
                                    onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm py-2 px-3 text-xs text-slate-900 font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-400"
                                />
                            </label>
                        </div>
                        <div className="flex justify-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setDeleteAccountOpen(false);
                                    setDeleteAccountConfirm('');
                                }}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteAccount}
                                disabled={deleteAccountConfirm !== 'DELETE'}
                                className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Permanently Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════
   Reusable modal — click backdrop or ESC to close
   ══════════════════════════════════════════ */
function Modal({
    children,
    onClose,
    title,
    maxWidth = 'max-w-2xl',
}: {
    children: React.ReactNode;
    onClose: () => void;
    title?: string;
    maxWidth?: string;
}) {
    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className={`bg-white border border-slate-200 rounded-sm shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </header>
                )}
                <div className="p-5 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════
   Realistic iOS-style toggle
   ══════════════════════════════════════════ */
function PrefToggle({
    label,
    desc,
    value,
    onToggle,
}: {
    label: string;
    desc: string;
    value: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-start justify-between gap-4 py-1">
            <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900">{label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={value}
                aria-label={label}
                onClick={onToggle}
                className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-950/30 focus:ring-offset-1 ${
                    value ? 'bg-blue-950' : 'bg-slate-300 hover:bg-slate-400/70'
                }`}
            >
                <span
                    className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out ${
                        value ? 'translate-x-[20px]' : 'translate-x-[2px]'
                    }`}
                />
            </button>
        </div>
    );
}

/* ══════════════════════════════════════════
   Small reusable field
   ══════════════════════════════════════════ */
function Field({
    label,
    value,
    onChange,
    type = 'text',
    icon,
    placeholder,
    error,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    icon?: React.ReactNode;
    placeholder?: string;
    error?: string;
}) {
    return (
        <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                {label}
            </span>
            <div className="relative">
                {icon && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {icon}
                    </span>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full bg-slate-50 border rounded-sm py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 ${
                        icon ? 'pl-9 pr-3' : 'px-3'
                    } ${
                        error
                            ? 'border-red-400 focus:ring-red-600'
                            : 'border-slate-200 focus:ring-blue-950'
                    }`}
                />
            </div>
            {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
        </label>
    );
}