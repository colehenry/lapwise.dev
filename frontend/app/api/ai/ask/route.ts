/**
 * POST /api/ai/ask
 *
 * Owns HTTP, authentication, limits, and conversation setup. Analysis and
 * stream translation live behind dedicated orchestration boundaries.
 */

import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { analysisRequestSchema } from "@/lib/ai/analysis-contracts";
import { tryRunDeterministicAnalysis } from "@/lib/ai/analysis-engine";
import { verifyAIUser } from "@/lib/ai/auth";
import {
  createClutchPreflightResponse,
  withClutchCors,
} from "@/lib/ai/clutch-cors";
import {
  buildConversationTitle,
  checkUserQueryLimit,
  createConversation,
  loadConversationHistory,
  saveConversationMessage,
  verifyConversationOwnership,
} from "@/lib/ai/conversation-store";
import { createDeterministicAnalysisResponse } from "@/lib/ai/deterministic-response";
import { createLegacyAgentResponse } from "@/lib/ai/legacy-agent-response";
import { getAIModel } from "@/lib/ai/provider";
import { checkIpRateLimit, getClientIp } from "@/lib/ai/request-limits";
import {
  beginRequestLog,
  noopRequestLogWriter,
  type RequestLog,
  type RequestLogStage,
} from "@/lib/ai/request-log";
import { resolveClutchRequestRedirect } from "@/lib/clutch-endpoint";

export const maxDuration = 300;

const AI_TOTAL_QUERY_LIMIT = Number.parseInt(
  process.env.AI_TOTAL_QUERY_LIMIT || "3",
  10,
);
const SEED_MODE_HEADER = "x-ai-seed-mode";
const DUMMY_SEED_CONVERSATION_ID = "seed-suggested-question-cache";

interface RequestUser {
  id: number;
  role: string;
}

function isSeedModeRequest(request: NextRequest): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    request.headers.get(SEED_MODE_HEADER) === "true"
  );
}

async function authenticate(
  request: NextRequest,
  seedMode: boolean,
): Promise<RequestUser | null> {
  if (seedMode) return { id: 0, role: "admin" };
  return verifyAIUser(request.headers.get("authorization"));
}

function rejected(
  log: RequestLog,
  stage: RequestLogStage,
  body: Record<string, unknown>,
  init: ResponseInit & { status: number },
): NextResponse {
  void log.finish({ status: "rejected", stage, httpStatus: init.status });
  return NextResponse.json(body, init);
}

async function handlePost(request: NextRequest, log: RequestLog) {
  const seedMode = isSeedModeRequest(request);
  if (!seedMode) {
    const ipLimit = checkIpRateLimit(getClientIp(request));
    if (!ipLimit.allowed) {
      return rejected(
        log,
        "ip_limit",
        {
          error:
            "Too many AI requests. Please slow down and try again shortly.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfter) },
        },
      );
    }
  }

  const user = await authenticate(request, seedMode);
  if (!user) {
    return rejected(
      log,
      "auth",
      {
        error: "Authentication required. Please log in to use the AI analyst.",
      },
      { status: 401 },
    );
  }
  log.userId = seedMode ? null : user.id;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return rejected(
      log,
      "body",
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsedBody = analysisRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return rejected(
      log,
      "body",
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const { question, pageContext } = parsedBody.data;
  log.question = question;
  log.pageContext = pageContext ?? null;

  const rateLimit = seedMode
    ? { allowed: true, remaining: null }
    : await checkUserQueryLimit(user.id, user.role, AI_TOTAL_QUERY_LIMIT);
  if (!rateLimit.allowed) {
    return rejected(
      log,
      "user_limit",
      {
        error: `Total query limit reached (${AI_TOTAL_QUERY_LIMIT} total).`,
        remaining: 0,
      },
      { status: 429 },
    );
  }

  let conversationId = parsedBody.data.conversationId ?? "";
  if (seedMode) {
    conversationId = DUMMY_SEED_CONVERSATION_ID;
  } else if (
    conversationId &&
    !(await verifyConversationOwnership(conversationId, user.id))
  ) {
    return rejected(
      log,
      "ownership",
      { error: "Conversation not found." },
      { status: 404 },
    );
  }
  log.conversationId = seedMode ? null : conversationId || null;

  try {
    const deterministicAnalysis = await tryRunDeterministicAnalysis(
      question,
      pageContext,
    );
    const analysisModel = deterministicAnalysis ? null : getAIModel("analysis");

    if (!conversationId) {
      conversationId = await createConversation(
        user.id,
        buildConversationTitle(question),
        deterministicAnalysis?.model ?? analysisModel?.modelId ?? "unknown",
      );
      log.conversationId = conversationId;
      /* A thread handed off from a Clutch corner starts with what the corner
         already answered, so the transcript and the model share one history. */
      if (!seedMode) {
        for (const turn of pageContext?.surface?.asked ?? []) {
          await saveConversationMessage(conversationId, "user", turn.question);
          await saveConversationMessage(
            conversationId,
            "assistant",
            turn.answer,
            {
              model: "clutch-corner",
            },
          );
        }
      }
    }

    const history =
      seedMode || deterministicAnalysis
        ? []
        : await loadConversationHistory(conversationId);
    if (!seedMode) {
      await saveConversationMessage(conversationId, "user", question);
    }

    if (deterministicAnalysis) {
      return createDeterministicAnalysisResponse({
        analysis: deterministicAnalysis,
        conversationId,
        question,
        remaining: rateLimit.remaining,
        seedMode,
        log,
      });
    }
    if (!analysisModel) throw new Error("No analysis model is configured");

    return createLegacyAgentResponse({
      question,
      conversationId,
      remaining: rateLimit.remaining,
      seedMode,
      messages: [...history, { role: "user" as const, content: question }],
      model: analysisModel,
      abortSignal: request.signal,
      pageContext,
      log,
    });
  } catch (error) {
    Sentry.captureException(error);
    void log.finish({
      status: "error",
      stage: "planning",
      httpStatus: 500,
      error,
    });
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `AI processing failed: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const redirect = resolveClutchRequestRedirect(
    process.env.NEXT_PUBLIC_CLUTCH_API_URL,
    request.url,
  );
  if (redirect) {
    return NextResponse.redirect(redirect, 307);
  }
  const log = beginRequestLog(
    request,
    getClientIp(request),
    isSeedModeRequest(request) ? { write: noopRequestLogWriter } : {},
  );
  let response: Response;
  try {
    response = await handlePost(request, log);
  } catch (error) {
    Sentry.captureException(error);
    void log.finish({
      status: "error",
      stage: "unknown",
      httpStatus: 503,
      error,
    });
    response = NextResponse.json(
      { error: "Clutch is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  return withClutchCors(request, response);
}

export function OPTIONS(request: NextRequest) {
  return createClutchPreflightResponse(request);
}
