"use client";

import { Calendar } from "lucide-react";
import { useViewer } from "@/components/shell/viewer-context";
import { MdOverview } from "./md-overview";
import { ItOverview } from "./it-overview";
import { ProcurementOverview } from "./procurement-overview";
import { StrategyOverview } from "./strategy-overview";
import { timeGreeting, PERSONA_SUBTEXT } from "@/lib/personas";
import type { MissionControlData } from "@/lib/dashboard-data";

const today = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

export function RoleAwareOverview({ data }: { data: MissionControlData }) {
  const { persona } = useViewer();

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          {timeGreeting()}, {persona.firstName}
        </h1>
        <p className="mt-1 text-sm font-medium text-secondary-foreground/80">{PERSONA_SUBTEXT[persona.key]}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-secondary-foreground/80">
          <Calendar className="size-3.5" />
          {today}
        </p>
      </div>

      {persona.key === "it" && <ItOverview data={data.it} />}
      {persona.key === "procurement" && <ProcurementOverview data={data.procurement} />}
      {persona.key === "strategy" && <StrategyOverview data={data.strategy} />}
      {persona.key === "md" && <MdOverview data={data.md} />}
    </div>
  );
}
