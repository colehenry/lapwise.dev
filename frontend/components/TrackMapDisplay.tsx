"use client";

import TrackMapImage from "@/components/TrackMapImage";

/** Subtle dot grid SVG pattern */
function DotGridPattern({ id = "dot-grid" }: { id?: string }) {
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

interface TrackMapCompactProps {
  circuitId: number;
  circuitName: string;
  patternId: string;
}

/** Compact track map for season results cards — gradient glow + dot grid, no callouts */
export function TrackMapCompact({
  circuitId,
  circuitName,
  patternId,
}: TrackMapCompactProps) {
  return (
    <div
      className="pointer-events-none absolute right-2 top-2 z-0 flex h-20 w-32 items-center justify-center overflow-hidden rounded-sm opacity-65 md:pointer-events-auto md:static md:relative md:flex-shrink-0 md:w-44 md:h-24 md:opacity-100"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(160, 32, 240, 0.12) 0%, rgba(160, 32, 240, 0.04) 50%, transparent 80%)",
      }}
    >
      <DotGridPattern id={patternId} />
      <TrackMapImage
        circuitId={circuitId}
        circuitName={circuitName}
        width={160}
        height={88}
        className="object-contain w-full h-full relative z-10 opacity-90"
        fallbackClassName="relative z-10 h-full w-full px-3"
        style={{
          filter:
            "drop-shadow(0 0 8px rgba(160, 32, 240, 0.35)) drop-shadow(0 0 20px rgba(160, 32, 240, 0.15))",
        }}
      />
    </div>
  );
}

interface TrackMapFullProps {
  circuitId: number;
  circuitName: string;
  location?: string;
  trackLengthKm?: number | null;
}

/** Full track map with callouts for SessionDetail header — gradient glow + stats labels */
export function TrackMapFull({
  circuitId,
  circuitName,
  location,
  trackLengthKm,
}: TrackMapFullProps) {
  return (
    <div
      className="w-full md:w-72 border-t md:border-t-0 md:border-l border-border-primary relative flex items-center justify-center overflow-hidden min-h-[180px]"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(160, 32, 240, 0.10) 0%, rgba(160, 32, 240, 0.03) 50%, rgba(10, 10, 15, 0.8) 100%)",
      }}
    >
      <DotGridPattern id="session-track-dots" />

      {/* Callout labels */}
      {trackLengthKm && (
        <div className="absolute top-3 left-4 z-20 flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold tracking-widest text-purple-400/80 uppercase">
            {trackLengthKm.toFixed(3)} km
          </span>
          <div className="h-px w-6 bg-purple-500/30" />
        </div>
      )}

      {location && (
        <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5">
          <div className="h-px w-6 bg-purple-500/30" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-purple-400/80 uppercase">
            {location}
          </span>
        </div>
      )}

      {/* S/F marker — positioned top-right area */}
      <div className="absolute top-3 right-4 z-20">
        <span className="text-[8px] font-mono font-bold tracking-widest text-text-muted/50 border border-border-secondary/50 px-1.5 py-0.5 rounded-sm">
          S/F
        </span>
      </div>

      {/* Track image with glow */}
      {circuitId && (
        <TrackMapImage
          circuitId={circuitId}
          circuitName={circuitName}
          width={240}
          height={150}
          className="object-contain relative z-10 opacity-90 p-4"
          fallbackClassName="relative z-10 h-full w-full px-4"
          style={{
            filter:
              "drop-shadow(0 0 10px rgba(160, 32, 240, 0.4)) drop-shadow(0 0 25px rgba(160, 32, 240, 0.15))",
          }}
        />
      )}
    </div>
  );
}
