/**
 * Mount boundary for announcement side-effects and unlock UX.
 * Logic lives in `useAnnouncements`; this component keeps the board tree explicit
 * and shows a tap prompt on mobile when autoplay is blocked.
 */
export function AnnouncementManager({
  active,
  needsGesture = false,
  onEnable,
  lastMessage,
}: {
  active: boolean;
  needsGesture?: boolean;
  onEnable?: () => void | Promise<void>;
  lastMessage?: string;
}) {
  return (
    <>
      <div className="sr-only" aria-live="polite">
        {active
          ? lastMessage ?? "Announcements enabled"
          : "Announcements disabled"}
      </div>
      {active && needsGesture && (
        <div
          className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
          role="status"
        >
          <button
            type="button"
            className="led-text max-w-md rounded border border-amber-700/50 bg-black/90 px-4 py-3 text-center text-[0.7rem] uppercase tracking-[0.18em] text-amber-400/95 shadow-[0_0_18px_rgba(255,176,0,0.15)] active:bg-amber-950/80"
            onClick={(e) => {
              e.stopPropagation();
              void onEnable?.();
            }}
          >
            Tap here to enable announcement sound
          </button>
        </div>
      )}
    </>
  );
}
