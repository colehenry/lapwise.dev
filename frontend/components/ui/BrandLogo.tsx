import Image from "next/image";

/**
 * Both variants render always; `.brand-logo-dark`/`.brand-logo-light` in
 * globals.css toggle which one is `display`ed off the `data-theme` attribute
 * set on <html> before first paint, so this works in server components too.
 */
export function LapwiseWordmark({
  className = "h-5",
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src="/brand/lapwise-wordmark-dark.png"
        alt="Lapwise"
        width={2172}
        height={724}
        priority={priority}
        className="brand-logo-dark h-full w-auto"
      />
      <Image
        src="/brand/lapwise-wordmark-light.png"
        alt="Lapwise"
        width={2172}
        height={724}
        priority={priority}
        className="brand-logo-light h-full w-auto"
      />
    </span>
  );
}

/**
 * Clutch's helmet, painted in the current text colour: the SVG is a CSS mask
 * over `currentColor`, so one asset serves both themes and any tint.
 */
export function ClutchNavIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`clutch-mark inline-block shrink-0 text-ink-strong ${className}`}
    />
  );
}

export function LapwiseIcon({
  className = "h-8 w-8",
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <Image
        src="/brand/lapwise-icon-dark.png"
        alt="Lapwise"
        width={1254}
        height={1254}
        priority={priority}
        className="brand-logo-dark h-full w-full object-contain"
      />
      <Image
        src="/brand/lapwise-icon-light.png"
        alt="Lapwise"
        width={1254}
        height={1254}
        priority={priority}
        className="brand-logo-light h-full w-full object-contain"
      />
    </span>
  );
}
