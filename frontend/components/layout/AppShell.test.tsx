// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/providers/QueryProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./Navigation", () => ({ default: () => <nav>Navigation</nav> }));
vi.mock("./Footer", () => ({ default: () => <footer>Footer</footer> }));
vi.mock("./ScrollbarHandler", () => ({ default: () => null }));
vi.mock("@/components/favorites/FavoritesPrompt", () => ({
  default: () => null,
}));

beforeEach(() => {
  navigation.pathname = "/";
});

describe("AppShell", () => {
  it("keeps the footer outside the full-height chat workspace", () => {
    navigation.pathname = "/ask";

    render(
      <AppShell>
        <div>Chat workspace</div>
      </AppShell>,
    );

    expect(screen.getByText("Chat workspace")).toBeTruthy();
    expect(screen.queryByText("Footer")).toBeNull();
  });

  it("renders the footer on regular pages", () => {
    render(
      <AppShell>
        <div>Page</div>
      </AppShell>,
    );

    expect(screen.getByText("Footer")).toBeTruthy();
  });
});
