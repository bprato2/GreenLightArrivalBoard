"use client";

import { useEffect, useRef } from "react";
import { playMbtaChime, unlockAudio } from "@/lib/audio/chime";
import { buildArrivalAnnouncement, speakAnnouncement } from "@/lib/audio/speech";
import type { Arrival } from "@/lib/mbta/types";

const ANNOUNCE_WITHIN_MINUTES = 2;

/**
 * Announces each inbound train at most once when it enters the imminent window.
 * Uses Web Audio chime + SpeechSynthesis (no audio files).
 */
export function useAnnouncements(
  arrivals: Arrival[],
  enabled: boolean,
): { testAnnouncement: () => Promise<void> } {
  const announcedIds = useRef(new Set<string>());
  const unlocked = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onGesture = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      void unlockAudio();
    };

    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const liveIds = new Set(arrivals.map((a) => a.id));
    // Forget ids that left the board so a later trip reuse can announce again.
    for (const id of announcedIds.current) {
      if (!liveIds.has(id)) announcedIds.current.delete(id);
    }

    const next = arrivals.find(
      (a) =>
        a.minutesAway <= ANNOUNCE_WITHIN_MINUTES &&
        !announcedIds.current.has(a.id),
    );
    if (!next) return;

    announcedIds.current.add(next.id);
    void (async () => {
      await unlockAudio();
      await playMbtaChime();
      await new Promise((r) => setTimeout(r, 400));
      await speakAnnouncement(buildArrivalAnnouncement(next.headsign));
    })();
  }, [arrivals, enabled]);

  return {
    testAnnouncement: async () => {
      await unlockAudio();
      await playMbtaChime();
      await new Promise((r) => setTimeout(r, 400));
      await speakAnnouncement(
        buildArrivalAnnouncement("Government Center"),
      );
    },
  };
}
