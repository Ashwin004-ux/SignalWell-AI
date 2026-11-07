"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface MobileUsageFormProps {
  initialDate: string;
  minDate: string;
  entries: { date: string; minutes: number }[];
}

export function MobileUsageForm({ initialDate, minDate, entries }: MobileUsageFormProps) {
  const router = useRouter();
  const entryByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry.minutes])), [entries]);
  const [date, setDate] = useState(initialDate);
  const [minutes, setMinutes] = useState(() => {
    const existing = entryByDate.get(initialDate);
    return existing == null ? "" : String(existing);
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    const response = await fetch("/api/activity/mobile-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mobile_social_media_minutes: Number(minutes) })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "We couldn't save this mobile usage entry.");
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label htmlFor="mobile-usage-date" className="text-sm font-medium text-slate-600">Date</label>
        <input
          id="mobile-usage-date"
          type="date"
          min={minDate}
          max={initialDate}
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            setDate(nextDate);
            const existing = entryByDate.get(nextDate);
            setMinutes(existing == null ? "" : String(existing));
            setStatus("idle");
          }}
          required
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
        />
      </div>
      <div>
        <label htmlFor="mobile-social-minutes" className="text-sm font-medium text-slate-600">
          Social-media minutes on phone
        </label>
        <input
          id="mobile-social-minutes"
          type="number"
          min={0}
          max={1440}
          step={1}
          value={minutes}
          onChange={(event) => {
            setMinutes(event.target.value);
            setStatus("idle");
          }}
          required
          placeholder="e.g. 75"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
        />
      </div>
      <Button type="submit" disabled={status === "saving"} className="sm:mb-px">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save mobile usage"}
      </Button>
      {status === "error" && <p role="alert" className="text-sm text-elevated sm:col-span-3">{error}</p>}
      <p className="text-xs text-slate-500 sm:col-span-3">
        Enter the social-media category from your phone’s Screen Time or Digital Wellbeing report. This is a manual entry; SignalWell does not read phone usage automatically. Leave a recorded 0 if you checked and had no social-media use.
      </p>
    </form>
  );
}
