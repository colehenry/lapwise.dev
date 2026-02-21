"use client";

import { type ReactNode, useCallback, useRef } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  tiltMax?: number;
}

export default function TiltCard({
  children,
  className = "",
  tiltMax = 6,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateY = ((x - centerX) / centerX) * tiltMax;
      const rotateX = ((centerY - y) / centerY) * tiltMax;

      cardRef.current.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      cardRef.current.style.transition = "none";
    },
    [tiltMax],
  );

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.transition = "transform 0.4s ease-out";
    cardRef.current.style.transform =
      "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Visual-only hover tilt effect, children handle interaction
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ willChange: "transform" }}
    >
      {children}
    </div>
  );
}
