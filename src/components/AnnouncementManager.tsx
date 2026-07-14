"use client";

/**
 * Mount boundary for announcement side-effects.
 * Logic lives in `useAnnouncements`; this component keeps the board tree explicit
 * and exposes a polite live region for accessibility tooling.
 */
export function AnnouncementManager({
  active,
  lastMessage,
}: {
  active: boolean;
  lastMessage?: string | null;
}) {
  return (
    <span className="sr-only" aria-live="polite">
      {active
        ? lastMessage ?? "Announcements enabled"
        : "Announcements disabled"}
    </span>
  );
}
