/**
 * MBTA countdown-sign style headsign abbreviations.
 * Real station signs use condensed ALL-CAPS labels with common shortenings.
 */

const ABBREVIATIONS: Record<string, string> = {
  "government center": "UNION SQ",
  "union square": "UNION SQ",
  "newton highlands": "N. HIGHLANDS",
  "newton centre": "N. CENTRE",
  "newton center": "N. CENTRE",
  "chestnut hill": "CHESTNUT HL",
  "brookline hills": "BRK HILLS",
  "brookline village": "BRK VILLAGE",
  "hynes convention center": "HYNES",
  "park street": "PARK ST",
  "riverside": "RIVERSIDE",
};

/** Normalize inbound terminating headsigns — GLX D-branch trips typically end at Union Square. */
export function normalizeInboundHeadsign(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "UNION SQ";

  const lower = trimmed.toLowerCase();
  if (lower.includes("government center") || lower.includes("gov")) return "Union Square";
  if (lower.includes("union square") || lower.includes("union sq")) return "Union Square";

  return trimmed;
}

/** Format a headsign like an MBTA LED countdown sign (ALL-CAPS, abbreviated). */
export function formatMbtaHeadsign(raw: string | null | undefined): string {
  const normalized = normalizeInboundHeadsign(raw);
  const lower = normalized.toLowerCase();

  for (const [key, abbrev] of Object.entries(ABBREVIATIONS)) {
    if (lower === key || lower.includes(key)) return abbrev;
  }

  return normalized.toUpperCase();
}
