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
  riverside: "RIVERSIDE",
};

function isGenericHeadsign(raw: string): boolean {
  return !raw || /^train$/i.test(raw) || /^trip$/i.test(raw);
}

/** Normalize terminating headsigns for the selected direction. */
export function normalizeHeadsign(
  raw: string | null | undefined,
  directionId = 1,
  terminusFallback?: string | null,
): string {
  const trimmed = raw?.trim() ?? "";
  const terminus = terminusFallback?.trim() || "";
  const fallback =
    terminus || (directionId === 1 ? "Union Square" : "Riverside");

  if (isGenericHeadsign(trimmed)) return fallback;

  const lower = trimmed.toLowerCase();
  if (directionId === 1) {
    if (lower.includes("government center") || lower.includes("gov")) {
      return "Union Square";
    }
    if (lower.includes("union square") || lower.includes("union sq")) {
      return "Union Square";
    }
  }

  return trimmed;
}

/** @deprecated Use normalizeHeadsign(raw, 1). */
export function normalizeInboundHeadsign(raw: string | null | undefined): string {
  return normalizeHeadsign(raw, 1);
}

/** Format a headsign like an MBTA LED countdown sign (ALL-CAPS, abbreviated). */
export function formatMbtaHeadsign(
  raw: string | null | undefined,
  directionId = 1,
  terminusFallback?: string | null,
): string {
  const normalized = normalizeHeadsign(raw, directionId, terminusFallback);
  const lower = normalized.toLowerCase();

  for (const [key, abbrev] of Object.entries(ABBREVIATIONS)) {
    if (lower === key || lower.includes(key)) return abbrev;
  }

  return normalized.toUpperCase();
}
