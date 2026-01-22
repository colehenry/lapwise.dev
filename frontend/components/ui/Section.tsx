import type React from "react";
import Container from "./Container";

interface SectionProps {
  children: React.ReactNode;
  containerSize?: "sm" | "md" | "lg" | "xl" | "full";
  spacing?: "sm" | "md" | "lg" | "xl";
  background?: "primary" | "secondary" | "tertiary" | "gradient";
  className?: string;
}

export default function Section({
  children,
  containerSize = "lg",
  spacing = "lg",
  background = "primary",
  className = "",
}: SectionProps) {
  const spacingStyles = {
    sm: "py-8",
    md: "py-12",
    lg: "py-16",
    xl: "py-24",
  };

  const backgroundStyles = {
    primary: "bg-bg-primary",
    secondary: "bg-bg-secondary",
    tertiary: "bg-bg-tertiary",
    gradient: "bg-gradient-to-b from-bg-primary via-bg-secondary to-bg-primary",
  };

  return (
    <section
      className={`${spacingStyles[spacing]} ${backgroundStyles[background]} ${className}`}
    >
      <Container size={containerSize}>{children}</Container>
    </section>
  );
}
