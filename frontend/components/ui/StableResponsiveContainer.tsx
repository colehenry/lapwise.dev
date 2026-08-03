"use client";

import { ResponsiveContainer, type ResponsiveContainerProps } from "recharts";

type StableResponsiveContainerProps = Omit<
  ResponsiveContainerProps,
  "initialDimension" | "width"
> & {
  initialHeight?: number;
  initialWidth?: number;
  width?: ResponsiveContainerProps["width"];
};

export default function StableResponsiveContainer({
  height,
  initialHeight,
  initialWidth = 860,
  width = "100%",
  ...props
}: StableResponsiveContainerProps) {
  return (
    <ResponsiveContainer
      {...props}
      width={width}
      height={height}
      initialDimension={{
        width: initialWidth,
        height: initialHeight ?? (typeof height === "number" ? height : 300),
      }}
    />
  );
}
