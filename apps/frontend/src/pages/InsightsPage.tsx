import { useQuery } from "@tanstack/react-query";
import { Brain, FileSearch, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { DataTable } from "@/components/dashboard/data-table";
import { getDashboard } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export function InsightsPage() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const recommendations = data?.tables.recentRecommendations ?? [];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-primary">Recommendations and vector search</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">AI Insights</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile title="Recommendations" value={String(recommendations.length)} change={`${recommendations.filter((item) => item.impact === "HIGH").length} high impact`} icon={Sparkles} tone="success" />
        <MetricTile title="Similar Incidents" value="143" change="Qdrant indexed" icon={FileSearch} tone="primary" />
        <MetricTile title="Forecast Horizon" value="30d" change="Monthly bill model" icon={TrendingUp} tone="warning" />
        <MetricTile title="Models" value="4" change="Anomaly and forecast" icon={Brain} tone="primary" />
      </div>
      <DataTable title="Optimization Work Queue">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Impact</th>
              <th className="px-4 py-3">Insight</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Estimated Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recommendations.map((recommendation) => (
              <tr key={recommendation.id}>
                <td className="px-4 py-3"><Badge tone={recommendation.impact === "HIGH" ? "success" : "primary"}>{recommendation.impact}</Badge></td>
                <td className="px-4 py-3">
                  <p className="font-medium">{recommendation.title}</p>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{recommendation.narrative}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{recommendation.device?.name}</td>
                <td className="px-4 py-3">{formatCurrency(recommendation.estimatedSavingsUsd ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
