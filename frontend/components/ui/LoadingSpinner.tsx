import type React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "purple" | "red" | "white";
  text?: string;
  fullPage?: boolean;
}

export default function LoadingSpinner({
  size = "md",
  color = "purple",
  text,
  fullPage = false,
}: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
    xl: "h-16 w-16 border-4",
  };

  const colorStyles = {
    purple: "border-purple-500 border-t-transparent",
    red: "border-red-500 border-t-transparent",
    white: "border-white border-t-transparent",
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`animate-spin rounded-full ${sizeStyles[size]} ${colorStyles[color]}`}
      >
        <span className="sr-only">Loading...</span>
      </div>
      {text && <p className="text-text-tertiary text-sm">{text}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/90 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
}
