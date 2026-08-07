import { DrillShell } from "@/components/drill-shell";
import { getDataSourceOverview } from "@/lib/drill";

export default async function DataSourcesDrill() {
  const { asOf, systems } = await getDataSourceOverview();
  const totalTables = systems.reduce((s, sys) => s + sys.tables.length, 0);
  const grandTotal = systems.reduce((s, sys) => s + sys.totalRows, 0);

  return (
    <DrillShell
      crumbs={[{ label: "Executive Overview", href: "/" }, { label: "Head of ICT", href: "/persona/ict" }, { label: "Source systems" }]}
      title="Connected source systems"
      subtitle={`${systems.length} systems, ${totalTables} tables, ${grandTotal.toLocaleString()} rows as of ${asOf}`}
      sourceSystem="Fabric Lakehouse"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {systems.map((sys) => (
          <div key={sys.system} className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#0A0E1A", margin: 0 }}>{sys.system}</h3>
              <span style={{ fontSize: 12, color: "#5A6880", fontFamily: "var(--font-sans)" }}>{sys.totalRows.toLocaleString()} rows total</span>
            </div>
            {sys.tables.map((t) => (
              <div key={t.table} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", borderBottom: "1px solid rgba(10,14,26,0.045)" }}>
                <span className="font-mono" style={{ fontSize: 12.5, color: "#2D3748" }}>{t.table}</span>
                <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#0A0E1A" }}>{t.rows.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </DrillShell>
  );
}
