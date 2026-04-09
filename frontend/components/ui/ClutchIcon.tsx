interface ClutchIconProps {
  className?: string;
  title?: string;
}

export default function ClutchIcon({
  className = "h-5 w-5",
  title,
}: ClutchIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {/* Top mounting bar */}
      <rect x="2" y="2" width="20" height="3" rx="0.6" />
      {/* Hanger rods */}
      <path d="M6 5 L5.2 9" />
      <path d="M12 5 L12 9" />
      <path d="M17.2 5 L17.9 9" />
      {/* Left pedal (clutch) — trapezoid */}
      <path d="M3.7 9 H6.7 L7.1 14 H3.3 Z" />
      <path d="M4.3 11.3 H6.5" />
      <path d="M4.1 12.6 H6.7" />
      {/* Middle pedal (brake) — trapezoid */}
      <path d="M10.5 9 H13.5 L13.8 14 H10.2 Z" />
      <path d="M10.9 11.3 H13.3" />
      <path d="M10.8 12.6 H13.4" />
      {/* Right pedal (accelerator) — tall narrow */}
      <path d="M16.4 9 H19.4 L19.9 20 H16.1 Z" />
      <path d="M16.8 11.2 H19.1" />
      <path d="M16.85 13 H19.2" />
      <path d="M16.9 14.8 H19.25" />
      <path d="M16.95 16.6 H19.3" />
      <path d="M17 18.4 H19.35" />
    </svg>
  );
}
