import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import suggestions from "../lib/ai/suggested-questions.json" with {
  type: "json",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function readNdjson(response) {
  if (!response.body) {
    throw new Error("Response body was empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      events.push(JSON.parse(line));
    }

    if (done) {
      if (buffer.trim()) {
        events.push(JSON.parse(buffer));
      }
      break;
    }
  }

  return events;
}

function questionHash(question) {
  return crypto
    .createHash("md5")
    .update(question.toLowerCase().trim())
    .digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedQuestion(baseUrl, question) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/ai/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-seed-mode": "true",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Seed request failed for "${question}": ${response.status} ${body}`,
      );
    }

    const events = await readNdjson(response);
    const errorEvent = events.find((event) => event.type === "error");
    if (!errorEvent) {
      const metadataEvent = events.find((event) => event.type === "metadata");
      if (!metadataEvent) {
        throw new Error(
          `Seed request for "${question}" completed without metadata.`,
        );
      }

      return metadataEvent;
    }

    if (attempt === maxAttempts) {
      throw new Error(
        `Seed request errored for "${question}": ${errorEvent.error}`,
      );
    }

    console.warn(
      `  attempt ${attempt} failed for "${question}": ${errorEvent.error}. Retrying...`,
    );
    await sleep(1500 * attempt);
  }

  throw new Error(
    `Seed request failed for "${question}" after ${maxAttempts} attempts.`,
  );
}

async function main() {
  loadEnvFile(envPath);

  const baseUrl = process.env.AI_SEED_BASE_URL || "http://127.0.0.1:3000";
  const databaseUrl = process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("NEON_DATABASE_URL is required.");
  }

  const sql = neon(databaseUrl);
  const questions = suggestions.map((suggestion) => suggestion.question);

  for (const question of questions) {
    console.log(`Seeding: ${question}`);

    const metadataEvent = await seedQuestion(baseUrl, question);

    console.log(
      `  cached answer with ${metadataEvent.queries.length} SQL quer${metadataEvent.queries.length === 1 ? "y" : "ies"} and ${metadataEvent.followUps.length} follow-ups.`,
    );
  }

  const hashes = questions.map(questionHash);
  const rows = await sql`
    SELECT question_hash, cached_at
    FROM ai_response_cache
    WHERE question_hash = ANY(${hashes}::text[])
    ORDER BY cached_at DESC
  `;

  console.log(`Seeded ${rows.length} cached sample responses.`);

  if (rows.length !== questions.length) {
    throw new Error(
      `Expected ${questions.length} cache rows, found ${rows.length}.`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
