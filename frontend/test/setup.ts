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

// jsdom implements none of these; the console reads all three on mount.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.IntersectionObserver ??=
    NoopObserver as unknown as typeof IntersectionObserver;
  globalThis.ResizeObserver ??=
    NoopObserver as unknown as typeof ResizeObserver;
}

afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
