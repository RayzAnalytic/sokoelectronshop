'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

// --- TYPES ---
// NOTE: System users are STAFF who operate the dashboard.
// Customers (buyers) are managed separately in the Customers section.
// Integrations, billing, and platform config are handled by the developer
// outside this UI.

type UsersTab = 'users' | 'roles' | 'permissions';
type UserStatus = 'Active' | 'Invited' | 'Suspended';

type StaffRole =
  | 'Administrator'
  | 'Manager'
  | 'Sales Staff'
  | 'Inventory Staff'
  | 'Marketing Staff'
  | 'Support Staff'
  | 'Customer';

interface User {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: UserStatus;
  lastLogin: string;
  avatar: string;
  department: string;
}

interface RoleCard {
  id: string;
  name: StaffRole;
  description: string;
  userCount: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  scope: string;
}

interface PermissionRow {
  module: string;
  group: string;
  roles: Record<StaffRole, boolean>;
}

// --- STAFF ROLES (NOT CUSTOMERS) ---
const STAFF_ROLES: StaffRole[] = [
  'Administrator',
  'Manager',
  'Sales Staff',
  'Inventory Staff',
  'Marketing Staff',
  'Support Staff',
];

const ALL_ROLES_INCLUDING_CUSTOMER: StaffRole[] = [...STAFF_ROLES, 'Customer'];

const INITIAL_USERS: User[] = [
  { id: 'usr-1', name: 'Isaac Mutinda', email: 'isaac@sokoflow.co.ke', role: 'Administrator', status: 'Active', lastLogin: '2 mins ago', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', department: 'Executive' },
  { id: 'usr-2', name: 'Brian Kipkorir', email: 'brian@sokoflow.co.ke', role: 'Manager', status: 'Active', lastLogin: '1 hour ago', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80', department: 'Operations' },
  { id: 'usr-3', name: 'Brenda Akinyi', email: 'brenda@sokoflow.co.ke', role: 'Sales Staff', status: 'Active', lastLogin: '3 hours ago', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80', department: 'Sales' },
  { id: 'usr-4', name: 'Kevin Odhiambo', email: 'kevin@sokoflow.co.ke', role: 'Marketing Staff', status: 'Invited', lastLogin: 'Never', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80', department: 'Marketing' },
  { id: 'usr-5', name: 'Mercy Wanjiku', email: 'mercy@sokoflow.co.ke', role: 'Inventory Staff', status: 'Suspended', lastLogin: '2 weeks ago', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=80', department: 'Warehouse' },
  { id: 'usr-6', name: 'Grace Njeri', email: 'grace@sokoflow.co.ke', role: 'Support Staff', status: 'Active', lastLogin: '5 mins ago', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=120&q=80', department: 'Customer Care' },
  { id: 'usr-7', name: 'David Kamau', email: 'david@sokoflow.co.ke', role: 'Sales Staff', status: 'Active', lastLogin: '20 mins ago', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&q=80', department: 'Sales' },
];

const INITIAL_ROLES: RoleCard[] = [
  {
    id: 'rol-1',
    name: 'Administrator',
    description: 'Full access to storefront operations, staff, orders, products, and reports. Platform infrastructure is managed by the developer.',
    userCount: 1,
    color: 'bg-red-50 text-red-700 border-red-100',
    icon: Crown,
    scope: 'Full store control',
  },
  {
    id: 'rol-2',
    name: 'Manager',
    description: 'Oversee products, orders, staff, reports, and daily storefront operations.',
    userCount: 1,
    color: 'bg-blue-50 text-blue-950 border-blue-100',
    icon: Briefcase,
    scope: 'Operations & reporting',
  },
  {
    id: 'rol-3',
    name: 'Sales Staff',
    description: 'Process orders, manage customers, and handle point-of-sale interactions.',
    userCount: 2,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: ShoppingCart,
    scope: 'Orders & customers',
  },
  {
    id: 'rol-4',
    name: 'Inventory Staff',
    description: 'Manage stock levels, product catalog, suppliers, and warehouse movements.',
    userCount: 1,
    color: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: Package,
    scope: 'Stock & catalog',
  },
  {
    id: 'rol-5',
    name: 'Marketing Staff',
    description: 'Run campaigns, manage social presence, promos, and content assets.',
    userCount: 1,
    color: 'bg-purple-50 text-purple-700 border-purple-100',
    icon: Megaphone,
    scope: 'Campaigns & content',
  },
  {
    id: 'rol-6',
    name: 'Support Staff',
    description: 'Handle customer queries, tickets, WhatsApp chats, and issue resolution.',
    userCount: 1,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    icon: Headphones,
    scope: 'Tickets & chats',
  },
  {
    id: 'rol-7',
    name: 'Customer',
    description: 'Buyer account with access only to their own orders, wishlist, and profile.',
    userCount: 0,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: UserCircle,
    scope: 'Self-service only',
  },
];

// --- PERMISSION MATRIX: store-operation modules only ---
// Removed: Settings & Integrations, Billing & Subscription
// Those are handled by the developer outside this UI.
const INITIAL_PERMISSIONS: PermissionRow[] = [
  { module: 'Products & Catalog', group: 'Catalog', roles: { Administrator: true, Manager: true, 'Sales Staff': true, 'Inventory Staff': true, 'Marketing Staff': true, 'Support Staff': false, Customer: false } },
  { module: 'Inventory & Stock', group: 'Catalog', roles: { Administrator: true, Manager: true, 'Sales Staff': false, 'Inventory Staff': true, 'Marketing Staff': false, 'Support Staff': false, Customer: false } },
  { module: 'Orders', group: 'Sales', roles: { Administrator: true, Manager: true, 'Sales Staff': true, 'Inventory Staff': true, 'Marketing Staff': false, 'Support Staff': true, Customer: false } },
  { module: 'Payments & M-Pesa', group: 'Sales', roles: { Administrator: true, Manager: true, 'Sales Staff': true, 'Inventory Staff': false, 'Marketing Staff': false, 'Support Staff': false, Customer: false } },
  { module: 'Customers & CRM', group: 'Sales', roles: { Administrator: true, Manager: true, 'Sales Staff': true, 'Inventory Staff': false, 'Marketing Staff': false, 'Support Staff': true, Customer: false } },
  { module: 'Shipping & Fulfillment', group: 'Sales', roles: { Administrator: true, Manager: true, 'Sales Staff': true, 'Inventory Staff': true, 'Marketing Staff': false, 'Support Staff': true, Customer: false } },
  { module: 'Campaigns & Promos', group: 'Marketing', roles: { Administrator: true, Manager: true, 'Sales Staff': false, 'Inventory Staff': false, 'Marketing Staff': true, 'Support Staff': false, Customer: false } },
  { module: 'Social & Content', group: 'Marketing', roles: { Administrator: true, Manager: true, 'Sales Staff': false, 'Inventory Staff': false, 'Marketing Staff': true, 'Support Staff': false, Customer: false } },
  { module: 'Support Tickets', group: 'Support', roles: { Administrator: true, Manager: true, 'Sales Staff': false, 'Inventory Staff': false, 'Marketing Staff': false, 'Support Staff': true, Customer: false } },
  { module: 'Analytics & Reports', group: 'Insights', roles: { Administrator: true, Manager: true, 'Sales Staff': true, 'Inventory Staff': true, 'Marketing Staff': true, 'Support Staff': false, Customer: false } },
  { module: 'Users & Roles', group: 'Admin', roles: { Administrator: true, Manager: false, 'Sales Staff': false, 'Inventory Staff': false, 'Marketing Staff': false, 'Support Staff': false, Customer: false } },
  { module: 'My Orders', group: 'Customer', roles: { Administrator: false, Manager: false, 'Sales Staff': false, 'Inventory Staff': false, 'Marketing Staff': false, 'Support Staff': false, Customer: true } },
  { module: 'My Profile & Wishlist', group: 'Customer', roles: { Administrator: false, Manager: false, 'Sales Staff': false, 'Inventory Staff': false, 'Marketing Staff': false, 'Support Staff': false, Customer: true } },
];

export default function UsersAndRolesPage() {
  const [activeTab, setActiveTab] = useState<UsersTab>('users');
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [roles] = useState<RoleCard[]>(INITIAL_ROLES);
  const [permissions, setPermissions] = useState<PermissionRow[]>(INITIAL_PERMISSIONS);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>('Sales Staff');
  const [inviteDepartment, setInviteDepartment] = useState('Sales');
  const [inviteMessage, setInviteMessage] = useState(
    'Hey! Join our merchant dashboard to manage store operations and M-Pesa payments.'
  );

  const anyModalOpen = inviteOpen || editOpen || deleteOpen;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

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
  }, [anyModalOpen]);

  const closeAll = () => {
    setInviteOpen(false);
    setEditOpen(false);
    setDeleteOpen(false);
  };

  const toast = (msg: string) => setToastMessage(msg);

  const filteredUsers = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: inviteName || 'New Team Member',
      email: inviteEmail,
      role: inviteRole,
      status: 'Invited',
      lastLogin: 'Never',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
      department: inviteDepartment,
    };
    setUsers([newUser, ...users]);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteName('');
    toast(`Invitation sent to ${inviteEmail}`);
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setEditOpen(true);
  };

  const saveUserEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setUsers(users.map((u) => (u.id === selectedUser.id ? selectedUser : u)));
    setEditOpen(false);
    toast(`Updated ${selectedUser.name}`);
  };

  const toggleSuspend = (user: User) => {
    const next: UserStatus = user.status === 'Suspended' ? 'Active' : 'Suspended';
    setUsers(users.map((u) => (u.id === user.id ? { ...u, status: next } : u)));
    toast(`${user.name} marked ${next.toLowerCase()}`);
  };

  const confirmDelete = () => {
    if (!userToDelete) return;
    setUsers(users.filter((u) => u.id !== userToDelete.id));
    setDeleteOpen(false);
    setUserToDelete(null);
    toast('User removed');
  };

  const togglePermission = (moduleIdx: number, role: StaffRole) => {
    // Administrator permission is immutable (always full access)
    if (role === 'Administrator') {
      toast('Administrator permissions cannot be modified');
      return;
    }
    setPermissions((prev) =>
      prev.map((row, i) =>
        i === moduleIdx
          ? { ...row, roles: { ...row.roles, [role]: !row.roles[role] } }
          : row
      )
    );
  };

  const savePermissions = () => {
    toast('Permission matrix saved');
  };

  const statusBadge = (s: UserStatus) =>
    s === 'Active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Invited'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : 'bg-red-50 text-red-600 border-red-100';

  const roleBadgeColor = (role: StaffRole) => {
    const r = roles.find((x) => x.name === role);
    return r?.color ?? 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const groupedPermissions = permissions.reduce<Record<string, PermissionRow[]>>((acc, row) => {
    if (!acc[row.group]) acc[row.group] = [];
    acc[row.group].push(row);
    return acc;
  }, {});

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

        {/* TABS */}
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

        {/* CUSTOMERS SEPARATION BANNER */}
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

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <>
            {/* FILTER BAR */}
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
                  {filteredUsers.length} of {users.length}
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
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-[13px]">
                          No staff users match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((usr) => (
                        <tr key={usr.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <img
                                src={usr.avatar}
                                alt={usr.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
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
                                usr.role
                              )}`}
                            >
                              {usr.role}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                                usr.status
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

        {/* ROLES TAB */}
        {activeTab === 'roles' && (
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
                const isCustomer = role.name === 'Customer';
                return (
                  <div
                    key={role.id}
                    className={`bg-white border rounded-sm p-2 space-y-2 flex flex-col justify-between ${isCustomer ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'
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
                        {isCustomer ? 'Read-only · external' : 'Internal staff'}
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

        {/* PERMISSIONS TAB */}
        {activeTab === 'permissions' && (
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
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
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
                        <th key={r} className="py-2 px-2 font-medium text-center whitespace-nowrap">
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
                          const moduleIdx = permissions.findIndex((p) => p.module === row.module);
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

            {/* Legend */}
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

      {/* INVITE MODAL */}
      {inviteOpen && (
        <Modal onClose={closeAll} title="Invite staff member" subtitle="Send an email invitation to access the dashboard">
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
                  onChange={(e) => setInviteRole(e.target.value as StaffRole)}
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
                Staff will be able to access only the modules granted to their role in the permission matrix.
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
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Send invitation
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT USER MODAL */}
      {editOpen && selectedUser && (
        <Modal onClose={closeAll} title="Edit staff account" subtitle="Modify role, department, or status">
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
                    setSelectedUser({ ...selectedUser, role: e.target.value as StaffRole })
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
                  setSelectedUser({ ...selectedUser, status: e.target.value as UserStatus })
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
              onClick={() => toast(`Password reset link sent to ${selectedUser.email}`)}
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
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRM */}
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
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Confirm delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── Reusable Modal ───────────── */
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
              <h3 className="text-[15px] font-semibold text-slate-900 truncate">{title}</h3>
              {subtitle && (
                <p className="text-[13px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
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

/* ───────────── Reusable Field ───────────── */
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