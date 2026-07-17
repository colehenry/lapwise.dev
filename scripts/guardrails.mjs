#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve scan paths from the repo root, not the caller's working directory.
process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const BASELINE_PATH = "scripts/guardrails-baseline.json";
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "venv",
  "__pycache__",
  "cache",
  "logs",
  "alembic",
]);

const HEX_ALLOWED = new Set([
  "frontend/lib/chart-utils.ts",
  "frontend/components/chart-primitives.tsx",
  "frontend/lib/color-utils.ts",
]);

const SIZE_CAPS = [
  { dirs: ["frontend/components", "frontend/app"], ext: [".tsx"], cap: 600, warn: 400 },
  { dirs: ["frontend/lib", "frontend/hooks"], ext: [".ts"], cap: 300 },
  { dirs: ["backend/app/services"], ext: [".py"], cap: 600 },
  { dirs: ["backend/app/routers"], ext: [".py"], cap: 300 },
];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...walk(join(dir, e.name)));
    } else {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

function lineCount(file) {
  return readFileSync(file, "utf8").split("\n").length;
}

const violations = [];
const warnings = [];
const overCap = []; // { file, lines, cap } — structured, drives the ratchet

for (const rule of SIZE_CAPS) {
  for (const dir of rule.dirs) {
    for (const file of walk(dir)) {
      if (!rule.ext.includes(extname(file))) continue;
      const rel = file.replace(/\\/g, "/");
      const lines = lineCount(file);
      if (lines > rule.cap) {
        violations.push(`${rel} — ${lines} lines (cap ${rule.cap})`);
        overCap.push({ file: rel, lines, cap: rule.cap });
      } else if (rule.warn && lines > rule.warn) {
        warnings.push(`${rel} — ${lines} lines (target ${rule.warn})`);
      }
    }
  }
}

// --- File-size ratchet ---------------------------------------------------
// Baseline records the line count of every file currently over its cap. CI
// fails only when a *new* over-cap file appears or an existing one *grows*
// past its baseline — the 29 existing offenders stay report-only until they
// are chipped down. A file that shrinks below its baseline (or under the cap)
// is a report-only nudge to re-run with --update-baseline and lock the win in.
const baseline = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, "utf8")).sizeCaps ?? {})
  : {};

if (UPDATE_BASELINE) {
  const sizeCaps = Object.fromEntries(
    overCap
      .sort((a, b) => a.file.localeCompare(b.file))
      .map((v) => [v.file, v.lines]),
  );
  const payload = {
    note: "Baseline for the guardrails file-size ratchet. Regenerate with `npm run guardrails:update`. Numbers should only ever go down.",
    sizeCaps,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${BASELINE_PATH}: ${overCap.length} over-cap file(s).`);
  process.exit(0);
}

const ratchetFailures = [];
const improvements = [];
for (const v of overCap) {
  const base = baseline[v.file];
  if (base === undefined) {
    ratchetFailures.push(
      `${v.file} — NEW over-cap file at ${v.lines} lines (cap ${v.cap})`,
    );
  } else if (v.lines > base) {
    ratchetFailures.push(
      `${v.file} — grew to ${v.lines} lines (baseline ${base}, cap ${v.cap})`,
    );
  } else if (v.lines < base) {
    improvements.push(`${v.file} — down to ${v.lines} lines (baseline ${base})`);
  }
}
const currentOverCap = new Set(overCap.map((v) => v.file));
for (const file of Object.keys(baseline)) {
  if (!currentOverCap.has(file)) {
    improvements.push(`${file} — now under cap (baseline ${baseline[file]})`);
  }
}

function grepCount(dirs, exts, regex, { exclude } = {}) {
  const hits = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (!exts.includes(extname(file))) continue;
      const rel = file.replace(/\\/g, "/");
      if (exclude?.has(rel)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (regex.test(line)) hits.push(`${rel}:${i + 1}`);
      });
    }
  }
  return hits;
}

const hexHits = grepCount(
  ["frontend/components", "frontend/app"],
  [".ts", ".tsx"],
  /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/,
  { exclude: HEX_ALLOWED },
);

const printHits = grepCount(["backend/app"], [".py"], /\bprint\(/);

const consoleHits = grepCount(
  ["frontend/app", "frontend/components", "frontend/lib"],
  [".ts", ".tsx"],
  /console\.(log|warn|error)\(/,
);

const checks = [
  { label: "print() in backend/app", items: printHits, enforce: true },
  { label: "console.* in frontend source", items: consoleHits, enforce: true },
  { label: "hardcoded hex outside approved files", items: hexHits, enforce: true },
  { label: "file-size ratchet (new or grown over-cap files)", items: ratchetFailures, enforce: true },
  { label: "file-size caps exceeded (existing debt)", items: violations, enforce: false },
  { label: "file-size targets (soft)", items: warnings, enforce: false },
  { label: "file-size wins — run `npm run guardrails:update`", items: improvements, enforce: false },
];

function section(label, items, enforce, sample = 5) {
  const tag = enforce ? "[enforced]" : "[report]  ";
  if (items.length === 0) {
    console.log(`  ok  ${tag} ${label}`);
    return;
  }
  console.log(`  !!  ${tag} ${label}: ${items.length}`);
  for (const item of items.slice(0, sample)) console.log(`           ${item}`);
  if (items.length > sample) {
    console.log(`           … ${items.length - sample} more`);
  }
}

console.log("\nGuardrails report\n");
for (const c of checks) section(c.label, c.items, c.enforce);

const enforcedFailures = checks
  .filter((c) => c.enforce)
  .reduce((n, c) => n + c.items.length, 0);
const reportOnly = checks
  .filter((c) => !c.enforce)
  .reduce((n, c) => n + c.items.length, 0);

console.log(
  `\n${enforcedFailures} enforced violation(s); ${reportOnly} report-only item(s) to clean up.\n`,
);

if (enforcedFailures > 0) process.exit(1);
