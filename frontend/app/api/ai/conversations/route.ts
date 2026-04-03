/**
 * AI Conversations List API Route
 *
 * GET /api/ai/conversations — list user's conversations
 */

import { type NextRequest, NextResponse } from "next/server";
import { verifyAIUser } from "@/lib/ai/auth";
import { getConversationClient } from "@/lib/ai/db";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const user = await verifyAIUser(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const sql = getConversationClient();
    const conversations = await sql`
      SELECT id, title, model_used, message_count, created_at, updated_at
      FROM ai_conversations
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC
      LIMIT 50
    `;

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Failed to list conversations:", error);
    return NextResponse.json(
      { error: "Failed to load conversations." },
      { status: 500 },
    );
  }
}
