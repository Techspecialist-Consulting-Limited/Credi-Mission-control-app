import { Sidebar } from "@/components/shell/sidebar";
import { TopNav } from "@/components/shell/top-nav";
import { ViewerProvider } from "@/components/shell/viewer-context";
import { AiModalProvider } from "@/components/shell/ai-modal-context";
import { AiModal } from "@/components/shell/ai-modal";
import { getShellData } from "@/lib/dashboard-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getShellData().catch(() => ({
    status: { ok: false, provider: "unknown", synthetic: true },
    notifications: [],
  }));

  return (
    <ViewerProvider>
      <AiModalProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <Sidebar status={shell.status} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav notifications={shell.notifications} />
            <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
          </div>
        </div>
        <AiModal />
      </AiModalProvider>
    </ViewerProvider>
  );
}
