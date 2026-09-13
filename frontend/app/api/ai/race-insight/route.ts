import { type NextRequest, NextResponse } from "next/server";
import { selectRaceCornerInsights } from "@/lib/ai/race-corner-insight";
import { loadRaceDynamics } from "@/lib/ai/race-dynamics";
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
    const [strategy, dynamics] = await Promise.all([
      loadRaceStrategyEvidence(sessionId),
      loadRaceDynamics(sessionId),
    ]);
    return NextResponse.json(
      { insights: selectRaceCornerInsights({ strategy, dynamics }) },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Race insight is temporarily unavailable." },
      { status: 503 },
    );
  }
}
