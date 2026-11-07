"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateAnalysisButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setError(null);

    const res = await fetch("/api/insights/generate", { method: "POST" });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setError(body.error ?? "We couldn't generate an analysis right now.");
      return;
    }

    setStatus("idle");
    router.refresh();
  }

  return (
    <div>
      <Button onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "Analyzing…" : "Generate or refresh today's analysis"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-elevated">
          {error}
        </p>
      )}
    </div>
  );
}
