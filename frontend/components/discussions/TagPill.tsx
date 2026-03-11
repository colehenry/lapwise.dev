interface TagPillProps {
  label: string;
  color?: string | null;
  size?: "sm" | "md";
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

function tintColor(color: string, alphaHex: string) {
  return `${color}${alphaHex}`;
}

export default function TagPill({
  label,
  color,
  size = "sm",
  active = false,
  onClick,
  className = "",
}: TagPillProps) {
  const sizeStyles = {
    sm: "px-2.5 py-1 text-[10px]",
    md: "px-3 py-1 text-xs",
  };

  const baseClasses = `inline-flex items-center gap-1 rounded-full border font-mono tracking-wider uppercase transition-colors duration-150 ${sizeStyles[size]} ${className}`;

  const baseStyle = color
    ? {
        backgroundColor: tintColor(color, "1F"),
        color,
        borderColor: tintColor(color, "40"),
      }
    : undefined;

  const activeClasses = active
    ? color
      ? "ring-1 ring-purple-500/60"
      : "bg-purple-500/20 text-purple-200 border-purple-500/50"
    : "";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} ${activeClasses}`}
        style={baseStyle}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={`${baseClasses} ${activeClasses}`} style={baseStyle}>
      {label}
    </span>
  );
}
