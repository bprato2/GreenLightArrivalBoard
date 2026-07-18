"use client";

import { useCallback, useEffect, useState } from "react";
import { detectLocationRouteDefaults } from "@/lib/mbta/locationDefaults";
import { GREEN_D_STATIONS } from "@/lib/mbta/stations";
import { hasStoredSettings, loadSettings, saveSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, type BoardSettings } from "@/types/settings";

function isFactoryRoute(settings: BoardSettings): boolean {
  return (
    settings.mode === DEFAULT_SETTINGS.mode &&
    settings.routeId === DEFAULT_SETTINGS.routeId &&
    settings.stopId === DEFAULT_SETTINGS.stopId &&
    settings.directionId === DEFAULT_SETTINGS.directionId
  );
}

export function useSettings() {
  const [settings, setSettingsState] = useState<BoardSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hadStored = hasStoredSettings();
    const loaded = loadSettings();
    setSettingsState(loaded);
    setHydrated(true);

    if (hadStored) return;

    saveSettings(loaded);

    let cancelled = false;
    void detectLocationRouteDefaults().then((route) => {
      if (cancelled || !route) return;
      setSettingsState((prev) => {
        if (!isFactoryRoute(prev)) return prev;
        const next = {
          ...prev,
          mode: "subway" as const,
          routeId: "Green-D",
          stopId: route.stopId,
          stopName:
            GREEN_D_STATIONS.find((s) => s.id === route.stopId)?.name ??
            prev.stopName,
          directionId: route.directionId,
        };
        saveSettings(next);
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setSettings = useCallback((next: BoardSettings | ((prev: BoardSettings) => BoardSettings)) => {
    setSettingsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveSettings(resolved);
      return resolved;
    });
  }, []);

  const updateSetting = useCallback(
    <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [setSettings],
  );

  return { settings, setSettings, updateSetting, hydrated };
}
