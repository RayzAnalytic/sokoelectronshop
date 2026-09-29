'use client';

import React, { useEffect, useState } from 'react';
import {
    User, Mail, Phone, Lock, MapPin, Bell, Trash2, Plus, Edit3, Check,
    X, AlertCircle, Loader2, ChevronDown, ShieldAlert,
} from 'lucide-react';
import {
    api,
    accountApi,
    ApiError,
    type Address,
    type AddressInput,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
// Must match KENYAN_COUNTIES in the backend's config/settings.py.
// When a config endpoint becomes available, fetch from checkoutApi.config().
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

// Must match MinimumLengthValidator in the backend's config/settings.py.
const MIN_PASSWORD_LENGTH = 10;

const emptyAddressDraft = (): AddressInput => ({
    label: 'Home',
    full_name: '',
    phone: '',
    street: '',
    town: '',
    county: 'Nairobi',
    postal_code: '',
    is_default: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * DRF returns field errors as `{ field_name: ["message", ...] }`. This
 * flattens them into a single map for inline display under form fields.
 */
function extractFieldErrors(data: unknown): Record<string, string> {
    if (!data || typeof data !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (Array.isArray(value) && value.length > 0) {
            out[key] = String(value[0]);
        } else if (typeof value === 'string') {
            out[key] = value;
        }
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    // ── Loading / error (initial fetch) ──
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // ── Profile ──
    const [profile, setProfile] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
    });
    const [profileSaving, setProfileSaving] = useState(false);

    // ── Password ──
    const [passwords, setPasswords] = useState({
        current: '',
        next: '',
        confirm: '',
    });
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
    const [passwordSaving, setPasswordSaving] = useState(false);

    // ── Preferences ──
    const [prefs, setPrefs] = useState({
        whatsappUpdates: false,
        emailPromotions: false,
        smsPromotions: false,
        newsletter: false,
    });
    const [prefsSaving, setPrefsSaving] = useState(false);

    // ── Addresses ──
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [addressModal, setAddressModal] = useState<
        | { mode: 'add'; draft: AddressInput }
        | { mode: 'edit'; id: number; draft: AddressInput }
        | null
    >(null);
    const [addressDraftErrors, setAddressDraftErrors] = useState<
        Record<string, string>
    >({});
    const [addressSaving, setAddressSaving] = useState(false);

    // ── Delete confirms ──
    const [deleteAddressTarget, setDeleteAddressTarget] = useState<Address | null>(null);
    const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
    const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
    const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);

    // ── Toast ──
    const [savedMsg, setSavedMsg] = useState<string | null>(null);
    const flash = (msg: string) => {
        setSavedMsg(msg);
        setTimeout(() => setSavedMsg(null), 2500);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Initial load
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const [profileRes, addressesRes] = await Promise.allSettled([
                accountApi.profile.get(),
                accountApi.addresses.list(),
            ]);

            if (cancelled) return;

            if (profileRes.status === 'fulfilled') {
                const p = profileRes.value;
                setProfile({
                    firstName: p.first_name,
                    lastName: p.last_name,
                    email: p.email,
                    phone: p.phone,
                });
                setPrefs({
                    whatsappUpdates: p.whatsapp_updates,
                    emailPromotions: p.email_promotions,
                    smsPromotions: p.sms_promotions,
                    newsletter: p.newsletter,
                });
            } else {
                setLoadError(
                    profileRes.reason instanceof ApiError
                        ? profileRes.reason.message ||
                        'Could not load your profile.'
                        : 'Could not load your profile.',
                );
            }

            if (addressesRes.status === 'fulfilled') {
                setAddresses(addressesRes.value);
            }

            setIsLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Profile
    // ─────────────────────────────────────────────────────────────────────────
    const saveProfile = async () => {
        setProfileSaving(true);
        try {
            const updated = await accountApi.profile.update({
                first_name: profile.firstName,
                last_name: profile.lastName,
                phone: profile.phone,
            });
            setProfile({
                firstName: updated.first_name,
                lastName: updated.last_name,
                email: updated.email,
                phone: updated.phone,
            });
            flash('Profile updated.');
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not save profile.'
                    : 'Could not save profile.',
            );
        } finally {
            setProfileSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Preferences
    // ─────────────────────────────────────────────────────────────────────────
    const togglePref = (key: keyof typeof prefs) => {
        setPrefs((p) => ({ ...p, [key]: !p[key] }));
    };

    const savePreferences = async () => {
        setPrefsSaving(true);
        try {
            await accountApi.profile.updatePreferences({
                whatsapp_updates: prefs.whatsappUpdates,
                email_promotions: prefs.emailPromotions,
                sms_promotions: prefs.smsPromotions,
                newsletter: prefs.newsletter,
            });
            flash('Preferences saved.');
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not save preferences.'
                    : 'Could not save preferences.',
            );
        } finally {
            setPrefsSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Password
    // ─────────────────────────────────────────────────────────────────────────
    const updatePassword = async () => {
        const errors: Record<string, string> = {};
        if (!passwords.current) errors.current = 'Enter your current password';
        if (!passwords.next) errors.next = 'Enter a new password';
        else if (passwords.next.length < MIN_PASSWORD_LENGTH)
            errors.next = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        if (!passwords.confirm) errors.confirm = 'Confirm your new password';
        else if (passwords.confirm !== passwords.next)
            errors.confirm = 'Passwords do not match';

        setPasswordErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setPasswordSaving(true);
        try {
            await api.changePassword(passwords.current, passwords.next);
            setPasswords({ current: '', next: '', confirm: '' });
            setPasswordErrors({});
            flash('Password updated.');
        } catch (err) {
            if (err instanceof ApiError && err.status === 400) {
                // Backend returns { current_password: [...], new_password: [...] }
                const fields = extractFieldErrors(err.data);
                const mapped: Record<string, string> = {};
                if (fields.current_password) mapped.current = fields.current_password;
                if (fields.new_password) mapped.next = fields.new_password;
                setPasswordErrors(mapped);
            } else {
                flash(
                    err instanceof ApiError
                        ? err.message || 'Could not update password.'
                        : 'Could not update password.',
                );
            }
        } finally {
            setPasswordSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Addresses
    // ─────────────────────────────────────────────────────────────────────────
    const openAddAddress = () => {
        setAddressDraftErrors({});
        setAddressModal({ mode: 'add', draft: emptyAddressDraft() });
    };

    const openEditAddress = (addr: Address) => {
        setAddressDraftErrors({});
        setAddressModal({
            mode: 'edit',
            id: addr.id,
            draft: {
                label: addr.label,
                full_name: addr.full_name,
                phone: addr.phone,
                street: addr.street,
                town: addr.town,
                county: addr.county,
                postal_code: addr.postal_code,
                is_default: addr.is_default,
            },
        });
    };

    const closeAddressModal = () => {
        if (addressSaving) return;
        setAddressModal(null);
        setAddressDraftErrors({});
    };

    const updateDraft = <K extends keyof AddressInput>(
        key: K,
        value: AddressInput[K],
    ) => {
        if (!addressModal) return;
        setAddressModal({
            ...addressModal,
            draft: { ...addressModal.draft, [key]: value },
        });
        if (addressDraftErrors[key]) {
            setAddressDraftErrors((prev) => {
                const next = { ...prev };
                delete next[key as string];
                return next;
            });
        }
    };

    const saveAddress = async () => {
        if (!addressModal) return;

        // Client-side required check — matches the backend serializer.
        const errors: Record<string, string> = {};
        if (!addressModal.draft.label.trim()) errors.label = 'Label is required';
        if (!addressModal.draft.full_name.trim())
            errors.full_name = 'Full name is required';
        if (!addressModal.draft.phone.trim()) errors.phone = 'Phone is required';
        if (!addressModal.draft.street.trim()) errors.street = 'Street is required';
        if (!addressModal.draft.town.trim()) errors.town = 'Town is required';
        if (!addressModal.draft.county.trim()) errors.county = 'County is required';

        setAddressDraftErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setAddressSaving(true);
        try {
            if (addressModal.mode === 'add') {
                const created = await accountApi.addresses.create(
                    addressModal.draft,
                );
                setAddresses((prev) => {
                    const next = created.is_default
                        ? prev.map((a) => ({ ...a, is_default: false }))
                        : prev;
                    return [...next, created];
                });
                flash('Address added.');
            } else {
                const updated = await accountApi.addresses.update(
                    addressModal.id,
                    addressModal.draft,
                );
                setAddresses((prev) =>
                    prev.map((a) => {
                        if (a.id === updated.id) return updated;
                        return updated.is_default
                            ? { ...a, is_default: false }
                            : a;
                    }),
                );
                flash('Address updated.');
            }
            setAddressModal(null);
        } catch (err) {
            if (err instanceof ApiError && err.status === 400) {
                setAddressDraftErrors(extractFieldErrors(err.data));
            } else {
                flash(
                    err instanceof ApiError
                        ? err.message || 'Could not save address.'
                        : 'Could not save address.',
                );
            }
        } finally {
            setAddressSaving(false);
        }
    };

    const confirmDeleteAddress = async () => {
        if (!deleteAddressTarget) return;
        const target = deleteAddressTarget;

        // Optimistic remove.
        const previous = addresses;
        setAddresses((prev) => prev.filter((a) => a.id !== target.id));
        setDeleteAddressTarget(null);

        try {
            await accountApi.addresses.remove(target.id);
            flash('Address removed.');

            // If we removed the default, the backend promotes another.
            // Refetch to sync.
            if (target.is_default) {
                const list = await accountApi.addresses.list();
                setAddresses(list);
            }
        } catch (err) {
            setAddresses(previous);
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not delete address.'
                    : 'Could not delete address.',
            );
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Delete account
    // ─────────────────────────────────────────────────────────────────────────
    const confirmDeleteAccount = async () => {
        if (deleteAccountConfirm !== 'DELETE') return;
        setDeleteAccountBusy(true);
        try {
            await accountApi.profile.delete();
            // Backend logs us out server-side. Force the browser to the home page.
            window.location.href = '/';
        } catch (err) {
            setDeleteAccountBusy(false);
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not delete account.'
                    : 'Could not delete account.',
            );
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Effects: body scroll lock + ESC handling
    // ─────────────────────────────────────────────────────────────────────────
    const anyModalOpen = !!(
        addressModal ||
        deleteAddressTarget ||
        deleteAccountOpen
    );

    useEffect(() => {
        if (anyModalOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [anyModalOpen]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addressModal, deleteAddressTarget, deleteAccountOpen, addressSaving]);

    // ─────────────────────────────────────────────────────────────────────────
    // Loading state
    // ─────────────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-64 bg-slate-200 rounded mt-3 animate-pulse" />
                </div>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="bg-white border border-slate-200 rounded-sm p-5 space-y-4 animate-pulse"
                    >
                        <div className="h-4 w-24 bg-slate-200 rounded" />
                        <div className="h-8 w-full bg-slate-100 rounded" />
                        <div className="h-8 w-full bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5 relative">
            <div
                className={`space-y-5 transition-all duration-200 ${anyModalOpen
                    ? 'filter blur-[2px] brightness-75 pointer-events-none select-none'
                    : ''
                    }`}
            >
                {/* Header */}
                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <h1 className="text-lg font-bold text-slate-900">
                        Account Settings
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Manage your profile, security, addresses, and preferences
                    </p>
                </div>

                {/* Load error banner */}
                {loadError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {loadError}
                    </div>
                )}

                {/* 1. Profile */}
                <section className="bg-white border border-slate-200 rounded-sm">
                    <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <h2 className="text-sm font-semibold text-slate-900">
                            Profile
                        </h2>
                    </header>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="First name"
                                value={profile.firstName}
                                onChange={(v) =>
                                    setProfile({ ...profile, firstName: v })
                                }
                            />
                            <Field
                                label="Last name"
                                value={profile.lastName}
                                onChange={(v) =>
                                    setProfile({ ...profile, lastName: v })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Email"
                                value={profile.email}
                                onChange={() => { }}
                                icon={<Mail className="h-3.5 w-3.5" />}
                                type="email"
                                readOnly
                                hint="Contact support to change your email address."
                            />
                            <Field
                                label="Phone"
                                value={profile.phone}
                                onChange={(v) =>
                                    setProfile({ ...profile, phone: v })
                                }
                                icon={<Phone className="h-3.5 w-3.5" />}
                                placeholder="+254 7XX XXX XXX"
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
                        <h2 className="text-sm font-semibold text-slate-900">
                            Password
                        </h2>
                    </header>
                    <div className="p-5 space-y-4">
                        <Field
                            label="Current password"
                            type="password"
                            value={passwords.current}
                            onChange={(v) => {
                                setPasswords({ ...passwords, current: v });
                                if (passwordErrors.current)
                                    setPasswordErrors((p) => {
                                        const n = { ...p };
                                        delete n.current;
                                        return n;
                                    });
                            }}
                            error={passwordErrors.current}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="New password"
                                type="password"
                                value={passwords.next}
                                onChange={(v) => {
                                    setPasswords({ ...passwords, next: v });
                                    if (passwordErrors.next)
                                        setPasswordErrors((p) => {
                                            const n = { ...p };
                                            delete n.next;
                                            return n;
                                        });
                                }}
                                error={passwordErrors.next}
                                hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                            />
                            <Field
                                label="Confirm new password"
                                type="password"
                                value={passwords.confirm}
                                onChange={(v) => {
                                    setPasswords({ ...passwords, confirm: v });
                                    if (passwordErrors.confirm)
                                        setPasswordErrors((p) => {
                                            const n = { ...p };
                                            delete n.confirm;
                                            return n;
                                        });
                                }}
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
                            <h2 className="text-sm font-semibold text-slate-900">
                                Addresses
                            </h2>
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
                                <li
                                    key={addr.id}
                                    className="p-5 flex items-start justify-between gap-3"
                                >
                                    <div className="text-xs text-slate-700 leading-relaxed">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-semibold text-slate-900">
                                                {addr.label}
                                            </span>
                                            {addr.is_default && (
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-950 border border-blue-100">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p>
                                            {addr.full_name} • {addr.phone}
                                        </p>
                                        <p>{addr.street}</p>
                                        <p>
                                            {addr.town}, {addr.county}
                                            {addr.postal_code
                                                ? ` • ${addr.postal_code}`
                                                : ''}
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
                                {
                                    key: 'whatsappUpdates',
                                    label: 'Order updates via WhatsApp',
                                    desc: 'Get delivery and payment alerts on WhatsApp',
                                },
                                {
                                    key: 'emailPromotions',
                                    label: 'Promotions via email',
                                    desc: 'Deals, new arrivals, and special offers',
                                },
                                {
                                    key: 'smsPromotions',
                                    label: 'Promotions via SMS',
                                    desc: 'Occasional SMS-only discounts',
                                },
                                {
                                    key: 'newsletter',
                                    label: 'Newsletter',
                                    desc: 'Weekly roundup of tech news and picks',
                                },
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
                        <h2 className="text-sm font-semibold text-red-700">
                            Danger Zone
                        </h2>
                    </header>
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-slate-900">
                                Delete account
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Permanently delete your account and all associated
                                data. This cannot be undone.
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

            {/* Toast */}
            {savedMsg && (
                <div className="fixed bottom-6 right-6 z-[80] bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {savedMsg}
                </div>
            )}

            {/* Address modal */}
            {addressModal && (
                <Modal
                    onClose={closeAddressModal}
                    title={addressModal.mode === 'add' ? 'Add Address' : 'Edit Address'}
                >
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
                                value={addressModal.draft.full_name}
                                onChange={(v) => updateDraft('full_name', v)}
                                placeholder="Recipient name"
                                error={addressDraftErrors.full_name}
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
                                            onChange={(e) =>
                                                updateDraft('county', e.target.value)
                                            }
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
                                value={addressModal.draft.postal_code ?? ''}
                                onChange={(v) => updateDraft('postal_code', v)}
                                placeholder="Optional"
                            />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={!!addressModal.draft.is_default}
                                onChange={(e) =>
                                    updateDraft('is_default', e.target.checked)
                                }
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

            {/* Delete address confirm */}
            {deleteAddressTarget && (
                <Modal
                    onClose={() => setDeleteAddressTarget(null)}
                    maxWidth="max-w-md"
                >
                    <div className="text-center space-y-3">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto border border-red-100">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                                Delete &ldquo;{deleteAddressTarget.label}&rdquo;?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                This address will be removed from your account.
                                This action cannot be undone.
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

            {/* Delete account confirm */}
            {deleteAccountOpen && (
                <Modal
                    onClose={() => {
                        if (deleteAccountBusy) return;
                        setDeleteAccountOpen(false);
                        setDeleteAccountConfirm('');
                    }}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto border border-red-100">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Delete your account?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                This permanently removes your profile, addresses,
                                preferences, and order history. This cannot be
                                undone.
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
                                    onChange={(e) =>
                                        setDeleteAccountConfirm(e.target.value)
                                    }
                                    disabled={deleteAccountBusy}
                                    placeholder="DELETE"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm py-2 px-3 text-xs text-slate-900 font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-400 disabled:opacity-60"
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
                                disabled={deleteAccountBusy}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteAccount}
                                disabled={
                                    deleteAccountConfirm !== 'DELETE' ||
                                    deleteAccountBusy
                                }
                                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {deleteAccountBusy ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Deleting…
                                    </>
                                ) : (
                                    'Permanently Delete'
                                )}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className={`bg-white border border-slate-200 rounded-sm shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                        <h2 className="text-sm font-semibold text-slate-900">
                            {title}
                        </h2>
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
                className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-950/30 focus:ring-offset-1 ${value ? 'bg-blue-950' : 'bg-slate-300 hover:bg-slate-400/70'
                    }`}
            >
                <span
                    className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out ${value ? 'translate-x-[20px]' : 'translate-x-[2px]'
                        }`}
                />
            </button>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    type = 'text',
    icon,
    placeholder,
    error,
    readOnly,
    hint,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    icon?: React.ReactNode;
    placeholder?: string;
    error?: string;
    readOnly?: boolean;
    hint?: string;
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
                    readOnly={readOnly}
                    className={`w-full bg-slate-50 border rounded-sm py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 ${icon ? 'pl-9 pr-3' : 'px-3'
                        } ${error
                            ? 'border-red-400 focus:ring-red-600'
                            : 'border-slate-200 focus:ring-blue-950'
                        } ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                />
            </div>
            {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
            {hint && !error && (
                <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
            )}
        </label>
    );
}