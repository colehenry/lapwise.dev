/**
 * AI Cached Response API Route
 *
 * GET /api/ai/cached-response?q=<question>
 *
 * Returns a cached AI response for a given question (if available).
 * Used by the frontend to serve suggestion question responses instantly.
 */

import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAIUser } from "@/lib/ai/auth";
import { getConversationClient } from "@/lib/ai/db";
import type { ChartConfig } from "@/lib/chat";

function isMissingRelationError(error: unknown, relation: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  const message = "message" in error ? error.message : undefined;

  return (
    code === "42P01" &&
    typeof message === "string" &&
    message.includes(`relation "${relation}" does not exist`)
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const user = await verifyAIUser(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const question = request.nextUrl.searchParams.get("q");
  if (!question?.trim()) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 },
    );
  }

  const hash = crypto
    .createHash("md5")
    .update(question.toLowerCase().trim())
    .digest("hex");

  try {
    const sql = getConversationClient();
    const rows = await sql`
      SELECT response_text, charts_json, queries_json, follow_ups_json
      FROM ai_response_cache
      WHERE question_hash = ${hash}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not cached." }, { status: 404 });
    }

    const row = rows[0];
    return NextResponse.json({
      text: row.response_text as string,
      charts: (row.charts_json as ChartConfig[]) ?? [],
      queries: (row.queries_json as string[]) ?? [],
      followUps: (row.follow_ups_json as string[]) ?? [],
    });
  } catch (error) {
    if (isMissingRelationError(error, "ai_response_cache")) {
      return NextResponse.json({ error: "Not cached." }, { status: 404 });
    }

    return NextResponse.json({ error: "Cache unavailable." }, { status: 503 });
  }
}
