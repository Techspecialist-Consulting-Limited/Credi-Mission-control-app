import { Workflow } from "lucide-react";
import { DataError } from "@/components/dashboard/data-error";
import { CredoDetail } from "@/components/dashboard/credo-detail";
import { getCredoData, type CredoFilters } from "@/lib/platform-data";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CredoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filters: CredoFilters = {
    memoDepartment: first(params.memoDepartment),
    memoStatus: first(params.memoStatus),
    memoCategory: first(params.memoCategory),
    travelZone: first(params.travelZone),
    travelPurpose: first(params.travelPurpose),
    ticketCategory: first(params.ticketCategory),
    ticketStatus: first(params.ticketStatus),
  };

  let data;
  try {
    data = await getCredoData(filters);
  } catch (error) {
    return <DataError error={error} />;
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Workflow className="size-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">Credo</h1>
          <p className="text-[13px] font-medium text-secondary-foreground/80">Workflow automation · memos, travel and support</p>
        </div>
      </div>
      <CredoDetail data={data} />
    </div>
  );
}
