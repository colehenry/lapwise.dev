"use client";

import { useCallback } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { resolveReadableAccentColor } from "@/lib/color-utils";
import { teamTint } from "@/lib/consoleFormat";

/**
 * A team colour that survives the ground it is drawn on.
 *
 * Team colour is data and is applied inline, but a white livery on a white
 * panel is not a colour, it is an absence. This is the same guard the rest of
 * the site's charts use, so the console reads consistently with them.
 */
export function useTeamTint(): (
  color: string | null | undefined,
) => string | undefined {
  const { theme } = useTheme();
  return useCallback(
    (color: string | null | undefined) =>
      resolveReadableAccentColor(teamTint(color), theme) ?? undefined,
    [theme],
  );
}
