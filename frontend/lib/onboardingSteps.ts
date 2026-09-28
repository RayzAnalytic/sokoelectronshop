// lib/onboardingSteps.ts

export type OnboardingStep = {
    slug: string;
    title: string;
    description: string;
    optional: boolean;
};

export const STEPS = [
    { slug: 'step1', title: 'Account', description: 'Confirm your details', optional: false },
    { slug: 'step2', title: 'Store Profile', description: 'Name, logo, contact', optional: false },
    { slug: 'step3', title: 'Business', description: 'KRA PIN & eTIMS', optional: true },
    { slug: 'step4', title: 'Payments', description: 'M-Pesa, Airtel, Bank, Stripe', optional: false },
    { slug: 'step5', title: 'WhatsApp', description: 'Cart & order messaging', optional: false },
    { slug: 'step6', title: 'Shipping', description: 'Zones & delivery rates', optional: false },
    { slug: 'step7', title: 'First Category', description: 'Organize your catalog', optional: false },
    { slug: 'step8', title: 'First Product', description: 'Add something to sell', optional: false },
    { slug: 'step9', title: 'Social Media', description: 'TikTok, Instagram, Facebook', optional: true },
    { slug: 'step10', title: 'Theme', description: 'Colors, fonts, layout', optional: true },
    { slug: 'step11', title: 'Invite Team', description: 'Staff & roles', optional: true },
    { slug: 'step12', title: 'Finish', description: 'Review & go live', optional: false },
] as const satisfies readonly OnboardingStep[];

export type StepSlug = (typeof STEPS)[number]['slug'];

export const TOTAL_STEPS = STEPS.length;
export const STEP_SLUGS: StepSlug[] = STEPS.map((s) => s.slug);

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

export function getStepBySlug(slug: string): OnboardingStep | undefined {
    return STEPS.find((s) => s.slug === slug);
}

export function getStepIndex(slug: string): number {
    return STEPS.findIndex((s) => s.slug === slug);
}

export function getStepNumber(slug: string): number {
    return getStepIndex(slug) + 1;
}

export function getNextStep(currentSlug: string): OnboardingStep | undefined {
    const idx = getStepIndex(currentSlug);
    if (idx === -1) return undefined;
    return STEPS[idx + 1];
}

export function getPreviousStep(currentSlug: string): OnboardingStep | undefined {
    const idx = getStepIndex(currentSlug);
    if (idx <= 0) return undefined;
    return STEPS[idx - 1];
}

export function getNextRoute(currentSlug: string): string {
    const next = getNextStep(currentSlug);
    if (!next) return '/auth/onboarding/complete';
    return `/auth/onboarding/steps/${next.slug}`;
}

export function getPreviousRoute(currentSlug: string): string {
    const prev = getPreviousStep(currentSlug);
    if (!prev) return '/auth/onboarding';
    return `/auth/onboarding/steps/${prev.slug}`;
}

/**
 * Extract the step slug from a pathname — returns null if the route
 * doesn't contain a known step.
 */
export function getSlugFromPathname(pathname: string): StepSlug | null {
    for (const slug of STEP_SLUGS) {
        if (pathname.includes(slug)) return slug;
    }
    return null;
}

export function isStepSlug(value: string): value is StepSlug {
    return (STEP_SLUGS as string[]).includes(value);
}