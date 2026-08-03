#!/usr/bin/env node
/**
 * Parses the Next.js production build route table into a comparable report.
 *
 * Usage:
 *   node scripts/perf/bundle-report.mjs                      # runs the build
 *   node scripts/perf/bundle-report.mjs --log build.log      # parses a log
 *   node scripts/perf/bundle-report.mjs --json bundle.json
 *   node scripts/perf/bundle-report.mjs --budget scripts/perf/bundle-budget.json
 *
 * With --budget, exits non-zero when shared or per-route first-load JavaScript
 * exceeds the recorded budget.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));

const args = process.argv.slice(2);

function flag(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

const LOG = flag("log");
const JSON_OUT = flag("json");
const BUDGET = flag("budget");

const ROUTE_ROW =
  /^[┌├└]\s+\S\s+(\S+)\s+([\d.]+\s*[kM]?B)\s+([\d.]+\s*[kM]?B)\s*$/;
const SHARED_ROW = /^\+\s*First Load JS shared by all\s+([\d.]+\s*[kM]?B)\s*$/;
const CHUNK_ROW = /^\s+[├└]\s+(\S.*?)\s{2,}([\d.]+\s*[kM]?B)\s*$/;
const MIDDLEWARE_ROW = /^ƒ\s+Middleware\s+([\d.]+\s*[kM]?B)\s*$/;

/** Next reports kB as 1000 bytes and MB as 1000 kB. */
function toBytes(text) {
  const match = /^([\d.]+)\s*([kM]?)B$/.exec(text.replace(/\s+/g, " ").trim());
  if (!match) return 0;
  const value = Number(match[1]);
  if (match[2] === "k") return Math.round(value * 1000);
  if (match[2] === "M") return Math.round(value * 1000 * 1000);
  return Math.round(value);
}

function kb(bytes) {
  return Number((bytes / 1000).toFixed(1));
}

function buildLog() {
  if (LOG) return readFileSync(LOG, "utf8");
  return execFileSync("npm", ["--prefix", "frontend", "run", "build"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

const log = buildLog();
const routes = [];
const sharedChunks = [];
let sharedBytes = 0;
let middlewareBytes = 0;
let inSharedSection = false;

for (const line of log.split("\n")) {
  const route = ROUTE_ROW.exec(line);
  if (route) {
    routes.push({
      route: route[1],
      sizeBytes: toBytes(route[2]),
      firstLoadBytes: toBytes(route[3]),
    });
    continue;
  }
  const shared = SHARED_ROW.exec(line);
  if (shared) {
    sharedBytes = toBytes(shared[1]);
    inSharedSection = true;
    continue;
  }
  const chunk = inSharedSection ? CHUNK_ROW.exec(line) : null;
  if (chunk) {
    sharedChunks.push({ chunk: chunk[1], bytes: toBytes(chunk[2]) });
    continue;
  }
  const middleware = MIDDLEWARE_ROW.exec(line);
  if (middleware) {
    middlewareBytes = toBytes(middleware[1]);
    inSharedSection = false;
  }
}

if (routes.length === 0) {
  console.error("No route table found in the build output.");
  process.exit(1);
}

const report = {
  measuredAt: new Date().toISOString(),
  sharedFirstLoadBytes: sharedBytes,
  middlewareBytes,
  sharedChunks,
  routes: [...routes].sort((a, b) => b.firstLoadBytes - a.firstLoadBytes),
};

console.log(
  `\nShared first-load JS: ${kb(sharedBytes)} kB · middleware ${kb(middlewareBytes)} kB\n`,
);
for (const chunk of sharedChunks) {
  console.log(`  ${chunk.chunk.padEnd(42)} ${String(kb(chunk.bytes)).padStart(8)} kB`);
}
console.log(`\n${"route".padEnd(42)} ${"size".padStart(8)} ${"first load".padStart(12)}`);
console.log("-".repeat(66));
for (const route of report.routes) {
  console.log(
    `${route.route.padEnd(42)} ${String(kb(route.sizeBytes)).padStart(8)} ${String(kb(route.firstLoadBytes)).padStart(12)}`,
  );
}
console.log("");

if (JSON_OUT) {
  writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${JSON_OUT}\n`);
}

if (!BUDGET) process.exit(0);

if (!existsSync(BUDGET)) {
  console.error(`Budget file ${BUDGET} not found.`);
  process.exit(1);
}

const budget = JSON.parse(readFileSync(BUDGET, "utf8"));
const failures = [];

if (budget.sharedFirstLoadKb && kb(sharedBytes) > budget.sharedFirstLoadKb) {
  failures.push(
    `shared first-load JS ${kb(sharedBytes)} kB exceeds budget ${budget.sharedFirstLoadKb} kB`,
  );
}
for (const [route, limit] of Object.entries(budget.routes ?? {})) {
  const measured = report.routes.find((r) => r.route === route);
  if (!measured) {
    failures.push(`budgeted route ${route} missing from build output`);
    continue;
  }
  if (kb(measured.firstLoadBytes) > limit) {
    failures.push(
      `${route} first-load JS ${kb(measured.firstLoadBytes)} kB exceeds budget ${limit} kB`,
    );
  }
}

if (failures.length > 0) {
  console.error("Bundle budget exceeded:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`Bundle budgets satisfied (${BUDGET}).\n`);
