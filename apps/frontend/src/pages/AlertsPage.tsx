import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { DataTable } from "@/components/dashboard/data-table";
import { getAlerts, updateAlert } from "@/lib/api";

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["alerts"], queryFn: getAlerts, staleTime: 30_000 });
  const alerts = data?.items ?? [];
  const openAlerts = alerts.filter((alert) => alert.status === "OPEN");
  async function acknowledgeAll() {
    await Promise.all(openAlerts.map((alert) => updateAlert(alert.id, "ACKNOWLEDGED").catch(() => undefined)));
    await queryClient.invalidateQueries({ queryKey: ["alerts"] });
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Anomaly operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">Alerts</h1>
        </div>
        <Button variant="primary" onClick={() => void acknowledgeAll()} disabled={openAlerts.length === 0}><CheckCircle2 className="h-4 w-4" />Acknowledge Open</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile title="Open Alerts" value={String(openAlerts.length)} change={`${alerts.filter((alert) => alert.level === "CRITICAL").length} critical`} icon={Siren} tone="danger" />
        <MetricTile title="Warnings" value={String(alerts.filter((alert) => alert.level === "WARNING").length)} change="Across the portfolio" icon={AlertTriangle} tone="warning" />
        <MetricTile title="Mean Response" value="12m" change="-18% this week" icon={Clock} tone="success" />
        <MetricTile title="Resolved Today" value="27" change="Maintenance closed" icon={CheckCircle2} tone="success" />
      </div>
      <DataTable title="Alert Queue">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Alert</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Building</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td className="px-4 py-3"><Badge tone={alert.level === "CRITICAL" ? "danger" : alert.level === "WARNING" ? "warning" : "neutral"}>{alert.level}</Badge></td>
                <td className="px-4 py-3 font-medium">{alert.title}</td>
                <td className="px-4 py-3">{alert.device?.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{alert.building?.name ?? "Portfolio"}</td>
                <td className="px-4 py-3"><Badge tone={alert.status === "OPEN" ? "warning" : "success"}>{alert.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
