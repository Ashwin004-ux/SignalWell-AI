"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshDashboardButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="px-3 py-2 text-xs"
      aria-label="Refresh dashboard data"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
      {isPending ? "Refreshing…" : "Refresh data"}
    </Button>
  );
}
