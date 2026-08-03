import { afterEach } from "vitest";

// jsdom has no 2D canvas; chart code already handles a null context.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as HTMLCanvasElement["getContext"];
}

// jsdom has no layout, so scroll calls are no-ops rather than errors.
if (typeof window !== "undefined") {
  window.scrollTo = () => {};
}

afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
