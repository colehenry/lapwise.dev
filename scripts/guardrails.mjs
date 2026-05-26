#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ENFORCE = process.env.GUARDRAILS_ENFORCE === "1";

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

for (const rule of SIZE_CAPS) {
  for (const dir of rule.dirs) {
    for (const file of walk(dir)) {
      if (!rule.ext.includes(extname(file))) continue;
      const lines = lineCount(file);
      if (lines > rule.cap) {
        violations.push(`${file} — ${lines} lines (cap ${rule.cap})`);
      } else if (rule.warn && lines > rule.warn) {
        warnings.push(`${file} — ${lines} lines (target ${rule.warn})`);
      }
    }
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
  /#[0-9a-fA-F]{6}\b/,
  { exclude: HEX_ALLOWED },
);

const printHits = grepCount(["backend/app"], [".py"], /\bprint\(/);

const consoleHits = grepCount(
  ["frontend/app", "frontend/components", "frontend/lib"],
  [".ts", ".tsx"],
  /console\.(log|warn|error)\(/,
);

function section(title, items, sample = 5) {
  if (items.length === 0) {
    console.log(`  ok  ${title}`);
    return;
  }
  console.log(`  !!  ${title}: ${items.length}`);
  for (const item of items.slice(0, sample)) console.log(`        ${item}`);
  if (items.length > sample) console.log(`        … ${items.length - sample} more`);
}

console.log("\nGuardrails report\n");
section("file-size caps exceeded", violations);
section("file-size targets (soft)", warnings);
section("hardcoded hex outside approved files", hexHits);
section("print() in backend/app", printHits);
section("console.* in frontend source", consoleHits);

const hardCount = violations.length + hexHits.length + printHits.length + consoleHits.length;
console.log(`\n${hardCount} item(s) to bring into compliance.\n`);

if (ENFORCE && hardCount > 0) {
  console.log("GUARDRAILS_ENFORCE=1 and violations present — failing.\n");
  process.exit(1);
}
