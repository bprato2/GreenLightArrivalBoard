"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { BoardRouteControls } from "@/components/BoardRouteControls";
import { createAlertAdapter } from "@/lib/alerts/beacon";
import { playMbtaChime, unlockAudio } from "@/lib/audio/chime";
import {
  buildArrivalAnnouncement,
  speakAnnouncement,
  unlockSpeechSynthesis,
} from "@/lib/audio/speech";
import { useSettings } from "@/hooks/useSettings";
import type { BoardSettings } from "@/types/settings";

export function SettingsForm() {
  const { settings, setSettings, hydrated } = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [draft, setDraft] = useState<BoardSettings>(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated) setDraft(settings);
  }, [hydrated, settings]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-amber-500">
        Loading…
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-6 text-amber-400">
        <h1 className="led-text mb-6 text-2xl tracking-[0.2em]">SETTINGS</h1>
        <form
          className="flex w-full max-w-xs flex-col gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (pinInput === settings.settingsPin) {
              setUnlocked(true);
              setPinError(false);
            } else {
              setPinError(true);
            }
          }}
        >
          <label className="text-sm text-amber-600/80" htmlFor="pin">
            Enter PIN
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="rounded border border-amber-900/60 bg-black px-3 py-2 text-center text-lg tracking-[0.4em] text-amber-300 outline-none focus:border-amber-500"
          />
          {pinError && (
            <p className="text-center text-sm text-red-400">Incorrect PIN</p>
          )}
          <button
            type="submit"
            className="rounded bg-amber-700/30 py-2 text-amber-200 hover:bg-amber-700/50"
          >
            Unlock
          </button>
          <Link href="/" className="text-center text-sm text-amber-700 hover:text-amber-400">
            ← Back to board
          </Link>
        </form>
      </div>
    );
  }

  const patch = <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = () => {
    setSettings(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const stationName = draft.stopName || draft.stopId;

  const testAnnouncement = async () => {
    setTestStatus("Playing chime + speech…");
    unlockSpeechSynthesis();
    await unlockAudio();
    await playMbtaChime();
    await new Promise((r) => setTimeout(r, 400));
    await speakAnnouncement(
      buildArrivalAnnouncement(draft.directionId === 1 ? "Union Square" : "Riverside"),
    );
    setTestStatus("Announcement finished");
  };

  const testAlert = async () => {
    setTestStatus("Sending pulse → imminent alerts…");
    const adapter = createAlertAdapter(draft.alertWebhookUrl);
    await adapter.onPhaseChange({
      phase: "pulse",
      minutesAway: 5,
      at: new Date().toISOString(),
      stationId: draft.stopId,
      stationName,
    });
    await new Promise((r) => setTimeout(r, 1200));
    await adapter.onPhaseChange({
      phase: "imminent",
      minutesAway: 1,
      at: new Date().toISOString(),
      stationId: draft.stopId,
      stationName,
    });
    await new Promise((r) => setTimeout(r, 800));
    await adapter.onPhaseChange({
      phase: "idle",
      minutesAway: null,
      at: new Date().toISOString(),
      stationId: draft.stopId,
      stationName,
    });
    setTestStatus(
      draft.alertWebhookUrl
        ? "Alert phases posted to webhook"
        : "Alert phases fired (no webhook URL set — visual-only adapter)",
    );
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-zinc-950 px-5 py-6 text-amber-100">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-wide text-amber-300">
            Board settings
          </h1>
          <Link href="/" className="text-sm text-amber-600 hover:text-amber-300">
            ← Board
          </Link>
        </div>

        <BoardRouteControls
          settings={draft}
          onChange={(routePatch) => setDraft((d) => ({ ...d, ...routePatch }))}
        />

        <Toggle
          label="Announcements"
          checked={draft.announcementsEnabled}
          onChange={(v) => patch("announcementsEnabled", v)}
        />
        <Toggle
          label="Weather widget"
          checked={draft.weatherEnabled}
          onChange={(v) => patch("weatherEnabled", v)}
        />
        <Toggle
          label="Mini-map"
          checked={draft.miniMapEnabled}
          onChange={(v) => patch("miniMapEnabled", v)}
        />

        <fieldset className="rounded-lg border border-zinc-800 p-4">
          <legend className="px-1 text-sm text-amber-500">Arrival alert timing</legend>
          <NumberField
            label="Pulse from (min)"
            value={draft.alertPulseMinMinutes}
            min={1}
            max={15}
            onChange={(v) => patch("alertPulseMinMinutes", v)}
          />
          <NumberField
            label="Pulse until (min)"
            value={draft.alertPulseMaxMinutes}
            min={2}
            max={20}
            onChange={(v) => patch("alertPulseMaxMinutes", v)}
          />
          <NumberField
            label="Solid imminent at ≤ (min)"
            value={draft.alertImminentMinutes}
            min={0}
            max={5}
            onChange={(v) => patch("alertImminentMinutes", v)}
          />
          <p className="mt-2 text-xs text-zinc-500">
            Used for webhook / beacon phases. The on-screen leave banner ignores
            these values and uses walk time vs train ETA instead: it prompts when
            walking would leave at least 1 minute to spare, and shows a miss notice
            when the soonest train is already too close.
          </p>
        </fieldset>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-amber-500">LED glow intensity ({Math.round(draft.ledGlowIntensity * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(draft.ledGlowIntensity * 100)}
            onChange={(e) => patch("ledGlowIntensity", Number(e.target.value) / 100)}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-amber-500">Alert webhook URL (optional)</span>
          <input
            type="url"
            placeholder="https://homeassistant.local/api/webhook/…"
            value={draft.alertWebhookUrl}
            onChange={(e) => patch("alertWebhookUrl", e.target.value)}
            className="rounded border border-zinc-700 bg-black px-3 py-2 text-amber-100 outline-none focus:border-amber-600"
          />
          <span className="text-xs text-zinc-500">
            Receives JSON POSTs on phase changes — wire to Home Assistant, ESPHome, or any automation.
          </span>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-amber-500">Settings PIN (4–8 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            value={draft.settingsPin}
            onChange={(e) => patch("settingsPin", e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="rounded border border-zinc-700 bg-black px-3 py-2 tracking-[0.3em] text-amber-100 outline-none focus:border-amber-600"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void testAnnouncement()}
            className="rounded bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
          >
            Test announcement
          </button>
          <button
            type="button"
            onClick={() => void testAlert()}
            className="rounded bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
          >
            Test arrival alert
          </button>
        </div>

        {testStatus && <p className="text-sm text-emerald-400/90">{testStatus}</p>}

        <button
          type="button"
          onClick={save}
          className="rounded bg-amber-600/40 py-3 font-medium text-amber-50 hover:bg-amber-600/60"
        >
          {savedFlash ? "Saved" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 px-4 py-3">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-amber-500"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-2 flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded border border-zinc-700 bg-black px-2 py-1 text-right outline-none focus:border-amber-600"
      />
    </label>
  );
}
