/**
 * AI Conversation Detail API Route
 *
 * GET    /api/ai/conversations/[id] — get full conversation with messages
 * PATCH  /api/ai/conversations/[id] — rename conversation
 * DELETE /api/ai/conversations/[id] — delete conversation
 */

import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAIUser } from "@/lib/ai/auth";
import { getConversationClient } from "@/lib/ai/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authHeader = request.headers.get("authorization");
  const user = await verifyAIUser(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const sql = getConversationClient();

    const convRows = await sql`
      SELECT id, title, model_used, message_count, created_at, updated_at
      FROM ai_conversations
      WHERE id = ${id}::uuid AND user_id = ${user.id}
    `;

    if (convRows.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    const messages = await sql`
      SELECT id, role, content, tool_calls, tool_results, tokens_used, model, created_at
      FROM ai_messages
      WHERE conversation_id = ${id}::uuid
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      conversation: convRows[0],
      messages,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Failed to load conversation." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authHeader = request.headers.get("authorization");
  const user = await verifyAIUser(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  try {
    const sql = getConversationClient();
    const title = body.title.trim().slice(0, 200);

    const result = await sql`
      UPDATE ai_conversations
      SET title = ${title}, updated_at = NOW()
      WHERE id = ${id}::uuid AND user_id = ${user.id}
      RETURNING id, title
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation: result[0] });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Failed to rename conversation." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authHeader = request.headers.get("authorization");
  const user = await verifyAIUser(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const sql = getConversationClient();

    const result = await sql`
      DELETE FROM ai_conversations
      WHERE id = ${id}::uuid AND user_id = ${user.id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Failed to delete conversation." },
      { status: 500 },
    );
  }
}
