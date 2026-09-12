import { neon } from "@neondatabase/serverless";
import { createServer } from "vite";

function integerArgument(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix));
  if (!raw) return fallback;
  const value = Number(raw.slice(prefix.length));
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

const from = integerArgument("from", 2018);
const to = integerArgument("to", new Date().getUTCFullYear());
if (!process.env.AI_DB_URL) throw new Error("AI_DB_URL is required");
if (from > to) throw new Error("from must not be later than to");

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const strategy = await vite.ssrLoadModule("/lib/ai/race-strategy.ts");
  const calculation = await vite.ssrLoadModule(
    "/lib/ai/race-strategy-calculation.ts",
  );
  const corner = await vite.ssrLoadModule("/lib/ai/race-corner-insight.ts");
  const sql = neon(process.env.AI_DB_URL);
  const sessions = await sql.query(
    `SELECT s.id, s.year, s.round, s.event_name
     FROM sessions s
     WHERE s.session_type = $1 AND s.year BETWEEN $2 AND $3
       AND EXISTS (
         SELECT 1 FROM laps l
         WHERE l.session_id = s.id
           AND l.compound IS NOT NULL
           AND l.pit_in_time_seconds IS NOT NULL
       )
     ORDER BY s.year, s.round`,
    ["race", from, to],
  );
  const report = {
    scope: { from, to, races: sessions.length },
    detectors: {
      failedUndercut: 0,
      safeStop: 0,
      costlyDoubleStack: 0,
      any: 0,
    },
    selected: { failed_undercut: 0, safe_stop: 0, double_stack: 0 },
    acceptedPaceModels: 0,
    noInsight: [],
  };

  for (let index = 0; index < sessions.length; index += 6) {
    const rows = await Promise.all(
      sessions.slice(index, index + 6).map(async (session) => {
        const laps = await sql.query(strategy.RACE_STRATEGY_LAPS_SQL, [
          session.id,
        ]);
        const evidence = calculation.calculateRaceStrategyEvidence({
          sessionId: session.id,
          laps,
        });
        return { session, evidence };
      }),
    );
    for (const { session, evidence } of rows) {
      const failedUndercut = evidence.undercutFailures.some(
        (event) =>
          Math.max(
            Math.abs(event.gapChangeSeconds),
            Math.abs(event.transitDeltaSeconds),
            Math.abs(event.newTyreGainSeconds),
          ) >= 1.5,
      );
      const safeStop = evidence.safeStopCases.length > 0;
      const costlyDoubleStack = evidence.doubleStacks.some(
        (event) => event.secondTransitTaxSeconds >= 2,
      );
      if (failedUndercut) report.detectors.failedUndercut += 1;
      if (safeStop) report.detectors.safeStop += 1;
      if (costlyDoubleStack) report.detectors.costlyDoubleStack += 1;
      if (failedUndercut || safeStop || costlyDoubleStack) {
        report.detectors.any += 1;
      }
      if (evidence.paceModel.quality.usable) report.acceptedPaceModels += 1;
      const insight = corner.selectRaceCornerInsight(evidence);
      if (insight) report.selected[insight.kind] += 1;
      else report.noInsight.push(session);
    }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await vite.close();
}
