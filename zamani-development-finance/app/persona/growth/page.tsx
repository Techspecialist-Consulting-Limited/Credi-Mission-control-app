import { PersonaPage } from "@/components/persona-page";
import { getExecutiveOverview } from "@/lib/kpis";
import { adaptDashboardData } from "@/lib/adapt-dashboard";
import { getGrowthOverview } from "@/lib/personas";

export default async function GrowthPersonaPage() {
  const [executive, persona] = await Promise.all([getExecutiveOverview(), getGrowthOverview()]);
  return <PersonaPage dashboardProps={adaptDashboardData(executive)} persona={persona} activeHref="/persona/growth" />;
}
