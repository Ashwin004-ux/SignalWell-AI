import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Button as BaseButton } from "@/components/ui/button";
import { Card as BaseCard } from "@/components/ui/card";

export function Card({ className, padding: _padding, ...props }: HTMLAttributes<HTMLDivElement> & { padding?: "sm" | "md" }) {
  return <BaseCard className={clsx("min-w-0", className)} {...props} />;
}
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("mb-4 flex items-start justify-between gap-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={clsx("text-base font-semibold text-ink", className)} {...props} />;
}
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx("text-sm text-slate-500", className)} {...props} />;
}
export function Badge({ children, className, variant = "default" }: { children: ReactNode; className?: string; variant?: "warning" | "info" | "default" }) {
  const variants = { warning: "border-amber-300 bg-amber-50 text-amber-900", info: "border-signal-500/30 bg-signal-500/10 text-signal-700", default: "border-slate-300 bg-slate-50 text-slate-700" };
  return <span className={clsx("inline-flex items-center rounded border px-2 py-1 text-xs font-medium", variants[variant], className)}>{children}</span>;
}
export function Button({ loading, children, disabled, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return <BaseButton disabled={disabled || loading} className={className} {...props}>{loading ? "Loading…" : children}</BaseButton>;
}
