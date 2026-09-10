import type React from "react";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "bordered" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

export default function Card({
  children,
  variant = "default",
  padding = "md",
  className = "",
  onClick,
}: CardProps) {
  const baseStyles = "rounded-sm overflow-hidden";

  const variantStyles = {
    default: "bg-surface-panel border border-line-soft",
    elevated: "bg-surface-panel shadow-lg",
    bordered: "bg-surface-band border-2 border-line-strong",
    interactive:
      "bg-surface-panel border border-line-soft hover:border-accent hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer",
  };

  const paddingStyles = {
    none: "p-0",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  if (onClick) {
    return (
      <button
        type="button"
        className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className} w-full text-left`}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
