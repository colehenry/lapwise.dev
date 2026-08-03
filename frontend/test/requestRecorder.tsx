import { encode } from "@msgpack/msgpack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

/** One recorded outbound request, normalized to a path + query string. */
export type RecordedRequest = {
  path: string;
  method: string;
};

export type RouteResponder = (path: string) => unknown;

export type FetchRecorder = {
  requests: RecordedRequest[];
  /** Request paths in call order, including duplicates. */
  paths(): string[];
  /** Number of requests whose path starts with the given prefix. */
  countMatching(prefix: string): number;
};

/** Marks a fixture value that must be returned as a binary body. */
export class BinaryBody {
  constructor(readonly bytes: Uint8Array) {}
}

/** A client seeded the way a server-prefetched page hydrates one. */
export function hydratedQueryClient(
  entries: { queryKey: readonly unknown[]; data: unknown }[],
): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  for (const entry of entries) {
    client.setQueryData(entry.queryKey, entry.data);
  }
  return client;
}

export function msgpackBody(value: unknown): BinaryBody {
  return new BinaryBody(encode(value));
}

/**
 * Replaces global fetch with a recorder that answers from `routes`.
 *
 * Keys are matched as prefixes against the request path, longest first, so
 * `/api/results/2026/standings` wins over `/api/results/2026`.
 */
export function installFetchRecorder(
  routes: Record<string, unknown>,
): FetchRecorder {
  const requests: RecordedRequest[] = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === "string" ? input : input.toString();
      const url = new URL(raw, "http://localhost");
      const path = `${url.pathname}${url.search}`;
      requests.push({ path, method: init?.method ?? "GET" });

      const key = keys.find((candidate) => path.startsWith(candidate));
      const body = key === undefined ? null : routes[key];
      if (body === null) {
        return new Response("null", {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      if (body instanceof BinaryBody) {
        return new Response(body.bytes.slice().buffer, {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );

  return {
    requests,
    paths: () => requests.map((request) => request.path),
    countMatching: (prefix) =>
      requests.filter((request) => request.path.startsWith(prefix)).length,
  };
}

export function renderWithQueryClient(
  ui: ReactElement,
  existing?: QueryClient,
) {
  const client =
    existing ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
      },
    });
  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...result, client };
}

/** Lets pending query fetches and their state updates settle. */
export async function flushRequests(iterations = 4): Promise<void> {
  const { act } = await import("@testing-library/react");
  for (let index = 0; index < iterations; index++) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}
