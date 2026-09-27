'use client';

import React, { useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  Shield,
  UserPlus,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  Key,
  ShieldAlert,
} from 'lucide-react';

// --- TYPES ---
type UsersTab = 'users' | 'roles';
type UserStatus = 'Active' | 'Invited' | 'Suspended';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  lastLogin: string;
  avatar: string;
}

interface RoleCard {
  id: string;
  name: string;
  description: string;
  userCount: number;
  color: string;
}

interface PermissionModule {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  del: boolean;
}

const INITIAL_USERS: User[] = [
  { id: 'usr-1', name: 'Isaac Mutinda', email: 'isaac@sokoflow.co.ke', role: 'Administrator', status: 'Active', lastLogin: '2 mins ago', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' },
  { id: 'usr-2', name: 'Brian Kipkorir', email: 'brian@sokoflow.co.ke', role: 'Manager', status: 'Active', lastLogin: '1 hour ago', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80' },
  { id: 'usr-3', name: 'Brenda Akinyi', email: 'brenda@sokoflow.co.ke', role: 'Order Processor', status: 'Active', lastLogin: '3 hours ago', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80' },
  { id: 'usr-4', name: 'Kevin Odhiambo', email: 'kevin@sokoflow.co.ke', role: 'Content Editor', status: 'Invited', lastLogin: 'Never', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80' },
  { id: 'usr-5', name: 'Mercy Wanjiku', email: 'mercy@sokoflow.co.ke', role: 'Order Processor', status: 'Suspended', lastLogin: '2 weeks ago', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=80' },
];

const INITIAL_ROLES: RoleCard[] = [
  { id: 'rol-1', name: 'Administrator', description: 'Full access to all storefront settings, billing, integrations, and user management.', userCount: 1, color: 'bg-red-50 text-red-700 border-red-100' },
  { id: 'rol-2', name: 'Manager', description: 'Manage products, review analytics, process orders, and view reports.', userCount: 2, color: 'bg-blue-50 text-blue-950 border-blue-100' },
  { id: 'rol-3', name: 'Order Processor', description: 'Handle daily orders, M-Pesa fulfillment, and WhatsApp reminder dispatch.', userCount: 4, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'rol-4', name: 'Content Editor', description: 'Update storefront themes, product catalog, landing copy, and media.', userCount: 1, color: 'bg-amber-50 text-amber-700 border-amber-100' },
];

const DEFAULT_PERMISSIONS: PermissionModule[] = [
  { module: 'Products & Inventory', view: true, create: true, edit: true, del: true },
  { module: 'Orders & M-Pesa Fulfillment', view: true, create: true, edit: true, del: false },
  { module: 'Customers & CRM', view: true, create: true, edit: true, del: false },
  { module: 'Analytics & Financial Reports', view: true, create: false, edit: false, del: false },
  { module: 'Appearance & Storefront Theme', view: true, create: true, edit: true, del: true },
  { module: 'API Keys & Webhooks', view: false, create: false, edit: false, del: false },
];

export default function UsersAndRolesPage() {
  const [activeTab, setActiveTab] = useState<UsersTab>('users');
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [roles, setRoles] = useState<RoleCard[]>(INITIAL_ROLES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<RoleCard | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Manager');
  const [inviteMessage, setInviteMessage] = useState(
    'Hey! Join our merchant dashboard to manage store operations and WhatsApp payments.'
  );

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [permissionsMatrix, setPermissionsMatrix] = useState<PermissionModule[]>(DEFAULT_PERMISSIONS);

  const anyModalOpen = inviteOpen || editOpen || permissionsOpen || deleteOpen || addRoleOpen;

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
    setPermissionsOpen(false);
    setDeleteOpen(false);
    setAddRoleOpen(false);
  };

  const toast = (msg: string) => setToastMessage(msg);

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

  const openPermissions = (role: RoleCard) => {
    setSelectedRoleForPerms(role);
    setPermissionsOpen(true);
  };

  const togglePermission = (index: number, field: keyof PermissionModule) => {
    if (field === 'module') return;
    const updated = [...permissionsMatrix];
    updated[index][field] = !updated[index][field] as any;
    setPermissionsMatrix(updated);
  };

  const savePermissions = () => {
    setPermissionsOpen(false);
    toast(`Permissions updated for ${selectedRoleForPerms?.name}`);
  };

  const createRole = (e: React.FormEvent) => {
    e.preventDefault();
    const newRole: RoleCard = {
      id: `rol-${Date.now()}`,
      name: newRoleName,
      description: newRoleDesc || 'Custom team role with specific modular access.',
      userCount: 0,
      color: 'bg-purple-50 text-purple-700 border-purple-100',
    };
    setRoles([...roles, newRole]);
    setAddRoleOpen(false);
    setNewRoleName('');
    setNewRoleDesc('');
    toast(`Role "${newRoleName}" created`);
  };

  const statusBadge = (s: UserStatus) =>
    s === 'Active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Invited'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : 'bg-red-50 text-red-600 border-red-100';

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
            <h1 className="text-[15px] font-semibold text-slate-900">Users & roles</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage team members, roles, and permissions
            </p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite user</span>
          </button>
        </div>

        {/* TABS */}
        <div className="max-w-[1600px] mx-auto px-3 flex items-center gap-0.5 border-t border-slate-100 pt-2">
          {[
            { id: 'users' as const, label: 'Team users', icon: UsersIcon, count: users.length },
            { id: 'roles' as const, label: 'Roles & permissions', icon: Shield, count: roles.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-950 text-blue-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                {tab.label}
                <span
                  className={`px-1.5 py-0.5 rounded-sm text-[13px] ${
                    isActive ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'
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

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-[13px] font-medium text-slate-700">Active staff & collaborators</p>
              <p className="text-[13px] text-slate-500">Total: {users.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">User</th>
                    <th className="py-2 px-3 font-medium">Role</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Last login</th>
                    <th className="py-2 px-3 w-56"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((usr) => (
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
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-sm font-medium">
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
                            className={`w-1.5 h-1.5 rounded-full ${
                              usr.status === 'Active'
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
                            className={`px-2.5 py-2 rounded-sm font-medium text-[13px] border transition ${
                              usr.status === 'Suspended'
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ROLES TAB */}
        {activeTab === 'roles' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Role-based access control</p>
                <p className="text-[13px] text-slate-500">
                  Configure permission boundaries for your team
                </p>
              </div>
              <button
                onClick={() => setAddRoleOpen(true)}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Add role</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[13px] font-medium border ${role.color}`}
                      >
                        {role.name}
                      </span>
                      <span className="text-[13px] text-slate-500">
                        {role.userCount} users
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-600 mt-2 leading-relaxed">
                      {role.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[13px] text-slate-400 font-mono">ID: {role.id}</span>
                    <button
                      onClick={() => openPermissions(role)}
                      className="px-3 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px] transition"
                    >
                      Edit permissions
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* INVITE MODAL */}
      {inviteOpen && (
        <Modal onClose={closeAll} title="Invite team member" subtitle="Send an email invitation to access the dashboard">
          <form onSubmit={sendInvite} className="space-y-3 text-[13px]">
            <Field
              label="Full name"
              value={inviteName}
              onChange={setInviteName}
              placeholder="e.g. David Kamau"
              required
            />
            <Field
              label="Email address"
              type="email"
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="david@example.com"
              required
            />
            <div>
              <label className="block font-medium text-slate-700 mb-1">Assigned role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
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
        <Modal onClose={closeAll} title="Edit user" subtitle="Modify role, status, or credentials">
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
            <div>
              <label className="block font-medium text-slate-700 mb-1">Assigned role</label>
              <select
                value={selectedUser.role}
                onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
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
                Delete user & reassign?
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

      {/* PERMISSIONS MODAL */}
      {permissionsOpen && selectedRoleForPerms && (
        <Modal
          onClose={closeAll}
          title={`Permissions · ${selectedRoleForPerms.name}`}
          subtitle="Configure granular access across modules"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-3">
            <div className="overflow-x-auto border border-slate-200 rounded-sm">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium">Module</th>
                    <th className="py-2 px-3 font-medium text-center">View</th>
                    <th className="py-2 px-3 font-medium text-center">Create</th>
                    <th className="py-2 px-3 font-medium text-center">Edit</th>
                    <th className="py-2 px-3 font-medium text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {permissionsMatrix.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800">{item.module}</td>
                      {(['view', 'create', 'edit', 'del'] as const).map((field) => (
                        <td key={field} className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={item[field]}
                            onChange={() => togglePermission(idx, field)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={closeAll}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Save permissions
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADD ROLE MODAL */}
      {addRoleOpen && (
        <Modal onClose={closeAll} title="Create custom role" subtitle="Define a new role with tailored access">
          <form onSubmit={createRole} className="space-y-3 text-[13px]">
            <Field
              label="Role title"
              value={newRoleName}
              onChange={setNewRoleName}
              placeholder="e.g. Senior Logistics Officer"
              required
            />
            <div>
              <label className="block font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Describe responsibilities and scope…"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
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
                Create role
              </button>
            </div>
          </form>
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
