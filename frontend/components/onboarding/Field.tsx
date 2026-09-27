// components/onboarding/Field.tsx

'use client';

import React from 'react';

type FieldProps = {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    help?: string;
};

export default function Field({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    error,
    disabled,
    help,
}: FieldProps) {
    return (
        <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                {label}
            </span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={[
                    'w-full bg-slate-50 border rounded-sm px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1',
                    error
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-slate-200 focus:ring-blue-950',
                    disabled ? 'opacity-60 cursor-not-allowed' : '',
                ].join(' ')}
            />
            {help && !error && (
                <span className="block text-[10px] text-slate-400 mt-1">{help}</span>
            )}
            {error && (
                <span className="block text-[11px] text-red-600 mt-1">{error}</span>
            )}
        </label>
    );
}