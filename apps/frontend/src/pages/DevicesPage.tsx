import { useQuery } from "@tanstack/react-query";
import { Cpu, Gauge, PlugZap, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { DataTable } from "@/components/dashboard/data-table";
import { getDevices } from "@/lib/api";

const fallbackDevices = [
  { name: "Chiller Plant", type: "HVAC", status: "ONLINE", building: "Building A", sensors: 18 },
  { name: "Compressor 4", type: "COMPRESSOR", status: "MAINTENANCE", building: "Building A", sensors: 6 },
  { name: "Server Rack Hall 2", type: "SERVER_RACK", status: "ONLINE", building: "Building D", sensors: 42 },
  { name: "Lighting Grid West", type: "LIGHTING", status: "ONLINE", building: "Building C", sensors: 12 },
  { name: "Water Pump 8", type: "WATER_PUMP", status: "OFFLINE", building: "Building B", sensors: 5 }
];

export function DevicesPage() {
  const { data } = useQuery({ queryKey: ["devices"], queryFn: getDevices, staleTime: 30_000 });
  const devices = data?.items ?? fallbackDevices;
  const online = devices.filter((device) => device.status === "ONLINE").length;
  const sensors = devices.reduce((sum, device) => sum + ("_count" in device ? device._count.sensors : device.sensors), 0);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-primary">Equipment telemetry</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">Devices</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile title="Devices" value={String(data?.total ?? devices.length)} change="Registered equipment" icon={RadioTower} />
        <MetricTile title="Sensors" value={String(sensors)} change="Telemetry points" icon={Cpu} tone="success" />
        <MetricTile title="Online" value={`${Math.round((online / devices.length) * 100)}%`} change={`${online} reporting`} icon={PlugZap} tone="warning" />
        <MetricTile title="Avg Load" value="Live" change="From dashboard telemetry" icon={Gauge} tone="primary" />
      </div>
      <DataTable title="Device Registry">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Building</th>
              <th className="px-4 py-3">Sensors</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {devices.map((device) => (
              <tr key={device.name}>
                <td className="px-4 py-3 font-medium">{device.name}</td>
                <td className="px-4 py-3">{device.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{"building" in device ? (typeof device.building === "string" ? device.building : device.building.name) : "Unassigned"}</td>
                <td className="px-4 py-3">{"_count" in device ? device._count.sensors : device.sensors}</td>
                <td className="px-4 py-3"><Badge tone={device.status === "ONLINE" ? "success" : device.status === "OFFLINE" ? "danger" : "warning"}>{device.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
