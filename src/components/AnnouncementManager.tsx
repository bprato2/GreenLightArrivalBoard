/**
 * Mount boundary for announcement accessibility status.
 * Playback logic lives in `useAnnouncements`; enable/disable is in Settings.
 */
export function AnnouncementManager({
  active,
  lastMessage,
}: {
  active: boolean;
  lastMessage?: string;
}) {
  return (
    <div className="sr-only" aria-live="polite">
      {active
        ? lastMessage ?? "Announcements enabled"
        : "Announcements disabled"}
    </div>
  );
}
