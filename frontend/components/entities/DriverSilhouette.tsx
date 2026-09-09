type DriverSilhouetteProps = {
  className?: string;
};

export default function DriverSilhouette({
  className = "",
}: DriverSilhouetteProps) {
  return (
    <div
      aria-hidden="true"
      className={`aspect-square overflow-hidden rounded-md border border-border-primary bg-bg-secondary text-text-muted/45 ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        role="presentation"
        className="h-full w-full translate-y-1"
      >
        <circle cx="32" cy="21" r="11" fill="currentColor" />
        <path
          d="M9 63c.8-14.4 9-23 23-23s22.2 8.6 23 23H9Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
