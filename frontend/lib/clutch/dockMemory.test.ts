// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  clampDockWidth,
  DOCK_MIN_WIDTH,
  forgetThread,
  rememberDockWidth,
  rememberedDockWidth,
  rememberThread,
  threadFor,
  threadRoute,
} from "./dockMemory";

beforeEach(() => window.localStorage.clear());

describe("dock memory", () => {
  it("keeps one thread per page per reader, whatever the tab", () => {
    rememberThread(7, "/results/2025/1?tab=qualifying", {
      conversationId: "abc",
      title: "Australian GP",
    });
    expect(threadFor(7, "/results/2025/1")?.conversationId).toBe("abc");
    expect(threadFor(7, "/results/2025/1?tab=race")?.conversationId).toBe(
      "abc",
    );
    expect(threadFor(8, "/results/2025/1")).toBeNull();
    expect(threadFor(7, "/results/2025/2")).toBeNull();

    forgetThread(7, "/results/2025/1");
    expect(threadFor(7, "/results/2025/1")).toBeNull();
  });

  it("survives a broken store entry", () => {
    window.localStorage.setItem("lapwise-clutch-threads:7", "{not json");
    expect(threadFor(7, "/results/2025/1")).toBeNull();
    expect(threadRoute("/drivers/norris?x=1")).toBe("/drivers/norris");
  });

  it("remembers a width within the panel's bounds", () => {
    expect(rememberedDockWidth()).toBe(DOCK_MIN_WIDTH);
    rememberDockWidth(520);
    expect(rememberedDockWidth()).toBe(520);
    expect(clampDockWidth(100, 1400)).toBe(DOCK_MIN_WIDTH);
    expect(clampDockWidth(2000, 1400)).toBe(720);
    expect(clampDockWidth(2000, 1000)).toBe(600);
    expect(clampDockWidth(480.4, 1400)).toBe(480);
  });
});
