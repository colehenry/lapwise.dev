"use client";

import Image from "next/image";
import { isValidHeadshotUrl } from "@/lib/api";

type DriverHeadshotProps = {
  code?: string | null;
  fullName: string;
  size?: number;
  src?: string | null;
  className?: string;
};

const initials = (fullName: string) =>
  fullName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 3);

export default function DriverHeadshot({
  code,
  fullName,
  size = 40,
  src,
  className = "",
}: DriverHeadshotProps) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-sm border border-border-secondary bg-bg-secondary ${className}`}
      style={{ width: size, height: size }}
    >
      {isValidHeadshotUrl(src) ? (
        <Image
          src={src ?? ""}
          alt={fullName}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold font-mono text-text-muted">
          {code ?? initials(fullName)}
        </span>
      )}
    </div>
  );
}
