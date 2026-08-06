"use client";

import Image from "next/image";
import { isValidHeadshotUrl } from "@/lib/api";

type DriverHeadshotProps = {
  code?: string | null;
  fullName: string;
  size?: number;
  src?: string | null;
  className?: string;
  responsive?: boolean;
  focalX?: number | null;
  focalY?: number | null;
};

// Faces occupy a small part of the frame, so the default quality of 75 shows
// visible artefacts at these sizes.
const HEADSHOT_QUALITY = 88;

// Framing reviewed in the media tool, which previewed against these same CSS
// rules. Any other crop maths shifts every face.
const DEFAULT_FOCAL_X = 0.5;
const DEFAULT_FOCAL_Y = 0.4;

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
  responsive = false,
  focalX,
  focalY,
}: DriverHeadshotProps) {
  const objectPosition = `${((focalX ?? DEFAULT_FOCAL_X) * 100).toFixed(1)}% ${(
    (focalY ?? DEFAULT_FOCAL_Y) * 100
  ).toFixed(1)}%`;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-sm border border-border-secondary bg-bg-secondary ${className}`}
      style={responsive ? undefined : { width: size, height: size }}
    >
      {isValidHeadshotUrl(src) ? (
        <Image
          src={src ?? ""}
          alt={fullName}
          fill
          // Declared sizes drive which rendition the CDN generates. These must
          // cover the largest rendered box, or high-DPR screens upscale.
          sizes={
            responsive ? "(max-width: 640px) 128px, 192px" : `${size * 2}px`
          }
          quality={HEADSHOT_QUALITY}
          className="object-cover"
          style={{ objectPosition }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold font-mono text-text-muted">
          {code ?? initials(fullName)}
        </span>
      )}
    </div>
  );
}
