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
  const dynamics = await vite.ssrLoadModule("/lib/ai/race-dynamics.ts");
  const sql = neon(process.env.AI_DB_URL);
  const sessions = await sql.query(
    `SELECT s.id, s.year, s.round, s.event_name
     FROM sessions s
     WHERE s.session_type = $1 AND s.year BETWEEN $2 AND $3
       AND EXISTS (
         SELECT 1 FROM session_results sr
         WHERE sr.session_id = s.id AND sr.position = 1
       )
     ORDER BY s.year, s.round`,
    ["race", from, to],
  );
  const report = {
    scope: { from, to, races: sessions.length },
    detectors: {
      supportedCoveredUndercut: 0,
      safeStopLiveOrReplayOnly: 0,
      costlyDoubleStack: 0,
      historicalStrategyAny: 0,
      anyWithLiveOrReplay: 0,
    },
    selectedPrimary: {},
    questionCount: { 0: 0, 1: 0, 2: 0, 3: 0 },
    acceptedPaceModels: 0,
    noInsight: [],
  };

  for (let index = 0; index < sessions.length; index += 6) {
    const rows = await Promise.all(
      sessions.slice(index, index + 6).map(async (session) => {
        const [laps, raceDynamics] = await Promise.all([
          sql.query(strategy.RACE_STRATEGY_LAPS_SQL, [session.id]),
          dynamics.loadRaceDynamics(session.id),
        ]);
        const evidence = calculation.calculateRaceStrategyEvidence({
          sessionId: session.id,
          laps,
        });
        return { session, evidence, raceDynamics };
      }),
    );
    for (const { session, evidence, raceDynamics } of rows) {
      const failedUndercut = evidence.undercutFailures.some(
        (event) =>
          event.comparedNewTyreLaps > 0 &&
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
      if (failedUndercut) report.detectors.supportedCoveredUndercut += 1;
      if (safeStop) report.detectors.safeStopLiveOrReplayOnly += 1;
      if (costlyDoubleStack) report.detectors.costlyDoubleStack += 1;
      if (failedUndercut || costlyDoubleStack)
        report.detectors.historicalStrategyAny += 1;
      if (failedUndercut || safeStop || costlyDoubleStack)
        report.detectors.anyWithLiveOrReplay += 1;
      if (evidence.paceModel.quality.usable) report.acceptedPaceModels += 1;
      const insights = corner.selectRaceCornerInsights({
        strategy: evidence,
        dynamics: raceDynamics,
      });
      report.questionCount[insights.length] += 1;
      if (insights[0]) {
        report.selectedPrimary[insights[0].kind] =
          (report.selectedPrimary[insights[0].kind] ?? 0) + 1;
      } else report.noInsight.push(session);
    }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await vite.close();
}
