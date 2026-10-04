import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Gauge,
  PlugZap,
  TrendingUp,
  Zap
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import { DataTable } from "@/components/dashboard/data-table";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { getDashboard } from "@/lib/api";
import { mockDashboard } from "@/lib/mock-data";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";
import { useUiStore } from "@/store/use-ui-store";

const rangeOptions = ["24h", "7d", "30d", "12m"] as const;

export function DashboardPage() {
  const selectedRange = useUiStore((state) => state.selectedRange);
  const setRange = useUiStore((state) => state.setRange);
  const { data, isFetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    refetchInterval: 45_000,
    placeholderData: mockDashboard
  });
  const dashboard = data ?? mockDashboard;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Enterprise energy intelligence</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">Executive Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Live consumption, forecasts, anomaly signals, and optimization work queue across the portfolio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-panel p-1">
            {rangeOptions.map((range) => (
              <Button
                key={range}
                size="sm"
                variant={selectedRange === range ? "primary" : "ghost"}
                className="h-8 min-w-12"
                onClick={() => setRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
          <Badge tone={isFetching ? "warning" : "success"}>{isFetching ? "Syncing" : "Live"}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile title="Current Consumption" value={formatCompactNumber(dashboard.widgets.currentConsumptionKw, " kW")} change="+6.4% vs baseline" icon={Zap} tone="primary" />
        <MetricTile title="Today's Consumption" value={formatCompactNumber(dashboard.widgets.todayConsumptionKwh, " kWh")} change="-3.1% vs yesterday" icon={PlugZap} tone="success" />
        <MetricTile title="Monthly Consumption" value={formatCompactNumber(dashboard.widgets.monthlyConsumptionKwh, " kWh")} change="+8.7% vs plan" icon={TrendingUp} tone="warning" />
        <MetricTile title="Predicted Bill" value={formatCurrency(dashboard.widgets.predictedMonthlyBillUsd)} change="Forecast through month end" icon={Banknote} tone="primary" />
        <MetricTile title="Active Alerts" value={String(dashboard.widgets.activeAlerts)} change="3 critical open" icon={AlertTriangle} tone="danger" />
        <MetricTile title="Efficiency Score" value={`${dashboard.widgets.efficiencyScore}/100`} change="Portfolio weighted" icon={Gauge} tone="success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartPanel title="Hourly Usage" action={<Badge tone="primary">kWh</Badge>}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.charts.hourlyUsage}>
                <defs>
                  <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f9488" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0f9488" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(122, 122, 122, 0.22)" />
                <XAxis dataKey="timestamp" tickFormatter={formatHour} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={56} />
                <Tooltip labelFormatter={formatDateTime} />
                <Area type="monotone" dataKey="value" stroke="#0f9488" fill="url(#usageFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
        <div className="xl:col-span-2">
          <ChartPanel title="Building Comparison" action={<Badge tone="neutral">Top sites</Badge>}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.charts.buildingComparison} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(122, 122, 122, 0.22)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={88} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Monthly Usage Forecast">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dashboard.charts.monthlyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(122, 122, 122, 0.22)" />
              <XAxis dataKey="timestamp" tickFormatter={formatMonth} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={64} />
              <Tooltip labelFormatter={formatMonthLong} />
              <Legend />
              <Line type="monotone" dataKey="value" name="Consumption" stroke="#0f9488" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Device Comparison">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboard.charts.deviceComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(122, 122, 122, 0.22)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={72} />
              <YAxis tickLine={false} axisLine={false} width={64} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <DataTable title="Top Energy Consumers">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dashboard.tables.topConsumers.map((item) => (
                <tr key={item.name}>
                  <td className="px-4 py-3 font-medium">{item.rank}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{formatCompactNumber(item.consumptionKwh, " kWh")}</td>
                  <td className="px-4 py-3">
                    <Badge tone={item.change > 0 ? "warning" : "success"}>{item.change > 0 ? "+" : ""}{item.change}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        <DataTable title="Recent Alerts">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Building</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dashboard.tables.recentAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-4 py-3">
                    <Badge tone={alert.level === "CRITICAL" ? "danger" : alert.level === "WARNING" ? "warning" : "neutral"}>{alert.level}</Badge>
                  </td>
                  <td className="px-4 py-3">{alert.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{alert.building?.name ?? "Portfolio"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        <DataTable title="Recent Recommendations">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Impact</th>
                <th className="px-4 py-3">Recommendation</th>
                <th className="px-4 py-3">Savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dashboard.tables.recentRecommendations.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <Badge tone={item.impact === "HIGH" ? "success" : "primary"}>{item.impact}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.narrative}</p>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(item.estimatedSavingsUsd ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </div>
    </div>
  );
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(value));
}

function formatMonthLong(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(value));
}
