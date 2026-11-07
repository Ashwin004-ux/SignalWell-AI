"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CheckNotificationsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setError(null);

    const res = await fetch("/api/notifications/generate", { method: "POST" });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setError(body.error ?? "We couldn't check for new notifications.");
      return;
    }

    setStatus("idle");
    router.refresh();
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "Checking…" : "Check for updates"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-elevated">
          {error}
        </p>
      )}
    </div>
  );
}
