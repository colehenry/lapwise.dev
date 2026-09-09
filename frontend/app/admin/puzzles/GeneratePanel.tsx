"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { adminGeneratePuzzles } from "@/lib/admin";
import ThemeHeaderPicker from "./ThemeHeaderPicker";

/** Proposing boards. Anything that fails validation is dropped, so fewer
 *  boards than asked for is a normal result rather than an error. */
export default function GeneratePanel({
  onGenerated,
}: {
  onGenerated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(7);
  const [floor, setFloor] = useState(1990);
  const [theme, setTheme] = useState<string[]>([]);
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const response = await adminGeneratePuzzles({
        count,
        eligibility_floor: floor,
        theme,
        seed: seed.trim() === "" ? null : Number(seed),
      });
      const made = response.created.length;
      setResult(
        made === response.requested
          ? `${made} new board${made === 1 ? "" : "s"}.`
          : `${made} of ${response.requested} — the rest failed validation.`,
      );
      await onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => setOpen(true)}>
          Generate
        </Button>
        {result && <span className="text-xs text-emerald-300">{result}</span>}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-sm border border-border-primary bg-bg-secondary p-3">
      <div className="flex flex-wrap items-end gap-4">
        <Field htmlFor="generate-count" label="Boards">
          <input
            id="generate-count"
            type="number"
            min={1}
            max={30}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className={`${INPUT} w-16`}
          />
        </Field>
        <Field htmlFor="generate-floor" label="Earliest season">
          <input
            id="generate-floor"
            type="number"
            min={1950}
            max={2100}
            value={floor}
            onChange={(event) => setFloor(Number(event.target.value))}
            className={`${INPUT} w-20`}
          />
        </Field>
        {/* Blank means a different set every run. A number repeats one. */}
        <Field htmlFor="generate-seed" label="Seed">
          <input
            id="generate-seed"
            type="number"
            value={seed}
            placeholder="random"
            onChange={(event) => setSeed(event.target.value)}
            className={`${INPUT} w-24`}
          />
        </Field>
      </div>

      <div className="max-w-md">
        <p className="mb-1.5 text-xs font-medium text-text-secondary">Theme</p>
        <ThemeHeaderPicker floor={floor} selected={theme} onChange={setTheme} />
      </div>

      {error && (
        <p className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {result && <p className="text-xs text-emerald-300">{result}</p>}

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy} onClick={run}>
          {busy ? "Generating…" : "Generate"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        {busy && (
          <span className="text-xs text-text-muted">Takes a few seconds.</span>
        )}
      </div>
    </div>
  );
}

const INPUT =
  "rounded-sm border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary";

function Field({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-text-secondary"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
