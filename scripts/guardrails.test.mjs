import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
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
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

function writeBaseline(root, sizeCaps) {
  writeFileSync(
    join(root, "scripts", "guardrails-baseline.json"),
    `${JSON.stringify({ sizeCaps }, null, 2)}\n`,
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
  const baseline = JSON.parse(
    readFileSync(join(root, "scripts", "guardrails-baseline.json"), "utf8"),
  ).sizeCaps;

  assert.equal(result.status, 0);
  assert.deepEqual(baseline, { [improved]: 605 });
});
