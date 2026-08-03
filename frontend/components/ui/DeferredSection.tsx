"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type DeferredSectionProps = {
  children: ReactNode;
  /** Reserved height before the section mounts, so nothing shifts. */
  minHeight?: number;
  /** How far outside the viewport to start loading. */
  rootMargin?: string;
  /** Renders instead of the reserved space while the section is idle. */
  placeholder?: ReactNode;
  className?: string;
  /** Mounts immediately, for sections already known to be in view. */
  eager?: boolean;
};

/**
 * Mounts its children the first time the section approaches the viewport, and
 * keeps them mounted afterwards so scrolling away does not discard state or
 * refetch. Sections below the fold therefore cost nothing — no request, no
 * chart code, no main-thread work — until the reader heads toward them.
 */
export default function DeferredSection({
  children,
  minHeight = 320,
  rootMargin = "300px",
  placeholder,
  className,
  eager = false,
}: DeferredSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (visible) return;
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={visible ? undefined : { minHeight }}
    >
      {visible ? children : placeholder}
    </div>
  );
}
