'use client';

import { useEffect } from 'react';
import { useStepContext } from '@/components/onboarding/StepContext';

export function useRegisterStep(
    submit: () => Promise<boolean> | boolean
) {
    const { registerSubmit } = useStepContext();

    useEffect(() => {
        registerSubmit(submit);
        return () => registerSubmit(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submit]);
}