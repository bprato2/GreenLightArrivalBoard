"use client";

import { useEffect, useRef, useState } from "react";
import { isAudioUnlocked, playMBTAChime, unlockAudio } from "@/lib/audio/chime";
import {
  buildArrivingAnnouncement,
  buildThreeMinuteAnnouncement,
  isSpeechUnlocked,
  primeSpeechSynthesis,
  speakAnnouncement,
  unlockSpeechSynthesis,
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

function audioReady(): boolean {
  return isAudioUnlocked() && isSpeechUnlocked();
}

/**
 * Chime + TTS for inbound trains at the 3-minute and arriving windows.
 * Uses threshold-crossing detection so announcements fire even if the 1 Hz
 * tick skips an exact minute value. Each trip is announced at most once
 * per milestone.
 *
 * Mobile browsers require a user gesture before Web Audio / SpeechSynthesis
 * will play. `needsGesture` is true until that unlock succeeds.
 */
export function useAnnouncements(
  arrivals: Arrival[],
  enabled: boolean,
): {
  testAnnouncement: () => Promise<void>;
  enableFromGesture: () => Promise<void>;
  needsGesture: boolean;
} {
  const announcedIds = useRef(new Set<string>());
  const prevMinutes = useRef(new Map<string, number>());
  const queue = useRef(Promise.resolve());
  const [needsGesture, setNeedsGesture] = useState(false);

  const refreshGestureState = () => {
    setNeedsGesture(enabled && !audioReady());
  };

  useEffect(() => {
    if (!enabled) {
      setNeedsGesture(false);
      return;
    }

    primeSpeechSynthesis();
    refreshGestureState();

    const syncUnlockState = async () => {
      await unlockAudio();
      refreshGestureState();
    };

    void syncUnlockState();

    // Soft unlock on any interaction (helps Android / desktop).
    // iOS often still needs the explicit Enable button for a trusted speak().
    const unlock = () => {
      unlockSpeechSynthesis();
      void unlockAudio().then(() => {
        refreshGestureState();
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncUnlockState();
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshGestureState closes over enabled
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
      const wasAboveThree = prev === undefined || prev > 3;
      if (
        current <= 3 &&
        current > 1 &&
        wasAboveThree &&
        !announcedIds.current.has(threeKey)
      ) {
        announcedIds.current.add(threeKey);
        queue.current = queue.current.then(() => announce(arrival, "3min"));
      }

      const arrivingKey = announcementKey(arrival, "arriving");
      const wasAboveOne = prev === undefined || prev > 1;
      if (
        isArrivingMilestone(arrival) &&
        wasAboveOne &&
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

  const enableFromGesture = async () => {
    // speak() must run synchronously in this click handler for iOS
    // (before any await yields the gesture privilege).
    unlockSpeechSynthesis();
    await unlockAudio();
    await playMBTAChime();
    await speakAnnouncement("Announcements enabled.");
    refreshGestureState();
  };

  return {
    needsGesture,
    enableFromGesture,
    testAnnouncement: async () => {
      unlockSpeechSynthesis();
      await unlockAudio();
      await playMBTAChime();
      await speakAnnouncement(buildThreeMinuteAnnouncement("Union Square"));
      refreshGestureState();
    },
  };
}
