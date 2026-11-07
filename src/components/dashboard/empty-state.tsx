import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded border border-dashed border-slate-300 bg-slate-50 p-6">
      <Icon className="h-5 w-5 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-1 inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-slate-500"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
