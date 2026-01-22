import type React from "react";

interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: string;
  height?: string;
  className?: string;
}

export default function Skeleton({
  variant = "text",
  width = "100%",
  height,
  className = "",
}: SkeletonProps) {
  const variantStyles = {
    text: "rounded-md h-4",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const defaultHeight = {
    text: "h-4",
    circular: "h-12",
    rectangular: "h-32",
  };

  return (
    <div
      className={`bg-gradient-to-r from-bg-tertiary via-bg-elevated to-bg-tertiary bg-[length:200%_100%] animate-shimmer ${variantStyles[variant]} ${height ? "" : defaultHeight[variant]} ${className}`}
      style={{
        width,
        height: height || undefined,
      }}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
