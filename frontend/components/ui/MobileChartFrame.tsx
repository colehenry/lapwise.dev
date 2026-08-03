"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface MobileChartFrameProps {
  children: ReactNode;
  height: number;
  logicalWidth?: number;
  className?: string;
}

export default function MobileChartFrame({
  children,
  height,
  logicalWidth = 860,
  className = "",
}: MobileChartFrameProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      setContainerWidth(el.clientWidth);
      setIsMobile(window.innerWidth < 768);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scale =
    isMobile && containerWidth > 0
      ? Math.min(1, containerWidth / logicalWidth)
      : 1;
  const scaledHeight = Math.ceil(height * scale);

  return (
    <div
      ref={outerRef}
      className={`mobile-chart-frame min-w-0 ${className}`}
      style={{ height: isMobile ? scaledHeight : height }}
    >
      <div
        className="mobile-chart-frame__inner"
        style={{
          width: isMobile ? logicalWidth : "100%",
          height,
          transform: isMobile ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        {containerWidth > 0 ? children : null}
      </div>
    </div>
  );
}
