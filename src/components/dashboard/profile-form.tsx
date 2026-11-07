"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ProfileForm({
  initialFullName,
  initialTimezone,
  email
}: {
  initialFullName: string;
  initialTimezone: string;
  email: string;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, timezone })
    });

    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium text-slate-600">Email</label>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
      </div>
      <div>
        <label htmlFor="fullName" className="text-sm font-medium text-slate-600">
          Full name
        </label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
        />
      </div>
      <div>
        <label htmlFor="timezone" className="text-sm font-medium text-slate-600">
          Timezone
        </label>
        <input
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="e.g. Asia/Kolkata"
          className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
        />
        <p className="mt-1 text-xs text-slate-400">
          Used to decide when "today" ends for your daily records. Enter an IANA timezone name.
        </p>
      </div>
      {status === "error" && (
        <p role="alert" className="text-sm text-elevated">
          We couldn't save your profile. Try again.
        </p>
      )}
      <Button type="submit" disabled={status === "saving"} className="self-start">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
      </Button>
    </form>
  );
}
