// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeferredSection from "@/components/ui/DeferredSection";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

const observers: { callback: ObserverCallback; disconnect: () => void }[] = [];

class TestIntersectionObserver {
  callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    observers.push({ callback, disconnect: () => {} });
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function intersect() {
  for (const observer of observers) {
    observer.callback([{ isIntersecting: true }]);
  }
}

describe("DeferredSection", () => {
  it("holds space and renders nothing until the section is approached", () => {
    const { container } = render(
      <DeferredSection minHeight={240}>
        <p>analysis</p>
      </DeferredSection>,
    );

    expect(screen.queryByText("analysis")).toBeNull();
    expect((container.firstChild as HTMLElement).style.minHeight).toBe("240px");
  });

  it("renders a placeholder while idle when one is given", () => {
    render(
      <DeferredSection placeholder={<p>loading</p>}>
        <p>analysis</p>
      </DeferredSection>,
    );

    expect(screen.getByText("loading")).toBeTruthy();
  });

  it("mounts children once the section intersects and releases the reserve", () => {
    const { container } = render(
      <DeferredSection minHeight={240}>
        <p>analysis</p>
      </DeferredSection>,
    );

    act(() => {
      intersect();
    });

    expect(screen.getByText("analysis")).toBeTruthy();
    expect((container.firstChild as HTMLElement).style.minHeight).toBe("");
  });

  it("mounts immediately when eager", () => {
    render(
      <DeferredSection eager>
        <p>analysis</p>
      </DeferredSection>,
    );

    expect(screen.getByText("analysis")).toBeTruthy();
  });

  it("mounts immediately where IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    render(
      <DeferredSection>
        <p>analysis</p>
      </DeferredSection>,
    );

    expect(screen.getByText("analysis")).toBeTruthy();
  });
});
