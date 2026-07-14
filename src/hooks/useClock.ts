"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/format";

/** 1 Hz Eastern clock for the board header. */
export function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return { now, ...formatClock(now) };
}
