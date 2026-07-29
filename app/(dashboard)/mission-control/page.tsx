import { Monitor } from "lucide-react";
import { DataError } from "@/components/dashboard/data-error";
import { MissionControlDetail } from "@/components/dashboard/mission-control-detail";
import { getOpsTelemetry } from "@/lib/dashboard-data";

export default async function MissionControlPage() {
  let data;
  try {
    data = await getOpsTelemetry();
  } catch (error) {
    return <DataError error={error} />;
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Monitor className="size-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">IT Mission Control</h1>
          <p className="text-[13px] font-medium text-secondary-foreground/80">
            Live operational telemetry for IT administrators and platform engineers
          </p>
        </div>
      </div>
      <MissionControlDetail data={data} />
    </div>
  );
}
