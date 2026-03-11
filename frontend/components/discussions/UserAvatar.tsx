interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function UserAvatar({
  username,
  avatarUrl,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const sizeStyles = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  };

  return (
    <div
      className={`rounded-sm border border-border-primary bg-bg-secondary overflow-hidden flex items-center justify-center font-mono text-text-muted ${sizeStyles[size]} ${className}`}
      aria-label={username}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{getInitials(username)}</span>
      )}
    </div>
  );
}
