import { DataError } from "@/components/dashboard/data-error";
import { RoleAwareOverview } from "@/components/dashboard/role-aware-overview";
import { getMissionControlData } from "@/lib/dashboard-data";

export default async function OverviewPage() {
  let data;
  try {
    data = await getMissionControlData();
  } catch (error) {
    return <DataError error={error} />;
  }

  return <RoleAwareOverview data={data} />;
}
