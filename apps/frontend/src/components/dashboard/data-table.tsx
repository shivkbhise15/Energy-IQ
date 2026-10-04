import type { ReactNode } from "react";

type DataTableProps = {
  title: string;
  children: ReactNode;
};

export function DataTable({ title, children }: DataTableProps) {
  return (
    <section className="rounded-lg border border-border bg-panel shadow-soft">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-panel-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
