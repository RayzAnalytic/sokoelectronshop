'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type StepContextValue = {
    registerSubmit: (fn: (() => Promise<boolean> | boolean) | null) => void;
    submitHandler: (() => Promise<boolean> | boolean) | null;
    loading: boolean;
    setLoading: (b: boolean) => void;
    error: string | null;
    setError: (s: string | null) => void;
};

const StepContext = createContext<StepContextValue | null>(null);

export function StepProvider({ children }: { children: React.ReactNode }) {
    const [submitHandler, setSubmitHandler] = useState<StepContextValue['submitHandler']>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const value = useMemo(
        () => ({
            registerSubmit: setSubmitHandler,
            submitHandler,
            loading,
            setLoading,
            error,
            setError,
        }),
        [submitHandler, loading, error]
    );

    return <StepContext.Provider value={value}>{children}</StepContext.Provider>;
}

export function useStepContext() {
    const ctx = useContext(StepContext);
    if (!ctx) throw new Error('useStepContext must be used inside <StepProvider>');
    return ctx;
}