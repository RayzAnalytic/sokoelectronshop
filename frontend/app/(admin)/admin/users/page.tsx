'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users as UsersIcon,
  Shield,
  UserPlus,
  Trash2,
  CheckCircle2,
  X,
  Key,
  ShieldAlert,
  Crown,
  Briefcase,
  Headphones,
  Megaphone,
  Package,
  ShoppingCart,
  UserCircle,
  Search,
  Check,
  Minus,
  Loader2,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminStaffUser,
  AdminStaffUserRole,
  AdminStaffUserStatus,
  AdminStaffRole,
  AdminPermissionRow,
  AdminPermissionRole,
  AdminStaffFilters,
  AdminStaffUserInviteWrite,
  AdminStaffUserWrite,
} from '@/lib/admin-types';

// ─────────────────────────────────────────────────────────────────────────────
// Frontend-only unions
// ─────────────────────────────────────────────────────────────────────────────
type UsersTab = 'users' | 'roles' | 'permissions';
type UserStatus = AdminStaffUserStatus;

// The matrix has a Customer column in addition to the six staff roles.
// The canonical type already encodes this — no need to redefine it.
type StaffRole = AdminPermissionRole;

// Local alias — keeps the JSX below readable without duplicating the
// backend shape. If the backend adds a field, it flows through here.
type PermissionRow = AdminPermissionRow;

const STAFF_ROLES: AdminStaffUserRole[] = [
  'Administrator',
  'Manager',
  'Sales Staff',
  'Inventory Staff',
  'Marketing Staff',
  'Support Staff',
];

const ALL_ROLES_INCLUDING_CUSTOMER: StaffRole[] = [...STAFF_ROLES, 'Customer'];

// ─────────────────────────────────────────────────────────────────────────────
// Icon name → lucide component (backend stores icon as a string)
// ─────────────────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown,
  Briefcase,
  ShoppingCart,
  Package,
  Megaphone,
  Headphones,
  UserCircle,
  Shield,
};

const resolveIcon = (name: string) => ICON_MAP[name] ?? Shield;

// ─────────────────────────────────────────────────────────────────────────────
// UI-only shapes derived from backend data
// ─────────────────────────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  name: string;
  email: string;
  role: AdminStaffUserRole;
  status: UserStatus;
  lastLogin: string;
  department: string;
  /** Full backend record — kept for PATCH calls. */
  raw: AdminStaffUser;
}

interface RoleCard {
  id: string;
  name: StaffRole;
  description: string;
  userCount: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  scope: string;
  isCustomer: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function humaniseLastLogin(iso: string | null): string {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Never';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * "Owner"                  → "OW"
 * "Alex Doe"               → "AD"
 * "Mary Jane Watson"       → "MW"
 * "owner@myelectronics…"   → "OW"   (used when name is empty)
 */
function initialsOf(name: string, fallback = ''): string {
  const source = (name || fallback).trim();
  if (!source) return '??';

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toUserRow(u: AdminStaffUser): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    lastLogin: humaniseLastLogin(u.last_login_at),
    department: u.department,
    raw: u,
  };
}

function toRoleCard(r: AdminStaffRole, userCount: number): RoleCard {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    userCount,
    color: r.color,
    icon: resolveIcon(r.icon),
    scope: r.scope,
    isCustomer: r.is_customer,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════
export default function UsersAndRolesPage() {
  const [activeTab, setActiveTab] = useState<UsersTab>('users');

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleCard[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminStaffUserRole | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminStaffUserRole>('Sales Staff');
  const [inviteDepartment, setInviteDepartment] = useState('Sales');
  const [inviteMessage, setInviteMessage] = useState(
    'Hey! Join our merchant dashboard to manage store operations and M-Pesa payments.',
  );

  const [saving, setSaving] = useState(false);

  const anyModalOpen = inviteOpen || editOpen || deleteOpen;

  // ── Toast auto-dismiss ──────────────────────────────────────────────────
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // ── Escape key + scroll lock ────────────────────────────────────────────
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
    // closeAll is stable enough for this — it only calls setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyModalOpen]);

  const closeAll = () => {
    setInviteOpen(false);
    setEditOpen(false);
    setDeleteOpen(false);
  };

  const toast = (msg: string) => setToastMessage(msg);

  // ── Data loading ────────────────────────────────────────────────────────

  /**
   * Initial load — runs exactly once on mount.
   *
   * Fetches users, roles, and the permission matrix in parallel. The
   * result populates every tab, so switching tabs after this point
   * doesn't trigger more requests.
   *
   * Any filter refresh after this point goes through `loadFilteredUsers`
   * below, which only touches the user list.
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const [u, r, p] = await Promise.all([
          adminApi.users.list({}).then((raw) => raw.map(toUserRow)),
          adminApi.users.roles.list().then((raw) => raw.map((rc) => toRoleCard(rc, 0))),
          adminApi.users.permissions.get(),
        ]);

        if (cancelled) return;

        setUsers(u);

        // Seed the role cards with live user counts from the user list.
        const counts: Record<string, number> = {};
        for (const user of u) {
          counts[user.role] = (counts[user.role] ?? 0) + 1;
        }
        setRoles(r.map((rc) => ({ ...rc, userCount: counts[rc.name] ?? 0 })));

        // The permissions endpoint already returns the nested
        // `{module, group, roles}` shape — no re-shaping needed.
        setPermissions(p);

        setInitialLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // run once — filters are handled by the effect below

  /**
   * Filter refresh — debounced on roleFilter / searchQuery changes.
   *
   * Skipped until the initial load completes so typing during the first
   * fetch doesn't race with the mount-time request.
   *
   * 250 ms debounce so a six-letter search fires one request, not six.
   */
  useEffect(() => {
    if (!initialLoaded) return;

    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const filters: AdminStaffFilters = {};
        if (roleFilter) filters.role = roleFilter;
        if (searchQuery.trim()) filters.q = searchQuery.trim();

        const raw = await adminApi.users.list(filters, ac.signal);
        if (ac.signal.aborted) return;
        setUsers(raw.map(toUserRow));
      } catch {
        /* non-fatal — the previous list stays visible */
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [roleFilter, searchQuery, initialLoaded]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const groupedPermissions = useMemo(
    () =>
      permissions.reduce<Record<string, PermissionRow[]>>((acc, row) => {
        if (!acc[row.group]) acc[row.group] = [];
        acc[row.group].push(row);
        return acc;
      }, {}),
    [permissions],
  );

  const totalUsersInFilter = useMemo(() => users.length, [users]);

  // ── Handlers ────────────────────────────────────────────────────────────

  /**
   * Refresh the user list from the current filters. Called after an
   * invite is sent so the invited row shows up with its real UUID.
   */
  const refreshUsers = useCallback(async () => {
    const filters: AdminStaffFilters = {};
    if (roleFilter) filters.role = roleFilter;
    if (searchQuery.trim()) filters.q = searchQuery.trim();
    const raw = await adminApi.users.list(filters);
    return raw.map(toUserRow);
  }, [roleFilter, searchQuery]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: AdminStaffUserInviteWrite = {
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        department: inviteDepartment,
        message: inviteMessage,
      };

      await adminApi.users.invites.create(payload);

      // Close + reset the modal immediately so the admin sees feedback.
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      toast(`Invitation sent to ${inviteEmail}`);

      // Refetch the real list. The backend is the source of truth —
      // this replaces any optimistic state with real UUIDs so that
      // Edit / Suspend / Delete all work on valid row IDs.
      const refreshed = await refreshUsers();
      setUsers(refreshed);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: UserRow) => {
    setSelectedUser(user);
    setEditOpen(true);
  };

  const saveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload: AdminStaffUserWrite = {
        name: selectedUser.name,
        role: selectedUser.role,
        status: selectedUser.status,
        department: selectedUser.department,
      };
      const updated = await adminApi.users.update(selectedUser.id, payload);
      const updatedRow = toUserRow(updated);
      setUsers((prev) =>
        prev.map((u) => (u.id === updatedRow.id ? updatedRow : u)),
      );
      setEditOpen(false);
      toast(`Updated ${updatedRow.name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async (user: UserRow) => {
    try {
      const { status } = await adminApi.users.toggleSuspend(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status } : u)),
      );
      toast(`${user.name} marked ${status.toLowerCase()}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setSaving(true);
    try {
      await adminApi.users.remove(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setDeleteOpen(false);
      setUserToDelete(null);
      toast('User removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (moduleIdx: number, role: StaffRole) => {
    if (role === 'Administrator') {
      toast('Administrator permissions cannot be modified');
      return;
    }
    setPermissions((prev) =>
      prev.map((row, i) =>
        i === moduleIdx
          ? { ...row, roles: { ...row.roles, [role]: !row.roles[role] } }
          : row,
      ),
    );
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      // The backend serializer skips the Administrator column on save —
      // it stays locked regardless of what the client sends. Sending the
      // full matrix keeps the payload shape simple.
      await adminApi.users.permissions.save({ permissions });
      toast('Permission matrix saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save matrix');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!selectedUser) return;
    try {
      await adminApi.users.resetPassword(selectedUser.id);
      toast(`Password reset link sent to ${selectedUser.email}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send reset link');
    }
  };

  // ── Badges ──────────────────────────────────────────────────────────────
  const statusBadge = (s: UserStatus) =>
    s === 'Active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Invited'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : 'bg-red-50 text-red-600 border-red-100';

  const roleBadgeColor = (role: AdminStaffUserRole) => {
    const r = roles.find((x) => x.name === role);
    return r?.color ?? 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Users & Roles</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Staff accounts and store-operation permissions — separate from customers
            </p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite staff</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-[1600px] mx-auto px-3 flex items-center gap-0.5 border-t border-slate-100 pt-2 overflow-x-auto">
          {[
            { id: 'users' as const, label: 'Staff users', icon: UsersIcon, count: users.length },
            { id: 'roles' as const, label: 'Roles', icon: Shield, count: roles.length },
            { id: 'permissions' as const, label: 'Permission matrix', icon: Key, count: permissions.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
                    ? 'border-blue-950 text-blue-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                {tab.label}
                <span
                  className={`px-1.5 py-0.5 rounded-sm text-[13px] ${isActive ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {/* Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
          <UserCircle className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <p className="font-medium text-blue-950">System users vs Customers</p>
            <p className="text-blue-800 mt-0.5">
              System users are <span className="font-medium">staff members</span> who operate the dashboard.
              Buyers are managed separately in the <span className="font-medium">Customers</span> section of the CRM.
              Customer accounts are read-only and cannot access staff tools.
            </p>
          </div>
        </div>

        {/* Load error */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-2 text-[13px] text-red-700">
            {loadError}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-sm p-8 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}

        {/* ── Users Tab ────────────────────────────────────────────────── */}
        {!loading && activeTab === 'users' && (
          <>
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff by name, email, department…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setRoleFilter(null)}
                  className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition ${roleFilter === null
                      ? 'bg-blue-950 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  All roles
                </button>
                {STAFF_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${roleFilter === r
                        ? 'bg-blue-950 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">Staff accounts</p>
                <p className="text-[13px] text-slate-500">
                  {totalUsersInFilter} staff
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">User</th>
                      <th className="py-2 px-3 font-medium">Department</th>
                      <th className="py-2 px-3 font-medium">Role</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Last login</th>
                      <th className="py-2 px-3 w-56"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-[13px]">
                          No staff users match your filters.
                        </td>
                      </tr>
                    ) : (
                      users.map((usr) => (
                        <tr key={usr.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-950 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
                                {initialsOf(usr.name, usr.email)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate">{usr.name}</p>
                                <p className="text-[13px] text-slate-400 truncate">{usr.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{usr.department}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${roleBadgeColor(
                                usr.role,
                              )}`}
                            >
                              {usr.role}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                                usr.status,
                              )}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${usr.status === 'Active'
                                    ? 'bg-emerald-500'
                                    : usr.status === 'Invited'
                                      ? 'bg-blue-500'
                                      : 'bg-red-500'
                                  }`}
                              />
                              {usr.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500">{usr.lastLogin}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(usr)}
                                className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleSuspend(usr)}
                                className={`px-2.5 py-2 rounded-sm font-medium text-[13px] border transition ${usr.status === 'Suspended'
                                    ? 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                    : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
                                  }`}
                              >
                                {usr.status === 'Suspended' ? 'Activate' : 'Suspend'}
                              </button>
                              <button
                                onClick={() => {
                                  setUserToDelete(usr);
                                  setDeleteOpen(true);
                                }}
                                className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

        {/* ── Roles Tab ────────────────────────────────────────────────── */}
        {!loading && activeTab === 'roles' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2">
              <p className="text-[13px] font-semibold text-slate-900">Role catalogue</p>
              <p className="text-[13px] text-slate-500">
                {STAFF_ROLES.length} staff roles + 1 customer account type
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <div
                    key={role.id}
                    className={`bg-white border rounded-sm p-2 space-y-2 flex flex-col justify-between ${role.isCustomer ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'
                      }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-9 h-9 rounded-sm flex items-center justify-center border shrink-0 ${role.color}`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-900 truncate">
                              {role.name}
                            </p>
                            <p className="text-[13px] text-slate-500 truncate">{role.scope}</p>
                          </div>
                        </div>
                        <span className="text-[13px] text-slate-500 shrink-0">
                          {role.userCount} users
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-600 mt-2 leading-relaxed">
                        {role.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[13px] text-slate-400 font-mono">
                        {role.isCustomer ? 'Read-only · external' : 'Internal staff'}
                      </span>
                      <button
                        onClick={() => setActiveTab('permissions')}
                        className="px-3 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px] transition"
                      >
                        View permissions
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Permissions Tab ──────────────────────────────────────────── */}
        {!loading && activeTab === 'permissions' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Permission matrix</p>
                <p className="text-[13px] text-slate-500">
                  Toggle access per module for each role. Administrator access is locked.
                </p>
              </div>
              <button
                onClick={savePermissions}
                disabled={saving}
                className="bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save matrix
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium sticky left-0 bg-slate-50 z-10 min-w-[220px]">
                        Module
                      </th>
                      {ALL_ROLES_INCLUDING_CUSTOMER.map((r) => (
                        <th
                          key={r}
                          className="py-2 px-2 font-medium text-center whitespace-nowrap"
                        >
                          <span className="inline-flex items-center gap-1">
                            {r === 'Administrator' && <Crown className="w-3 h-3 text-red-600" />}
                            {r === 'Customer' && <UserCircle className="w-3 h-3 text-slate-500" />}
                            {r}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(groupedPermissions).map(([group, rows]) => (
                      <React.Fragment key={group}>
                        <tr className="bg-slate-100/70">
                          <td
                            colSpan={ALL_ROLES_INCLUDING_CUSTOMER.length + 1}
                            className="py-1.5 px-3 text-[13px] font-semibold text-slate-600 uppercase tracking-wider"
                          >
                            {group}
                          </td>
                        </tr>
                        {rows.map((row) => {
                          const moduleIdx = permissions.findIndex(
                            (p) => p.module === row.module,
                          );
                          return (
                            <tr key={row.module} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-medium text-slate-800 sticky left-0 bg-white z-10">
                                {row.module}
                              </td>
                              {ALL_ROLES_INCLUDING_CUSTOMER.map((role) => {
                                const enabled = row.roles[role];
                                const isAdmin = role === 'Administrator';
                                return (
                                  <td key={role} className="py-2 px-2 text-center">
                                    <button
                                      onClick={() => togglePermission(moduleIdx, role)}
                                      disabled={isAdmin}
                                      className={`w-7 h-7 rounded-sm inline-flex items-center justify-center border transition ${enabled
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                        } ${isAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                                      title={
                                        isAdmin
                                          ? 'Administrator always has full access'
                                          : enabled
                                            ? 'Revoke access'
                                            : 'Grant access'
                                      }
                                    >
                                      {enabled ? (
                                        <Check className="w-3.5 h-3.5" />
                                      ) : (
                                        <Minus className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-4 flex-wrap text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
                <span className="text-slate-600">Granted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-sm bg-slate-50 text-slate-400 border border-slate-200 inline-flex items-center justify-center">
                  <Minus className="w-3 h-3" />
                </span>
                <span className="text-slate-600">Denied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center justify-center opacity-90">
                  <Check className="w-3 h-3" />
                </span>
                <span className="text-slate-600">Administrator (locked)</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Invite Modal ──────────────────────────────────────────────── */}
      {inviteOpen && (
        <Modal
          onClose={closeAll}
          title="Invite staff member"
          subtitle="Send an email invitation to access the dashboard"
        >
          <form onSubmit={sendInvite} className="space-y-3 text-[13px]">
            <Field
              label="Full name"
              value={inviteName}
              onChange={setInviteName}
              placeholder="e.g. David Kamau"
              required
            />
            <Field
              label="Work email"
              type="email"
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="david@sokoflow.co.ke"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Assigned role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AdminStaffUserRole)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Department"
                value={inviteDepartment}
                onChange={setInviteDepartment}
                placeholder="e.g. Sales"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Personal message</label>
              <textarea
                rows={3}
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-sm p-2">
              <p className="text-blue-800 text-[13px]">
                Staff will be able to access only the modules granted to their role
                in the permission matrix.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeAll}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send invitation
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {editOpen && selectedUser && (
        <Modal
          onClose={closeAll}
          title="Edit staff account"
          subtitle="Modify role, department, or status"
        >
          <form onSubmit={saveUserEdit} className="space-y-3 text-[13px]">
            <Field
              label="Full name"
              value={selectedUser.name}
              onChange={(v) => setSelectedUser({ ...selectedUser, name: v })}
              required
            />
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email address</label>
              <input
                type="email"
                disabled
                value={selectedUser.email}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-500 cursor-not-allowed"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Assigned role</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) =>
                    setSelectedUser({
                      ...selectedUser,
                      role: e.target.value as AdminStaffUserRole,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Department"
                value={selectedUser.department}
                onChange={(v) => setSelectedUser({ ...selectedUser, department: v })}
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Account status</label>
              <select
                value={selectedUser.status}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    status: e.target.value as UserStatus,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                <option value="Active">Active</option>
                <option value="Invited">Invited</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <button
              type="button"
              onClick={resetPassword}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
            >
              <Key className="w-3.5 h-3.5 text-blue-950" />
              Reset password & send link
            </button>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeAll}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────── */}
      {deleteOpen && userToDelete && (
        <Modal onClose={closeAll} maxWidth="max-w-md">
          <div className="text-center space-y-3 text-[13px]">
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Remove staff account?
              </h3>
              <p className="text-slate-500 mt-1">
                Remove{' '}
                <span className="font-medium text-slate-800">{userToDelete.name}</span>?
                Active orders and logs will be reassigned to the primary administrator.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={closeAll}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-medium py-2 rounded-sm text-[13px] inline-flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */
/* Reusable Modal                                                            */
/* ───────────────────────────────────────────────────────────────────────── */
function Modal({
  children,
  onClose,
  title,
  subtitle,
  maxWidth = 'max-w-md',
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className={`bg-white border border-slate-200 rounded-sm w-full ${maxWidth} max-h-[90vh] flex flex-col shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */
/* Reusable Field                                                            */
/* ───────────────────────────────────────────────────────────────────────── */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
      />
    </label>
  );
}