import { PersonaPage } from "@/components/persona-page";
import { getExecutiveOverview } from "@/lib/kpis";
import { adaptDashboardData } from "@/lib/adapt-dashboard";
import { getCfoOverview } from "@/lib/personas";

export default async function CfoPersonaPage() {
  const [executive, persona] = await Promise.all([getExecutiveOverview(), getCfoOverview()]);
  return <PersonaPage dashboardProps={adaptDashboardData(executive)} persona={persona} activeHref="/persona/cfo" />;
}
