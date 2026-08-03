// @vitest-environment jsdom
import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RoundContent from "@/app/results/[season]/[round]/RoundContent";
import {
  flushRequests,
  installFetchRecorder,
  renderWithQueryClient,
} from "./requestRecorder";

const SEASON = 2026;
const ROUND = 11;

vi.mock("next/navigation", () => ({
  useParams: () => ({ season: String(SEASON), round: String(ROUND) }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/session/SessionDetail", () => ({ default: () => null }));
vi.mock("@/app/results/[season]/[round]/RoundAnalysisCharts", () => ({
  default: () => null,
}));
vi.mock("@/components/comments/RaceComments", () => ({ default: () => null }));

const AVAILABILITY_PATH = `/api/results/${SEASON}/${ROUND}/availability`;
const RACE_PATH = `/api/results/${SEASON}/${ROUND}`;
const QUALIFYING_PATH = `/api/results/${SEASON}/${ROUND}/qualifying`;
const SPRINT_PATH = `/api/results/${SEASON}/${ROUND}/sprint`;
const PRACTICE_PATH = `/api/results/${SEASON}/${ROUND}/practice/`;
const SUMMARIES_PATH = `/api/results/${SEASON}/${ROUND}/summaries`;

const availability = {
  season: SEASON,
  round: ROUND,
  event_name: "Test Grand Prix",
  date: "2026-06-07",
  circuit_id: 1,
  circuit_name: "Test Circuit",
  session_types: ["fp1", "fp2", "fp3", "qualifying", "race"],
  practice_numbers: [1, 2, 3],
  has_sprint: false,
  summary_session_types: ["race"],
};

const session = {
  session: {
    id: 1,
    year: SEASON,
    round: ROUND,
    session_type: "race",
    event_name: "Test Grand Prix",
    date: "2026-06-07",
    circuit: { id: 1, name: "Test Circuit" },
  },
  results: [],
};

const ROUTES = {
  [AVAILABILITY_PATH]: availability,
  [SUMMARIES_PATH]: { summaries: [] },
  [QUALIFYING_PATH]: session,
  [SPRINT_PATH]: session,
  [PRACTICE_PATH]: session,
  [RACE_PATH]: session,
  "/api/results/seasons": [SEASON],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("race weekend initial load", () => {
  it("requests availability, the active session, summaries, and seasons only", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<RoundContent />);
    await flushRequests();

    expect([...new Set(recorder.paths())].sort()).toEqual(
      [
        AVAILABILITY_PATH,
        RACE_PATH,
        SUMMARIES_PATH,
        "/api/results/seasons",
      ].sort(),
    );
  });

  it("never probes qualifying, sprint, or practice sessions on mount", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<RoundContent />);
    await flushRequests();

    expect(recorder.countMatching(QUALIFYING_PATH)).toBe(0);
    expect(recorder.countMatching(SPRINT_PATH)).toBe(0);
    expect(recorder.countMatching(PRACTICE_PATH)).toBe(0);
  });

  it("loads a session when its tab is selected", async () => {
    const recorder = installFetchRecorder(ROUTES);
    const { findByRole } = renderWithQueryClient(<RoundContent />);
    await flushRequests();

    const practiceTab = await findByRole("button", { name: /practice/i });
    await act(async () => {
      fireEvent.click(practiceTab);
    });
    await flushRequests();

    expect(recorder.countMatching(`${PRACTICE_PATH}3`)).toBe(1);
  });

  it("prefetches a tab on hover without selecting it", async () => {
    const recorder = installFetchRecorder(ROUTES);
    const { findByRole } = renderWithQueryClient(<RoundContent />);
    await flushRequests();

    const practiceTab = await findByRole("button", { name: /practice/i });
    await act(async () => {
      fireEvent.pointerEnter(practiceTab);
    });
    await flushRequests();

    expect(recorder.countMatching(PRACTICE_PATH)).toBe(1);
  });
});
