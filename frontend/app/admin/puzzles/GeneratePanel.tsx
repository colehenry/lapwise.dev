"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { adminGeneratePuzzles } from "@/lib/admin";
import ThemeHeaderPicker from "./ThemeHeaderPicker";

/** Proposing boards. The generator owns variety and scheduling memory; the
 *  validator owns correctness and drops anything that fails, so fewer boards
 *  than requested is a normal outcome rather than an error. */
export default function GeneratePanel({
  onGenerated,
}: {
  onGenerated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(7);
  const [startOn, setStartOn] = useState("");
  const [floor, setFloor] = useState(1990);
  const [theme, setTheme] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
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
        start_on: startOn || null,
        theme,
        seed,
      });
      const made = response.created.length;
      setResult(
        made === response.requested
          ? `${made} board${made === 1 ? "" : "s"} proposed.`
          : `${made} of ${response.requested} proposed — the rest failed validation and were dropped.`,
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
          Generate boards
        </Button>
        {result && <span className="text-xs text-emerald-300">{result}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-sm border border-border-primary bg-bg-secondary p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field htmlFor="generate-count" label="How many">
          <input
            id="generate-count"
            type="number"
            min={1}
            max={30}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className={INPUT}
          />
        </Field>
        <Field htmlFor="generate-start" label="First date">
          <input
            id="generate-start"
            type="date"
            value={startOn}
            onChange={(event) => setStartOn(event.target.value)}
            className={INPUT}
          />
        </Field>
        <Field htmlFor="generate-floor" label="Floor">
          <input
            id="generate-floor"
            type="number"
            min={1950}
            max={2100}
            value={floor}
            onChange={(event) => setFloor(Number(event.target.value))}
            className={INPUT}
          />
        </Field>
        <Field htmlFor="generate-seed" label="Seed">
          <input
            id="generate-seed"
            type="number"
            value={seed}
            onChange={(event) => setSeed(Number(event.target.value))}
            className={`${INPUT} w-20`}
          />
        </Field>
      </div>

      <div className="max-w-md">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Theme headers
        </p>
        <ThemeHeaderPicker floor={floor} selected={theme} onChange={setTheme} />
      </div>

      <p className="text-[11px] leading-relaxed text-text-muted">
        Boards are dated forward one day at a time from the first date, and land
        as drafts. Leave the date empty to start tomorrow, or set a past date to
        propose boards for the archive.
      </p>

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
          Close
        </Button>
        {busy && (
          <span className="text-xs text-text-muted">
            Loading the driver pool and header catalog; this takes a few
            seconds.
          </span>
        )}
      </div>
    </div>
  );
}

const INPUT =
  "rounded-sm border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary";

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
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="font-mono text-[10px] uppercase tracking-wider text-text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
