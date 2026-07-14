"use client";

/**
 * Side-effect component: announcement logic lives in useAnnouncements.
 * Mounted on the board so the hook owns a clear component boundary.
 */
export function AnnouncementManager({ active }: { active: boolean }) {
  return (
    <span className="sr-only" aria-live="polite">
      {active ? "Announcements enabled" : "Announcements disabled"}
    </span>
  );
}
