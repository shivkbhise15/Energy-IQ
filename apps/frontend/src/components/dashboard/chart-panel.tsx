import type { ReactNode } from "react";

type ChartPanelProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function ChartPanel({ title, action, children }: ChartPanelProps) {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-soft">
      <div className="mb-4 flex min-h-10 items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-panel-foreground">{title}</h2>
        {action}
      </div>
      <div className="h-72 min-w-0">{children}</div>
    </section>
  );
}
