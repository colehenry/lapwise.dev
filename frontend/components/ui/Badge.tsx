import type React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "purple" | "red" | "success" | "warning" | "info" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Badge({
  children,
  variant = "purple",
  size = "md",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    purple: "bg-accent/10 text-accent-light border border-accent/20",
    red: "bg-danger/10 text-danger-bright border border-danger/20",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    info: "bg-info/10 text-info border border-info/20",
    neutral: "bg-surface-raised text-ink-soft border border-line-soft",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}
