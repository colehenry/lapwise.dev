import { type NextRequest, NextResponse } from "next/server";
import { selectRaceCornerInsight } from "@/lib/ai/race-corner-insight";
import { loadRaceStrategyEvidence } from "@/lib/ai/race-strategy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawSessionId = request.nextUrl.searchParams.get("session_id");
  const sessionId = Number(rawSessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json(
      { error: "A positive session_id is required." },
      { status: 400 },
    );
  }

  try {
    const evidence = await loadRaceStrategyEvidence(sessionId);
    return NextResponse.json(
      { insight: selectRaceCornerInsight(evidence) },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Race insight is temporarily unavailable." },
      { status: 503 },
    );
  }
}
