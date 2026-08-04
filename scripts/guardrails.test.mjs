import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE_SCRIPT = fileURLToPath(
  new URL("./guardrails.mjs", import.meta.url),
);
const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "lapwise-guardrails-"));
  tempRoots.push(root);
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(SOURCE_SCRIPT, join(root, "scripts", "guardrails.mjs"));
  return root;
}

function writeLines(root, relativePath, count) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Array.from({ length: count }, () => "x").join("\n"));
}

function writeFile(root, relativePath, contents) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const EMPTY_DRIFT = {
  duplicateBasenames: {},
  inlineQueryKeys: {},
  rawDurations: {},
};

function writeBaseline(root, sizeCaps, drift = EMPTY_DRIFT) {
  writeFileSync(
    join(root, "scripts", "guardrails-baseline.json"),
    `${JSON.stringify({ sizeCaps, drift }, null, 2)}\n`,
  );
}

function readBaseline(root) {
  return JSON.parse(
    readFileSync(join(root, "scripts", "guardrails-baseline.json"), "utf8"),
  );
}

function runGuardrails(root, ...args) {
  return spawnSync(
    process.execPath,
    [join(root, "scripts", "guardrails.mjs"), ...args],
    { cwd: root, encoding: "utf8" },
  );
}

test("size checks include TypeScript files under frontend/app", () => {
  const root = createFixture();
  writeLines(root, "frontend/app/api/example/route.ts", 601);
  writeBaseline(root, {});

  const result = runGuardrails(root);

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /frontend\/app\/api\/example\/route\.ts — NEW over-cap file at 601 lines/,
  );
});

test("baseline updates reject increased debt", () => {
  const root = createFixture();
  const file = "frontend/components/Giant.tsx";
  writeLines(root, file, 602);
  writeBaseline(root, { [file]: 601 });

  const result = runGuardrails(root, "--update-baseline");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to update a baseline/);
  assert.equal(
    JSON.parse(
      readFileSync(join(root, "scripts", "guardrails-baseline.json"), "utf8"),
    ).sizeCaps[file],
    601,
  );
});

test("baseline updates lock in improvements and remove resolved files", () => {
  const root = createFixture();
  const improved = "frontend/components/Improved.tsx";
  const resolved = "frontend/components/Resolved.tsx";
  writeLines(root, improved, 605);
  writeBaseline(root, { [improved]: 610, [resolved]: 700 });

  const result = runGuardrails(root, "--update-baseline");

  assert.equal(result.status, 0);
  assert.deepEqual(readBaseline(root).sizeCaps, { [improved]: 605 });
});

test("a new duplicate filename fails, and route filenames do not count", () => {
  const root = createFixture();
  writeFile(root, "frontend/app/drivers/ArchivePageClient.tsx", "export {};");
  writeFile(root, "frontend/app/circuits/ArchivePageClient.tsx", "export {};");
  writeFile(root, "frontend/app/drivers/page.tsx", "export {};");
  writeFile(root, "frontend/app/circuits/page.tsx", "export {};");
  writeBaseline(root, {});

  const result = runGuardrails(root);

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /ArchivePageClient\.tsx — NEW duplicate basename/,
  );
  assert.doesNotMatch(result.stdout, /page\.tsx — NEW duplicate/);
});

test("a baselined duplicate passes until another copy appears", () => {
  const root = createFixture();
  writeFile(root, "frontend/app/a/Card.tsx", "export {};");
  writeFile(root, "frontend/app/b/Card.tsx", "export {};");
  writeBaseline(
    root,
    {},
    { ...EMPTY_DRIFT, duplicateBasenames: { "Card.tsx": 2 } },
  );

  assert.equal(runGuardrails(root).status, 0);

  writeFile(root, "frontend/app/c/Card.tsx", "export {};");
  const result = runGuardrails(root);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Card\.tsx — now 3 files \(baseline 2\)/);
});

test("query keys are allowed in the query layer and rejected outside it", () => {
  const root = createFixture();
  writeFile(
    root,
    "frontend/lib/queries/seasons.ts",
    "  queryKey: seasonKeys.all(),",
  );
  writeFile(
    root,
    "frontend/components/charts/Chart.tsx",
    "  queryKey: ['laps', season],",
  );
  writeBaseline(root, {});

  const result = runGuardrails(root);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /charts\/Chart\.tsx — 1 inline queryKey/);
  assert.doesNotMatch(
    result.stdout,
    /queries\/seasons\.ts — 1 inline queryKey/,
  );
});

test("bare duration arithmetic in the query layer fails, durations.ts excepted", () => {
  const root = createFixture();
  writeFile(root, "frontend/lib/queries/durations.ts", "return n * 60_000;");
  writeFile(
    root,
    "frontend/lib/queries/standings.ts",
    "const S = 1000 * 60 * 5;",
  );
  writeBaseline(root, {});

  const result = runGuardrails(root);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /standings\.ts — 1 bare duration/);
  assert.doesNotMatch(result.stdout, /durations\.ts — 1 bare duration/);
});

test("a check with no baseline section seeds on update, then enforces", () => {
  const root = createFixture();
  writeFile(root, "frontend/app/a/Card.tsx", "export {};");
  writeFile(root, "frontend/app/b/Card.tsx", "export {};");
  writeFileSync(
    join(root, "scripts", "guardrails-baseline.json"),
    `${JSON.stringify({ sizeCaps: {} }, null, 2)}\n`,
  );

  const seeded = runGuardrails(root, "--update-baseline");
  assert.equal(seeded.status, 0);
  assert.deepEqual(readBaseline(root).drift.duplicateBasenames, {
    "Card.tsx": 2,
  });

  writeFile(root, "frontend/app/c/Card.tsx", "export {};");
  assert.equal(runGuardrails(root, "--update-baseline").status, 1);
});
