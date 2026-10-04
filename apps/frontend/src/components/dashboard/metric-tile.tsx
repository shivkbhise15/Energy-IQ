import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTileProps = {
  title: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  tone?: "primary" | "warning" | "danger" | "success";
};

export function MetricTile({ title, value, change, icon: Icon, tone = "primary" }: MetricTileProps) {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-panel-foreground">{value}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            tone === "primary" && "border-primary/25 bg-primary/10 text-primary",
            tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
            tone === "danger" && "border-danger/25 bg-danger/10 text-danger",
            tone === "success" && "border-success/25 bg-success/10 text-success"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {change ? <p className="mt-3 text-xs font-medium text-muted-foreground">{change}</p> : null}
    </section>
  );
}
