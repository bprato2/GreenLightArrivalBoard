import { NextRequest, NextResponse } from "next/server";
import { searchDirectTrips } from "@/lib/mbta/tripSearch";
import { isTransitMode } from "@/lib/providers/types";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode");
  const originStopId = sp.get("origin")?.trim() ?? "";
  const destinationStopId = sp.get("destination")?.trim() ?? "";
  const date = sp.get("date")?.trim() ?? "";
  const time = sp.get("time")?.trim() ?? "08:00";
  const timePreference =
    sp.get("preference") === "arrive_by" ? "arrive_by" : "depart_after";
  const routeId = sp.get("route")?.trim() || undefined;

  if (!isTransitMode(mode) || mode === "amtrak") {
    return NextResponse.json(
      { error: "mode must be subway, commuter_rail, bus, or ferry" },
      { status: 400 },
    );
  }
  if (!originStopId || !destinationStopId) {
    return NextResponse.json(
      { error: "origin and destination are required" },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const apiKey =
    process.env.NEXT_PUBLIC_MBTA_API_KEY?.trim() ||
    process.env.MBTA_API_KEY?.trim() ||
    "";

  try {
    const trips = await searchDirectTrips({
      mode,
      originStopId,
      destinationStopId,
      date,
      time,
      timePreference,
      routeId,
      apiKey,
    });
    return NextResponse.json({
      trips,
      meta: {
        sameTripOnly: true,
        officialPlanner: "https://www.mbta.com/trip-planner",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
