"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { UserSettings } from "@/lib/types/database";

const TOGGLES: { key: keyof UserSettings; label: string; help: string }[] = [
  {
    key: "data_collection_enabled",
    label: "Collect activity, sleep, and mood data",
    help: "Turning this off stops new entries from being saved. Existing data is untouched."
  },
  {
    key: "analytics_enabled",
    label: "Generate AI wellbeing analysis",
    help: "Turns off the daily/weekly analysis pipeline that produces indicators and insights."
  },
  {
    key: "chatbot_enabled",
    label: "Enable SignalWell Assistant",
    help: "Disables the chatbot entirely."
  },
  {
    key: "chatbot_can_access_activity_data",
    label: "Let the assistant use my activity data",
    help: "If off, the assistant can still chat but won't read your browser usage, sleep, or mood records."
  },
  {
    key: "notifications_enabled",
    label: "Send notifications",
    help: "Covers high browser usage, late-night usage, sleep pattern, and positive-change notifications."
  }
];

export function PrivacyControls({ initialSettings }: { initialSettings: UserSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof UserSettings) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingKey(key);
    setError(null);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] })
    });

    setSavingKey(null);

    if (!res.ok) {
      setSettings(settings);
      setError("We couldn't save that change. Try again.");
    }
  }

  async function handleExport() {
    const res = await fetch("/api/settings/export");
    if (!res.ok) {
      setError("We couldn't put together your export.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "signalwell-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch("/api/settings/delete-account", { method: "POST" });
    setDeleting(false);

    if (!res.ok) {
      setError("We couldn't delete your account. Try again or contact support.");
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border border-slate-200 bg-white">
        {TOGGLES.map(({ key, label, help }, i) => (
          <div
            key={key}
            className={`flex items-center justify-between gap-4 p-4 ${i > 0 ? "border-t border-slate-100" : ""}`}
          >
            <div>
              <p className="text-sm font-medium text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{help}</p>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(settings[key])}
              aria-label={label}
              onClick={() => toggle(key)}
              disabled={savingKey === key}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                settings[key] ? "bg-signal-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings[key] ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-elevated">
          {error}
        </p>
      )}

      <div className="rounded border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-ink">Export your data</p>
        <p className="mt-1 text-xs text-slate-500">
          Download every record SignalWell has stored for your account as a JSON file.
        </p>
        <Button variant="secondary" className="mt-3" onClick={handleExport}>
          Export my data
        </Button>
      </div>

      <div className="rounded border border-elevated/30 bg-elevated/5 p-4">
        <p className="text-sm font-medium text-ink">Delete account</p>
        <p className="mt-1 text-xs text-slate-500">
          This permanently deletes your account and every record associated with it — activity, sleep,
          mood, analysis, and conversations. This cannot be undone.
        </p>
        <label htmlFor="delete-confirm" className="mt-3 block text-xs text-slate-500">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirm"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <div className="mt-3">
          <Button
            variant="secondary"
            className="border-elevated text-elevated hover:border-elevated"
            disabled={deleteConfirm !== "DELETE" || deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
