"use client";

import { useRouter } from "next/navigation";
import { AmtrakPanel } from "@/components/AmtrakPanel";
import { AppChrome } from "@/components/AppChrome";
import { TripPlanner } from "@/components/TripPlanner";
import { useSettings } from "@/hooks/useSettings";
import { ROUTE_ID } from "@/lib/mbta/boardConfig";
import type { TransitMode } from "@/lib/providers/types";

export default function PlanPage() {
  const router = useRouter();
  const { settings, setSettings, hydrated } = useSettings();

  const setMode = (mode: TransitMode) => {
    setSettings({
      ...settings,
      mode,
      routeId: mode === "subway" ? ROUTE_ID : settings.routeId,
    });
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black text-amber-500">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-black text-amber-400"
      data-allow-scroll="true"
    >
      <AppChrome
        mode={settings.mode}
        appView="plan"
        onModeChange={setMode}
        onViewChange={(view) => {
          if (view === "board") router.push("/");
          if (view === "map") router.push("/map");
        }}
      />
      {settings.mode === "amtrak" ? (
        <AmtrakPanel />
      ) : (
        <TripPlanner mode={settings.mode} defaultRouteId={settings.routeId} />
      )}
    </div>
  );
}
