#!/usr/bin/env node
import { spawnSync } from "node:child_process";
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
  "frontend/components/charts/chart-primitives.tsx",
  "frontend/lib/color-utils.ts",
]);

// Next.js owns these filenames; every route folder legitimately repeats them.
const ROUTE_FILENAMES = new Set([
  "page.tsx",
  "layout.tsx",
  "loading.tsx",
  "error.tsx",
  "global-error.tsx",
  "not-found.tsx",
  "template.tsx",
  "default.tsx",
  "route.ts",
  "opengraph-image.tsx",
  "icon.tsx",
  "apple-icon.tsx",
  "sitemap.ts",
  "robots.ts",
  "manifest.ts",
]);

const FRONTEND_SOURCE_DIRS = [
  "frontend/app",
  "frontend/components",
  "frontend/lib",
  "frontend/hooks",
];

// Canonical query keys and fetchers live here; everywhere else declares none.
const QUERY_LAYER_DIR = "frontend/lib/queries";

const SIZE_CAPS = [
  {
    dirs: ["frontend/components", "frontend/app"],
    ext: [".ts", ".tsx"],
    cap: 600,
    warn: 400,
  },
  {
    dirs: ["frontend/lib", "frontend/hooks"],
    ext: [".ts", ".tsx"],
    cap: 300,
  },
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

function sourceFiles(dirs, exts, { exclude } = {}) {
  const out = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (!exts.includes(extname(file))) continue;
      const rel = file.replace(/\\/g, "/");
      if (exclude?.(rel)) continue;
      out.push(rel);
    }
  }
  return out;
}

function grepCount(dirs, exts, regex, { exclude } = {}) {
  const hits = [];
  for (const rel of sourceFiles(dirs, exts, {
    exclude: exclude ? (f) => exclude.has(f) : undefined,
  })) {
    const lines = readFileSync(rel, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (regex.test(line)) hits.push(`${rel}:${i + 1}`);
    });
  }
  return hits;
}

/** Collapses `path:line` hits into a per-file count for the ratchet. */
function countByFile(hits) {
  const counts = {};
  for (const hit of hits) {
    const file = hit.slice(0, hit.lastIndexOf(":"));
    counts[file] = (counts[file] ?? 0) + 1;
  }
  return counts;
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

// --- Drift measurements --------------------------------------------------
// Each one counts a way the repo can end up with two of something. They are
// ratcheted, not banned outright, because today's counts are already non-zero.

// Two source files with one name are hostile to grep, to editor tabs, and to
// anyone reading an import line. Route filenames are Next.js's, not ours.
const basenameCounts = {};
for (const rel of sourceFiles(FRONTEND_SOURCE_DIRS, [".ts", ".tsx"])) {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  if (ROUTE_FILENAMES.has(name)) continue;
  basenameCounts[name] = (basenameCounts[name] ?? 0) + 1;
}
const duplicateBasenames = Object.fromEntries(
  Object.entries(basenameCounts).filter(([, count]) => count > 1),
);

// A `queryKey` outside the query layer is a resource addressed twice: the
// canonical key in lib/queries and a component-local copy that never shares
// its cache entry.
const inlineQueryKeys = countByFile(
  grepCount(
    ["frontend/app", "frontend/components", "frontend/hooks"],
    [".ts", ".tsx"],
    /\bqueryKey\s*:/,
  ),
);

// Commit messages name no tool or assistant as an author (CONVENTIONS.md
// WF-3). Some tooling adds such a trailer by default, so the rule needs a
// check rather than prose. Scans full history, which needs an unshallow
// checkout — CI passes fetch-depth: 0 for exactly this.
const ATTRIBUTION_PATTERN =
  /co-authored-by:.*(claude|anthropic|copilot|cursor|gpt|codex)|generated with .*(claude|chatgpt|copilot)|🤖/i;

function taintedCommits() {
  const git = spawnSync(
    "git",
    ["log", "--all", "--format=%H%x1f%s%x1f%B%x1e"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (git.status !== 0) return { unavailable: true, commits: {} };

  const commits = {};
  for (const entry of git.stdout.split("\x1e")) {
    const [sha, subject, body] = entry.replace(/^\n/, "").split("\x1f");
    if (!sha || !ATTRIBUTION_PATTERN.test(body ?? "")) continue;
    commits[`${sha.slice(0, 12)} ${subject}`] = 1;
  }
  return { unavailable: false, commits };
}

const attribution = taintedCommits();

// `1000 * 60 * 5` and `5 * 60 * 1000` are the same duration written two ways.
// lib/queries/durations.ts is the one spelling.
const rawDurations = countByFile(
  grepCount([QUERY_LAYER_DIR], [".ts"], /\b\d[\d_]*\s*\*\s*\d/, {
    exclude: new Set([`${QUERY_LAYER_DIR}/durations.ts`]),
  }),
);

// --- Ratchet -------------------------------------------------------------
// Every guardrail above records a per-key count in the baseline. CI fails only
// when a *new* key appears or an existing count *grows* — existing debt stays
// report-only until it is chipped down. A count that drops is a report-only
// nudge to re-run with --update-baseline and lock the win in.
const baselineFile = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  : {};

// A check whose baseline section does not exist yet is being introduced: its
// current state is the seed, so `--update-baseline` may record it. Once the
// section exists, a new key is new debt and is rejected like any other.
function ratchet(current, base, describe, { seeding = false } = {}) {
  const failures = [];
  const improvements = [];
  for (const [key, count] of Object.entries(current)) {
    const prior = base[key];
    if (prior === undefined) {
      if (!seeding) failures.push(describe.added(key, count));
    } else if (count > prior) failures.push(describe.grew(key, count, prior));
    else if (count < prior)
      improvements.push(describe.shrank(key, count, prior));
  }
  for (const key of Object.keys(base)) {
    if (current[key] === undefined) {
      improvements.push(describe.resolved(key, base[key]));
    }
  }
  return { failures, improvements };
}

const capOf = new Map(overCap.map((v) => [v.file, v.cap]));
const sizeRatchet = ratchet(
  Object.fromEntries(overCap.map((v) => [v.file, v.lines])),
  baselineFile.sizeCaps ?? {},
  {
    added: (f, n) =>
      `${f} — NEW over-cap file at ${n} lines (cap ${capOf.get(f)})`,
    grew: (f, n, was) =>
      `${f} — grew to ${n} lines (baseline ${was}, cap ${capOf.get(f)})`,
    shrank: (f, n, was) => `${f} — down to ${n} lines (baseline ${was})`,
    resolved: (f, was) => `${f} — now under cap (baseline ${was})`,
  },
);

const drift = baselineFile.drift ?? {};
const seeds = (section) => ({
  seeding: UPDATE_BASELINE && drift[section] === undefined,
});

const basenameRatchet = ratchet(
  duplicateBasenames,
  drift.duplicateBasenames ?? {},
  {
    added: (name, n) => `${name} — NEW duplicate basename (${n} files)`,
    grew: (name, n, was) => `${name} — now ${n} files (baseline ${was})`,
    shrank: (name, n, was) => `${name} — down to ${n} files (baseline ${was})`,
    resolved: (name, was) => `${name} — no longer duplicated (baseline ${was})`,
  },
  seeds("duplicateBasenames"),
);

const queryKeyRatchet = ratchet(
  inlineQueryKeys,
  drift.inlineQueryKeys ?? {},
  {
    added: (f, n) =>
      `${f} — ${n} inline queryKey(s); use ${QUERY_LAYER_DIR} instead`,
    grew: (f, n, was) => `${f} — ${n} inline queryKey(s) (baseline ${was})`,
    shrank: (f, n, was) =>
      `${f} — down to ${n} inline queryKey(s) (baseline ${was})`,
    resolved: (f, was) =>
      `${f} — migrated to the query layer (baseline ${was})`,
  },
  seeds("inlineQueryKeys"),
);

const attributionRatchet = ratchet(
  attribution.commits,
  drift.aiAttributionCommits ?? {},
  {
    added: (c) => `${c} — names a tool as an author`,
    grew: (c) => `${c} — names a tool as an author`,
    shrank: (c) => `${c} — attribution removed`,
    resolved: (c) => `${c} — no longer in history`,
  },
  seeds("aiAttributionCommits"),
);

const durationRatchet = ratchet(
  rawDurations,
  drift.rawDurations ?? {},
  {
    added: (f, n) => `${f} — ${n} bare duration(s); use ./durations helpers`,
    grew: (f, n, was) => `${f} — ${n} bare duration(s) (baseline ${was})`,
    shrank: (f, n, was) =>
      `${f} — down to ${n} bare duration(s) (baseline ${was})`,
    resolved: (f, was) => `${f} — no bare durations left (baseline ${was})`,
  },
  seeds("rawDurations"),
);

const ratchets = [
  sizeRatchet,
  basenameRatchet,
  queryKeyRatchet,
  durationRatchet,
  attributionRatchet,
];
const ratchetFailures = ratchets.flatMap((r) => r.failures);
const improvements = ratchets.flatMap((r) => r.improvements);

if (UPDATE_BASELINE) {
  if (ratchetFailures.length > 0) {
    console.error("Refusing to update a baseline with new or increased debt:");
    for (const failure of ratchetFailures) console.error(`  ${failure}`);
    process.exit(1);
  }

  const sorted = (map) =>
    Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
    );
  const payload = {
    note: "Baseline for the guardrails ratchets. Regenerate with `npm run guardrails:update`. Numbers only move down; new or increased debt is rejected.",
    sizeCaps: sorted(Object.fromEntries(overCap.map((v) => [v.file, v.lines]))),
    drift: {
      aiAttributionCommits: sorted(attribution.commits),
      duplicateBasenames: sorted(duplicateBasenames),
      inlineQueryKeys: sorted(inlineQueryKeys),
      rawDurations: sorted(rawDurations),
    },
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Wrote ${BASELINE_PATH}: ${overCap.length} over-cap file(s), ` +
      `${Object.keys(duplicateBasenames).length} duplicate basename(s), ` +
      `${Object.keys(inlineQueryKeys).length} file(s) with inline query keys.`,
  );
  process.exit(0);
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
  {
    label: "hardcoded hex outside approved files",
    items: hexHits,
    enforce: true,
  },
  {
    label: "file-size ratchet (new or grown over-cap files)",
    items: sizeRatchet.failures,
    enforce: true,
  },
  {
    label: "duplicate filenames (new or spreading)",
    items: basenameRatchet.failures,
    enforce: true,
  },
  {
    label: "query keys declared outside the query layer",
    items: queryKeyRatchet.failures,
    enforce: true,
  },
  {
    label: "bare duration arithmetic in the query layer",
    items: durationRatchet.failures,
    enforce: true,
  },
  {
    label: "commit message names a tool as an author",
    items: attributionRatchet.failures,
    enforce: true,
  },
  {
    label: "file-size caps exceeded (existing debt)",
    items: violations,
    enforce: false,
  },
  { label: "file-size targets (soft)", items: warnings, enforce: false },
  {
    label: "inline query keys awaiting migration (existing debt)",
    items: Object.entries(inlineQueryKeys).map(([f, n]) => `${f} — ${n}`),
    enforce: false,
  },
  {
    label: attribution.unavailable
      ? "commit-message check UNCHECKED — shallow clone, use fetch-depth: 0"
      : "commit messages naming a tool (existing history)",
    items: attribution.unavailable
      ? ["git history unavailable"]
      : Object.keys(attribution.commits),
    enforce: false,
  },
  {
    label: "duplicated filenames (existing debt)",
    items: Object.entries(duplicateBasenames).map(
      ([f, n]) => `${f} — ${n} files`,
    ),
    enforce: false,
  },
  {
    label: "ratchet wins — run `npm run guardrails:update`",
    items: improvements,
    enforce: false,
  },
];

function section(label, items, enforce, sample = enforce ? items.length : 5) {
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
