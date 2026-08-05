import { adaptDashboardData } from "@/lib/adapt-dashboard";
import { getExecutiveOverview } from "@/lib/kpis";
import { Dashboard } from "@/components/dashboard";

export default async function Home() {
  const data = await getExecutiveOverview();
  const props = adaptDashboardData(data);
  return <Dashboard {...props} />;
}
