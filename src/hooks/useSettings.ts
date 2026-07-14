"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, type BoardSettings } from "@/types/settings";

export function useSettings() {
  const [settings, setSettingsState] = useState<BoardSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettingsState(loadSettings());
    setHydrated(true);
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
