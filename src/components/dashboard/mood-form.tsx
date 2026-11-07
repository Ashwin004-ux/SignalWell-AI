"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

function ScoreSlider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <span className="text-sm text-slate-500">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-signal-500"
      />
    </div>
  );
}

export function MoodForm() {
  const router = useRouter();
  const [mood, setMood] = useState(5);
  const [stress, setStress] = useState(5);
  const [anxiety, setAnxiety] = useState(5);
  const [wellbeing, setWellbeing] = useState(5);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    const res = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood_score: mood,
        stress_score: stress,
        anxiety_score: anxiety,
        wellbeing_score: wellbeing,
        notes: notes || null
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
      <ScoreSlider label="Mood" value={mood} onChange={setMood} />
      <ScoreSlider label="Stress" value={stress} onChange={setStress} />
      <ScoreSlider label="Anxiety" value={anxiety} onChange={setAnxiety} />
      <ScoreSlider label="Wellbeing" value={wellbeing} onChange={setWellbeing} />
      <div>
        <label htmlFor="notes" className="text-sm font-medium text-slate-600">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
        />
      </div>
      {status === "error" && (
        <p role="alert" className="text-sm text-elevated">
          We couldn't save today's entry. Check your connection and try again.
        </p>
      )}
      <Button type="submit" disabled={status === "saving"} className="self-start">
        {status === "saving" ? "Saving…" : "Save today's entry"}
      </Button>
    </form>
  );
}
