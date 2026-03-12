import type React from "react";

interface MonoLabelProps {
  children: React.ReactNode;
  as?: "span" | "div" | "label";
  className?: string;
  htmlFor?: string;
}

export default function MonoLabel({
  children,
  as: Tag = "span",
  className = "",
  htmlFor,
}: MonoLabelProps) {
  return (
    <Tag
      className={`text-[10px] font-mono uppercase tracking-widest text-text-muted ${className}`}
      {...(Tag === "label" && htmlFor ? { htmlFor } : {})}
    >
      {children}
    </Tag>
  );
}
