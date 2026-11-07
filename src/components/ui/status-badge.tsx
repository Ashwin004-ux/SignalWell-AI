import clsx from "clsx";
import type { RiskLevel } from "@/lib/types/database";

const LABEL: Record<RiskLevel, string> = {
  stable: "Stable",
  monitor: "Monitor",
  elevated: "Elevated"
};

const CLASSES: Record<RiskLevel, string> = {
  stable: "bg-signal-500/10 text-signal-700 border-signal-500/30",
  monitor: "bg-monitor/10 text-monitor border-monitor/30",
  elevated: "bg-elevated/10 text-elevated border-elevated/30"
};

/**
 * Never relies on color alone: every badge also renders its text label,
 * and a small glyph distinguishes the three states for colorblind users.
 */
export function StatusBadge({ level }: { level: RiskLevel }) {
  const glyph = level === "stable" ? "●" : level === "monitor" ? "◆" : "▲";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium",
        CLASSES[level]
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      {LABEL[level]}
    </span>
  );
}
