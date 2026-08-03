"use client";

import Image, { type ImageProps } from "next/image";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getStaticTrackMapUrl, hasStaticTrackMap } from "@/lib/trackMapAssets";

type TrackMapImageProps = Omit<ImageProps, "src" | "alt"> & {
  circuitId: number | null | undefined;
  circuitName: string;
  fallbackClassName?: string;
};

export default function TrackMapImage({
  circuitId,
  circuitName,
  fallbackClassName = "",
  ...imageProps
}: TrackMapImageProps) {
  const { theme } = useTheme();

  if (typeof circuitId !== "number" || !hasStaticTrackMap(circuitId)) {
    const fallback = (
      <div
        className={`flex items-center justify-center text-center text-[10px] font-mono uppercase tracking-widest text-text-muted ${fallbackClassName}`}
      >
        No map available
      </div>
    );

    return imageProps.fill ? (
      <div className="absolute inset-0">{fallback}</div>
    ) : (
      fallback
    );
  }

  const mergedFilter =
    theme === "light"
      ? ["invert(1)", imageProps.style?.filter].filter(Boolean).join(" ")
      : imageProps.style?.filter;

  return (
    <Image
      {...imageProps}
      src={getStaticTrackMapUrl(circuitId)}
      alt={`${circuitName} track map`}
      style={{
        ...imageProps.style,
        filter: mergedFilter,
      }}
    />
  );
}
