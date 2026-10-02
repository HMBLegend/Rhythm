import { guardPage } from "@/lib/auth/guard";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  // Logged out -> /login, already onboarded -> /week.
  await guardPage("/onboarding");
  return <OnboardingForm />;
}
