"use client";

import { useEffect, useRef } from "react";
import { playMBTAChime, unlockAudio } from "@/lib/audio/chime";
import {
  buildArrivingAnnouncement,
  buildThreeMinuteAnnouncement,
  primeSpeechSynthesis,
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

function isArrivingMilestone(arrival: Arrival): boolean {
  return (
    arrival.minutesAway <= 1 ||
    arrival.isApproaching ||
    arrival.status === "approaching" ||
    arrival.status === "boarding"
  );
}

/**
 * Chime + TTS for inbound trains at the 3-minute and arriving windows.
 * Uses threshold-crossing detection so announcements fire even if the 1 Hz
 * tick skips an exact minute value. Each trip is announced at most once
 * per milestone.
 */
export function useAnnouncements(
  arrivals: Arrival[],
  enabled: boolean,
): { testAnnouncement: () => Promise<void> } {
  const announcedIds = useRef(new Set<string>());
  const prevMinutes = useRef(new Map<string, number>());
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    if (!enabled) return;

    primeSpeechSynthesis();
    void unlockAudio();

    const unlock = () => {
      void unlockAudio();
      primeSpeechSynthesis();
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void unlockAudio();
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const inbound = arrivals.filter((a) => a.directionId === 1 && a.rowKind !== "scheduled");
    const liveTrips = new Set(inbound.map((a) => a.tripId ?? a.id));

    for (const key of announcedIds.current) {
      const trip = key.replace(/:(3min|arriving)$/, "");
      if (!liveTrips.has(trip)) announcedIds.current.delete(key);
    }

    for (const arrival of inbound) {
      const tripKey = arrival.tripId ?? arrival.id;
      const prev = prevMinutes.current.get(tripKey);
      const current = arrival.minutesAway;

      const threeKey = announcementKey(arrival, "3min");
      const crossedThreeMinute =
        prev !== undefined && prev > 3 && current <= 3 && current > 1;
      const atThreeMinute = current === 3 && prev !== 3;
      if (
        (crossedThreeMinute || atThreeMinute) &&
        !announcedIds.current.has(threeKey)
      ) {
        announcedIds.current.add(threeKey);
        queue.current = queue.current.then(() => announce(arrival, "3min"));
      }

      const arrivingKey = announcementKey(arrival, "arriving");
      const crossedArriving =
        prev !== undefined && prev > 1 && isArrivingMilestone(arrival);
      const atArriving = isArrivingMilestone(arrival) && prev !== undefined && prev > 1;
      if (
        (crossedArriving || (atArriving && current <= 1)) &&
        !announcedIds.current.has(arrivingKey)
      ) {
        announcedIds.current.add(arrivingKey);
        queue.current = queue.current.then(() => announce(arrival, "arriving"));
      }

      prevMinutes.current.set(tripKey, current);
    }

    for (const key of prevMinutes.current.keys()) {
      if (!liveTrips.has(key)) prevMinutes.current.delete(key);
    }
  }, [arrivals, enabled]);

  return {
    testAnnouncement: async () => {
      await unlockAudio();
      await playMBTAChime();
      await speakAnnouncement(buildThreeMinuteAnnouncement("Union Square"));
    },
  };
}
