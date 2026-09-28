// app/onboarding/steps/page.tsx
import { redirect } from 'next/navigation';

export default function OnboardingStepsIndexPage() {
  redirect('/auth/onboarding/steps/step1');
}