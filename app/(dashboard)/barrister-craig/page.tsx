import { Scale } from "lucide-react";
import { DataError } from "@/components/dashboard/data-error";
import { BarristerCraigDetail } from "@/components/dashboard/barrister-craig-detail";
import { getBarristerCraigData } from "@/lib/platform-data";

export default async function BarristerCraigPage() {
  let data;
  try {
    data = await getBarristerCraigData();
  } catch (error) {
    return <DataError error={error} />;
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ai/10 text-ai">
          <Scale className="size-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">Barrister Craig</h1>
          <p className="text-[13px] font-medium text-secondary-foreground/80">AI compliance assistant · audit log review</p>
        </div>
      </div>
      <BarristerCraigDetail data={data} />
    </div>
  );
}
