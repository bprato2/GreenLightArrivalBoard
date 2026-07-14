"use client";

import { useEffect, useRef } from "react";
import { playMBTAChime, unlockAudio } from "@/lib/audio/chime";
import {
  buildArrivingAnnouncement,
  buildThreeMinuteAnnouncement,
  speakAnnouncement,
} from "@/lib/audio/speech";
import type { Arrival } from "@/lib/mbta/types";

type AnnouncementKind = "3min" | "arriving";

function announcementKey(arrival: Arrival, kind: AnnouncementKind): string {
  const trip = arrival.tripId ?? arrival.id;
  return `${trip}:${kind}`;
}

async function announce(arrival: Arrival, kind: AnnouncementKind): Promise<void> {
  await unlockAudio();
  await playMBTAChime();
  const text =
    kind === "3min"
      ? buildThreeMinuteAnnouncement(arrival.headsign)
      : buildArrivingAnnouncement(arrival.headsign);
  await speakAnnouncement(text);
}

/**
 * Chime + TTS for inbound trains at the 3-minute and arriving windows.
 * Each trip is announced at most once per milestone.
 */
export function useAnnouncements(
  arrivals: Arrival[],
  enabled: boolean,
): { testAnnouncement: () => Promise<void> } {
  const announcedIds = useRef(new Set<string>());
  const unlocked = useRef(false);
  const queue = useRef(Promise.resolve());

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

    const liveTrips = new Set(
      arrivals.filter((a) => a.directionId === 1).map((a) => a.tripId ?? a.id),
    );
    for (const key of announcedIds.current) {
      const trip = key.replace(/:(3min|arriving)$/, "");
      if (!liveTrips.has(trip)) announcedIds.current.delete(key);
    }

    const inbound = arrivals.filter((a) => a.directionId === 1);

    for (const arrival of inbound) {
      const threeKey = announcementKey(arrival, "3min");
      if (arrival.minutesAway === 3 && !announcedIds.current.has(threeKey)) {
        announcedIds.current.add(threeKey);
        queue.current = queue.current.then(() => announce(arrival, "3min"));
      }

      const arrivingKey = announcementKey(arrival, "arriving");
      if (arrival.minutesAway <= 1 && !announcedIds.current.has(arrivingKey)) {
        announcedIds.current.add(arrivingKey);
        queue.current = queue.current.then(() => announce(arrival, "arriving"));
      }
    }
  }, [arrivals, enabled]);

  return {
    testAnnouncement: async () => {
      await unlockAudio();
      await playMBTAChime();
      await speakAnnouncement(buildThreeMinuteAnnouncement("Government Center"));
    },
  };
}
