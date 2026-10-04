import { useQuery } from "@tanstack/react-query";
import { Building2, Factory, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { DataTable } from "@/components/dashboard/data-table";
import { getBuildings } from "@/lib/api";

const fallbackBuildings = [
  { name: "Building A", city: "Mumbai", area: "82k sq ft", score: 91, alerts: 3 },
  { name: "Building B", city: "Bengaluru", area: "74k sq ft", score: 87, alerts: 5 },
  { name: "Building C", city: "Pune", area: "66k sq ft", score: 83, alerts: 4 },
  { name: "Building D", city: "Hyderabad", area: "58k sq ft", score: 89, alerts: 2 }
];

export function FacilitiesPage() {
  const { data } = useQuery({ queryKey: ["buildings"], queryFn: getBuildings, staleTime: 60_000 });
  const buildings = data?.items ?? fallbackBuildings;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-primary">Portfolio hierarchy</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">Facilities</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile title="Organizations" value="3" change="Multi-tenant active" icon={Factory} />
        <MetricTile title="Buildings" value={String(data?.total ?? buildings.length)} change="Portfolio sites" icon={Building2} tone="success" />
        <MetricTile title="Mapped Rooms" value={String(buildings.reduce((sum, building) => sum + ("_count" in building ? building._count.rooms : 0), 0))} change="Floors, zones, rooms" icon={MapPin} tone="warning" />
        <MetricTile title="Open Alerts" value={String(buildings.reduce((sum, building) => sum + ("_count" in building ? building._count.alerts : building.alerts), 0))} change="Across the portfolio" icon={ShieldCheck} tone="success" />
      </div>
      <DataTable title="Building Performance">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Building</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Efficiency</th>
              <th className="px-4 py-3">Alerts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {buildings.map((building) => (
              <tr key={building.name}>
                <td className="px-4 py-3 font-medium">{building.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{building.city}</td>
                <td className="px-4 py-3">{"areaSqFt" in building ? `${Math.round(building.areaSqFt / 1000)}k sq ft` : building.area}</td>
                <td className="px-4 py-3"><Badge tone="success">{"_count" in building ? `${building._count.devices} devices` : `${building.score}/100`}</Badge></td>
                <td className="px-4 py-3"><Badge tone={("_count" in building ? building._count.alerts : building.alerts) > 4 ? "warning" : "neutral"}>{"_count" in building ? building._count.alerts : building.alerts}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
