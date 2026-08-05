import { PersonaPage } from "@/components/persona-page";
import { getExecutiveOverview } from "@/lib/kpis";
import { adaptDashboardData } from "@/lib/adapt-dashboard";
import { getProcurementOverview } from "@/lib/personas";

export default async function ProcurementPersonaPage() {
  const [executive, persona] = await Promise.all([getExecutiveOverview(), getProcurementOverview()]);
  return <PersonaPage dashboardProps={adaptDashboardData(executive)} persona={persona} activeHref="/persona/procurement" />;
}
