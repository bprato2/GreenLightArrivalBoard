"use client";

const AMTRAK_STATIONS = [
  {
    code: "BOS",
    name: "Boston South Station",
    url: "https://www.amtrak.com/stations/bos",
  },
  {
    code: "BON",
    name: "Boston Back Bay",
    url: "https://www.amtrak.com/stations/bon",
  },
  {
    code: "BBY",
    name: "Boston North Station",
    url: "https://www.amtrak.com/stations/bby",
  },
  {
    code: "WOB",
    name: "Woburn",
    url: "https://www.amtrak.com/stations/wob",
  },
];

/** Informational Amtrak panel — no public official trip API. */
export function AmtrakPanel() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-8 text-amber-100">
      <h2 className="led-text text-xl tracking-[0.2em] text-amber-300">AMTRAK</h2>
      <p className="text-sm leading-relaxed text-zinc-400">
        Amtrak does not provide a public developer API for schedules or fares that
        is reliable enough for this board. Live Amtrak predictions and in-app ticket
        prices are not available here.
      </p>
      <p className="text-sm text-zinc-400">
        Use Amtrak&apos;s official site to search trains and buy tickets:
      </p>
      <a
        href="https://www.amtrak.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit rounded border border-amber-700/60 bg-amber-950/50 px-4 py-2 text-sm text-amber-200 hover:border-amber-500"
      >
        Open Amtrak.com trip search →
      </a>

      <div className="mt-2">
        <h3 className="mb-2 text-xs uppercase tracking-[0.2em] text-amber-600">
          Nearby Boston stations
        </h3>
        <ul className="flex flex-col gap-2">
          {AMTRAK_STATIONS.map((s) => (
            <li key={s.code}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2 text-sm hover:border-amber-800"
              >
                <span>
                  <span className="led-text text-amber-400">{s.code}</span>
                  <span className="ml-3 text-zinc-300">{s.name}</span>
                </span>
                <span className="text-amber-700">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
