'use client';

import React from 'react';

type InputType =
    | 'text'
    | 'email'
    | 'tel'
    | 'url'
    | 'number'
    | 'password'
    | 'search'
    | 'date'
    | 'time';

type FieldProps = {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: InputType;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    help?: string;
    name?: string;
    required?: boolean;
    autoComplete?: string;
    inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal';
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
    name,
    required,
    autoComplete,
    inputMode,
}: FieldProps) {
    const inputId = React.useId();
    return (
        <label className="block" htmlFor={inputId}>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            <input
                id={inputId}
                name={name}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                autoComplete={autoComplete}
                inputMode={inputMode}
                aria-invalid={Boolean(error)}
                aria-describedby={
                    error ? `${inputId}-error` : help ? `${inputId}-help` : undefined
                }
                className={[
                    'w-full bg-slate-50 border rounded-sm px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1',
                    error
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-slate-200 focus:ring-blue-950',
                    disabled ? 'opacity-60 cursor-not-allowed' : '',
                ].join(' ')}
            />
            {help && !error && (
                <span
                    id={`${inputId}-help`}
                    className="block text-[10px] text-slate-400 mt-1"
                >
                    {help}
                </span>
            )}
            {error && (
                <span
                    id={`${inputId}-error`}
                    className="block text-[11px] text-red-600 mt-1"
                >
                    {error}
                </span>
            )}
        </label>
    );
}