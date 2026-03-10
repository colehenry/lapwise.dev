"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

function DotGridPattern({ id = "track-dot-grid" }: { id?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
      aria-hidden="true"
    >
      <title>Dot grid pattern</title>
      <defs>
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle
            cx="1"
            cy="1"
            r="0.8"
            fill="currentColor"
            className="text-purple-400"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

interface InteractiveTrackMapProps {
  circuitId: number;
  circuitName: string;
  trackLengthKm?: number | null;
  location?: string;
}

export default function InteractiveTrackMap({
  circuitId,
  circuitName,
  trackLengthKm,
  location,
}: InteractiveTrackMapProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((prev) => {
      const next = Math.min(Math.max(prev + delta, 1), 3);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      posStart.current = { ...position };
    },
    [scale, position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy,
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const isZoomed = scale > 1;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Interactive zoom/pan canvas for track map
    <div
      ref={containerRef}
      className="bg-bg-tertiary rounded-sm border border-border-primary relative overflow-hidden min-h-[350px] md:min-h-[400px] group"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(160, 32, 240, 0.08) 0%, rgba(160, 32, 240, 0.02) 50%, transparent 80%)",
        cursor: isZoomed ? (isDragging ? "grabbing" : "grab") : "zoom-in",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <DotGridPattern id={`circuit-detail-dots-${circuitId}`} />

      {/* Callout labels */}
      {trackLengthKm && (
        <div className="absolute top-4 left-5 z-20 flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold tracking-widest text-purple-400/80 uppercase">
            {trackLengthKm.toFixed(3)} km
          </span>
          <div className="h-px w-6 bg-purple-500/30" />
        </div>
      )}

      {location && (
        <div className="absolute bottom-4 right-5 z-20 flex items-center gap-1.5">
          <div className="h-px w-6 bg-purple-500/30" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-purple-400/80 uppercase">
            {location}
          </span>
        </div>
      )}

      {/* S/F marker */}
      <div className="absolute top-4 right-5 z-20">
        <span className="text-[8px] font-mono font-bold tracking-widest text-text-muted/50 border border-border-secondary/50 px-1.5 py-0.5 rounded-sm">
          S/F
        </span>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-5 z-20 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setScale((prev) => Math.min(prev + 0.5, 3));
          }}
          className="w-7 h-7 flex items-center justify-center bg-bg-primary/80 border border-border-primary rounded-sm text-text-muted hover:text-purple-300 hover:border-purple-500 transition-colors text-sm font-mono"
        >
          +
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const next = Math.max(scale - 0.5, 1);
            setScale(next);
            if (next === 1) setPosition({ x: 0, y: 0 });
          }}
          className="w-7 h-7 flex items-center justify-center bg-bg-primary/80 border border-border-primary rounded-sm text-text-muted hover:text-purple-300 hover:border-purple-500 transition-colors text-sm font-mono"
        >
          -
        </button>
        {isZoomed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            className="h-7 px-2 flex items-center justify-center bg-bg-primary/80 border border-border-primary rounded-sm text-text-muted hover:text-purple-300 hover:border-purple-500 transition-colors text-[10px] font-mono uppercase tracking-widest"
          >
            Reset
          </button>
        )}
      </div>

      {/* Zoom indicator */}
      {isZoomed && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <span className="text-[10px] font-mono font-bold text-purple-400/60 tracking-widest uppercase">
            {Math.round(scale * 100)}%
          </span>
        </div>
      )}

      {/* Track image */}
      <div
        className="w-full h-[350px] md:h-[400px] flex items-center justify-center p-8"
        style={{
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
      >
        <Image
          src={`/track-maps/${circuitId}.png`}
          alt={`${circuitName} track map`}
          fill
          className="object-contain p-8 relative z-10"
          draggable={false}
          style={{
            filter:
              "drop-shadow(0 0 12px rgba(160, 32, 240, 0.35)) drop-shadow(0 0 30px rgba(160, 32, 240, 0.12))",
          }}
        />
      </div>
    </div>
  );
}
