import { ShoppingBag } from "lucide-react";
import { DataError } from "@/components/dashboard/data-error";
import { ProcurementDetail } from "@/components/dashboard/procurement-detail";
import { getProcurementDetailData } from "@/lib/platform-data";

export default async function ProcurementPage() {
  let data;
  try {
    data = await getProcurementDetailData();
  } catch (error) {
    return <DataError error={error} />;
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <ShoppingBag className="size-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">Procurement Portal</h1>
          <p className="text-[13px] font-medium text-secondary-foreground/80">Vendor registry and compliance status</p>
        </div>
      </div>
      <ProcurementDetail data={data} />
    </div>
  );
}
