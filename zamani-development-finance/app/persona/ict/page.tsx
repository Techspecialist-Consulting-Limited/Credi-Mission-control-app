import { PersonaPage } from "@/components/persona-page";
import { getExecutiveOverview } from "@/lib/kpis";
import { adaptDashboardData } from "@/lib/adapt-dashboard";
import { getIctOverview } from "@/lib/personas";

export default async function IctPersonaPage() {
  const [executive, persona] = await Promise.all([getExecutiveOverview(), getIctOverview()]);
  return <PersonaPage dashboardProps={adaptDashboardData(executive)} persona={persona} activeHref="/persona/ict" />;
}
