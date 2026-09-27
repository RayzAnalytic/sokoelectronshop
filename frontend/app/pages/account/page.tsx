'use client';

import React from 'react';
import Link from 'next/link';
import {
    Package, Heart, Truck, Sparkles, ArrowRight, MapPin, Phone, Mail
} from 'lucide-react';
import { currentUser, orders, formatKES, statusColor } from '@/data/account';

export default function AccountOverview() {
    const recentOrders = [...orders]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);

    const inTransit = orders.filter(o => o.status === 'Shipped' || o.status === 'Packed').length;
    const defaultAddress = currentUser.addresses.find(a => a.isDefault) ?? currentUser.addresses[0];

    return (
        <div className="space-y-6">
            {/* Greeting */}
            <div className="bg-white border border-slate-200 rounded-sm p-6">
                <p className="text-sm text-slate-500">Welcome back,</p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                    Hi, {currentUser.firstName} 👋
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Member since {new Date(currentUser.joinedAt).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Total Orders', value: orders.length, icon: Package, tint: 'bg-blue-50 text-blue-950' },
                    { label: 'In Transit', value: inTransit, icon: Truck, tint: 'bg-indigo-50 text-indigo-900' },
                    { label: 'Wishlist Items', value: 12, icon: Heart, tint: 'bg-rose-50 text-rose-900' },
                    { label: 'Loyalty Points', value: currentUser.loyaltyPoints, icon: Sparkles, tint: 'bg-amber-50 text-amber-900' },
                ].map(({ label, value, icon: Icon, tint }) => (
                    <div key={label} className="bg-white border border-slate-200 rounded-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`w-9 h-9 rounded-sm flex items-center justify-center ${tint}`}>
                                <Icon className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="text-xl font-bold text-slate-900">{value.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Recent Orders */}
            <div className="bg-white border border-slate-200 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-900">Recent Orders</h2>
                    <Link href="/pages/account/orders" className="text-xs font-medium text-blue-950 hover:underline inline-flex items-center gap-1">
                        View all <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">No orders yet.</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {recentOrders.map((order) => (
                            <li key={order.id} className="p-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-900">{order.id}</span>
                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${statusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                                        {order.items.length} item{order.items.length > 1 ? 's' : ''} • {new Date(order.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-slate-900">{formatKES(order.total)}</p>
                                    <Link href="/pages/account/orders" className="text-[11px] text-blue-950 hover:underline">View</Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Two columns: default address + account details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-500" /> Default Address
                        </h2>
                        <Link href="/pages/account/addresses" className="text-xs text-blue-950 hover:underline">Edit</Link>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                        <span className="font-semibold text-slate-900">{defaultAddress.name}</span><br />
                        {defaultAddress.street}<br />
                        {defaultAddress.town}, {defaultAddress.county} {defaultAddress.postalCode}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {defaultAddress.phone}
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-slate-900">Account Details</h2>
                        <Link href="/pages/account/settings" className="text-xs text-blue-950 hover:underline">Edit</Link>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-700">
                        <li className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {currentUser.email}
                        </li>
                        <li className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {currentUser.phone}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}