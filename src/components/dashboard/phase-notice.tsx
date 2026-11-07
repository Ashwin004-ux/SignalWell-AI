import type { LucideIcon } from "lucide-react";

/**
 * Used on dashboard sections that are architected (schema, RLS, nav entry)
 * but whose data pipeline lands in a later build phase. Never shows fake
 * charts or numbers in place of the real thing — see docs/ROADMAP.md.
 */
export function PhaseNotice({
  icon: Icon,
  title,
  description,
  phase
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6">
      <Icon className="h-5 w-5 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-prose text-sm text-slate-500">{description}</p>
      <p className="mt-3 text-xs text-slate-400">Planned for {phase} — see docs/ROADMAP.md.</p>
    </div>
  );
}
