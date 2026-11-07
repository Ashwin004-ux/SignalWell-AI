"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SleepForm({ initialDate }: { initialDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [hours, setHours] = useState(7);
  const [minutes, setMinutes] = useState(0);
  const [quality, setQuality] = useState(3);
  const [interruptions, setInterruptions] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    const res = await fetch("/api/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        sleep_duration_minutes: hours * 60 + minutes,
        sleep_quality: quality,
        interruptions
      })
    });

    if (!res.ok) {
      setStatus("error");
      return;
    }

    setStatus("idle");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
      <div>
        <label htmlFor="date" className="text-sm font-medium text-slate-600">
          Night of
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="hours" className="text-sm font-medium text-slate-600">
            Hours
          </label>
          <input
            id="hours"
            type="number"
            min={0}
            max={24}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
          />
        </div>
        <div>
          <label htmlFor="minutes" className="text-sm font-medium text-slate-600">
            Minutes
          </label>
          <input
            id="minutes"
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="quality" className="text-sm font-medium text-slate-600">
            Sleep quality
          </label>
          <span className="text-sm text-slate-500">{quality}/5</span>
        </div>
        <input
          id="quality"
          type="range"
          min={1}
          max={5}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
          className="mt-1 w-full accent-signal-500"
        />
      </div>
      <div>
        <label htmlFor="interruptions" className="text-sm font-medium text-slate-600">
          Interruptions
        </label>
        <input
          id="interruptions"
          type="number"
          min={0}
          value={interruptions}
          onChange={(e) => setInterruptions(Number(e.target.value))}
          className="mt-1 w-24 rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
        />
      </div>
      {status === "error" && (
        <p role="alert" className="text-sm text-elevated">
          We couldn't save this entry. Check the date and values and try again.
        </p>
      )}
      <Button type="submit" disabled={status === "saving"} className="self-start">
        {status === "saving" ? "Saving…" : "Save sleep entry"}
      </Button>
    </form>
  );
}
