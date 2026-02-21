export function GridPattern({ id = "grid-pattern" }: { id?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-10 pointer-events-none"
      aria-hidden="true"
    >
      <title>Grid pattern</title>
      <defs>
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function ConcentricPattern({
  id = "concentric-pattern",
}: {
  id?: string;
}) {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-10 pointer-events-none"
      viewBox="0 0 180 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <title>Concentric circles pattern</title>
      <defs>
        <pattern id={id} width="180" height="100" patternUnits="userSpaceOnUse">
          <circle
            cx="90"
            cy="50"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
          <circle
            cx="90"
            cy="50"
            r="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
          <circle
            cx="90"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
          <line
            x1="0"
            y1="50"
            x2="180"
            y2="50"
            stroke="currentColor"
            strokeWidth="0.3"
          />
          <line
            x1="90"
            y1="0"
            x2="90"
            y2="100"
            stroke="currentColor"
            strokeWidth="0.3"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function TrianglePattern({ id = "triangle-pattern" }: { id?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-8 pointer-events-none"
      aria-hidden="true"
    >
      <title>Triangle pattern</title>
      <defs>
        <pattern
          id={id}
          width="20"
          height="17.32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 17.32 L10 0 L20 17.32 Z M10 17.32 L20 0 L30 17.32 Z M-10 17.32 L0 0 L10 17.32 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
