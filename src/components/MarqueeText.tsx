"use client";

import { useEffect, useRef, useState } from "react";

interface MarqueeTextProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Continuous horizontal marquee for text that exceeds its container —
 * matches MBTA station countdown signs that scroll long destination names.
 */
export function MarqueeText({ children, className = "", style }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [duration, setDuration] = useState(12);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => {
      const containerWidth = container.clientWidth;
      const textWidth = measure.scrollWidth;
      const needsScroll = textWidth > containerWidth + 2;
      setOverflows(needsScroll);
      if (needsScroll) {
        // ~40px/s feels close to real MBTA signs
        setDuration(Math.max(8, (textWidth + containerWidth) / 40));
      }
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children]);

  if (!overflows) {
    return (
      <div ref={containerRef} className={`marquee-container overflow-hidden ${className}`} style={style}>
        <span ref={measureRef} className="marquee-static whitespace-nowrap">
          {children}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`marquee-container overflow-hidden ${className}`} style={style}>
      <span ref={measureRef} className="sr-only whitespace-nowrap" aria-hidden>
        {children}
      </span>
      <div
        className="marquee-track flex w-max whitespace-nowrap"
        style={{ animationDuration: `${duration}s` }}
      >
        <span className="marquee-segment pr-12">{children}</span>
        <span className="marquee-segment pr-12" aria-hidden>
          {children}
        </span>
      </div>
    </div>
  );
}
