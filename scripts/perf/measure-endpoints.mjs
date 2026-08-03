#!/usr/bin/env node
/**
 * Read-only latency and payload measurement for the public API.
 *
 * Only issues GET requests. Reports median and slowest of N runs per endpoint
 * so a single sample is never used as a pass/fail threshold.
 *
 * Usage:
 *   node scripts/perf/measure-endpoints.mjs --base https://api.lapwise.dev
 *   node scripts/perf/measure-endpoints.mjs --runs 5 --json perf.json
 *   node scripts/perf/measure-endpoints.mjs --only standings,drivers-list
 *
 * API key is read from PERF_API_KEY, LAPWISE_API_KEY, or NEXT_PUBLIC_API_KEY.
 */

import { writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

const args = process.argv.slice(2);

function flag(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

const BASE = (
  flag("base", process.env.PERF_API_BASE ?? "https://api.lapwise.dev") ?? ""
).replace(/\/$/, "");
const RUNS = Number(flag("runs", "3"));
const SEASON = Number(flag("season", String(new Date().getFullYear())));
const ROUND = Number(flag("round", "1"));
const DRIVER = flag("driver", "VER");
const CONSTRUCTOR = flag("constructor", "Ferrari");
const CIRCUIT = Number(flag("circuit", "1"));
const ONLY = flag("only", "");
const JSON_OUT = flag("json", "");
const API_KEY =
  process.env.PERF_API_KEY ??
  process.env.LAPWISE_API_KEY ??
  process.env.NEXT_PUBLIC_API_KEY ??
  "";

const team = encodeURIComponent(CONSTRUCTOR);

const ENDPOINTS = [
  { name: "health", path: "/health" },
  { name: "seasons", path: "/api/results/seasons" },
  { name: "latest-round", path: "/api/results/latest" },
  { name: "standings", path: `/api/results/${SEASON}/standings` },
  { name: "season-rounds", path: `/api/results/${SEASON}` },
  { name: "qualifying-rounds", path: `/api/results/${SEASON}/qualifying` },
  { name: "race-results", path: `/api/results/${SEASON}/${ROUND}` },
  { name: "race-lap-times", path: `/api/results/${SEASON}/${ROUND}/lap-times` },
  {
    name: "qualifying-results",
    path: `/api/results/${SEASON}/${ROUND}/qualifying`,
  },
  { name: "drivers-list", path: "/api/drivers/" },
  { name: "driver-profile", path: `/api/drivers/${DRIVER}` },
  {
    name: "driver-season-history",
    path: `/api/drivers/${DRIVER}/season-history`,
  },
  { name: "constructors-list", path: "/api/constructors/" },
  { name: "constructor-profile", path: `/api/constructors/${team}` },
  {
    name: "constructor-season-history",
    path: `/api/constructors/${team}/season-history`,
  },
  { name: "circuits-list", path: "/api/circuits/" },
  { name: "circuit-profile", path: `/api/circuits/${CIRCUIT}` },
  { name: "circuit-statistics", path: `/api/circuits/${CIRCUIT}/statistics` },
  { name: "replay-seasons", path: "/api/replay/seasons" },
  { name: "replay-available", path: `/api/replay/available?season=${SEASON}` },
];

// The replay blob is multi-megabyte; measure it only when asked.
if (args.includes("--include-replay")) {
  ENDPOINTS.push({
    name: "replay-blob",
    path: `/api/replay/${SEASON}/${ROUND}`,
  });
}

const selected = ONLY
  ? ENDPOINTS.filter((e) => ONLY.split(",").includes(e.name))
  : ENDPOINTS;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function kib(bytes) {
  return bytes === null ? "-" : (bytes / 1024).toFixed(1);
}

function decodedLength(raw, encoding) {
  try {
    if (encoding === "gzip") return gunzipSync(raw).length;
    if (encoding === "br") return brotliDecompressSync(raw).length;
    if (encoding === "deflate") return inflateSync(raw).length;
  } catch {
    return raw.length;
  }
  return raw.length;
}

/**
 * Uses node:http(s) rather than fetch so the compressed wire size is observed
 * directly instead of being hidden by transparent decompression.
 */
function sample(path) {
  const url = new URL(`${BASE}${path}`);
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = { "accept-encoding": "gzip, br" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  return new Promise((resolve, reject) => {
    const started = performance.now();
    const req = send(url, { headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        const encoding = res.headers["content-encoding"] ?? "identity";
        resolve({
          status: res.statusCode,
          ms: performance.now() - started,
          wire: raw.length,
          decoded: decodedLength(raw, encoding),
          encoding,
          cacheControl: res.headers["cache-control"] ?? "-",
          age: res.headers.age ?? "-",
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function measure(endpoint) {
  const samples = [];
  for (let run = 0; run < RUNS; run++) {
    samples.push(await sample(endpoint.path));
  }
  const durations = samples.map((s) => s.ms);
  const last = samples[samples.length - 1];
  return {
    name: endpoint.name,
    path: endpoint.path,
    status: last.status,
    medianMs: Math.round(median(durations)),
    slowestMs: Math.round(Math.max(...durations)),
    coldMs: Math.round(durations[0]),
    wireBytes: last.wire,
    decodedBytes: last.decoded,
    encoding: last.encoding,
    cacheControl: last.cacheControl,
    age: last.age,
  };
}

async function apiVersion() {
  try {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) return "unknown";
    const body = await res.json();
    return body.version ?? "unknown";
  } catch {
    return "unreachable";
  }
}

const results = [];
for (const endpoint of selected) {
  try {
    results.push(await measure(endpoint));
  } catch (error) {
    results.push({
      name: endpoint.name,
      path: endpoint.path,
      status: 0,
      error: String(error),
    });
  }
}

const report = {
  base: BASE,
  runs: RUNS,
  measuredAt: new Date().toISOString(),
  apiVersion: await apiVersion(),
  params: {
    season: SEASON,
    round: ROUND,
    driver: DRIVER,
    constructor: CONSTRUCTOR,
    circuit: CIRCUIT,
  },
  results,
};

const header = [
  "endpoint".padEnd(28),
  "code".padStart(4),
  "median".padStart(8),
  "slowest".padStart(8),
  "cold".padStart(8),
  "wireKiB".padStart(9),
  "decKiB".padStart(9),
  "encoding".padStart(9),
  "  cache-control",
].join(" ");

console.log(`\nAPI ${BASE} · version ${report.apiVersion} · ${RUNS} runs\n`);
console.log(header);
console.log("-".repeat(header.length));
for (const row of results) {
  if (row.error) {
    console.log(`${row.name.padEnd(28)} ${"ERR".padStart(4)}  ${row.error}`);
    continue;
  }
  console.log(
    [
      row.name.padEnd(28),
      String(row.status).padStart(4),
      `${row.medianMs}ms`.padStart(8),
      `${row.slowestMs}ms`.padStart(8),
      `${row.coldMs}ms`.padStart(8),
      kib(row.wireBytes).padStart(9),
      kib(row.decodedBytes).padStart(9),
      row.encoding.padStart(9),
      `  ${row.cacheControl}`,
    ].join(" "),
  );
}
console.log("");

if (JSON_OUT) {
  writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${JSON_OUT}\n`);
}

const failed = results.filter((r) => r.error || r.status >= 400);
if (failed.length > 0) {
  console.error(`${failed.length} endpoint(s) did not return a success status.`);
  process.exit(1);
}
