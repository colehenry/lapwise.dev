"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import DailyGameDriverSearch from "@/components/games/DailyGameDriverSearch";
import DailyGameLights from "@/components/games/DailyGameLights";
import DailyGameSettingsPanel from "@/components/games/DailyGameSettingsPanel";
import DailyGameStatsPanel from "@/components/games/DailyGameStatsPanel";
import DailyGameUtilityBar from "@/components/games/DailyGameUtilityBar";
import { useDailyGameSettings } from "@/hooks/useDailyGameSettings";
import { useGuessGameProgress } from "@/hooks/useGuessGameProgress";
import {
  guessGameCatalogQuery,
  guessGameLeaderboardQuery,
  guessGamePuzzleQuery,
  guessGameStatsQuery,
} from "@/lib/queries/guessGame";
import GuessGameRow from "./GuessGameRow";
import GuessGameRules from "./GuessGameRules";

function GuessGameLoaded({ puzzleNumber }: { puzzleNumber?: number }) {
  const [replayRun, setReplayRun] = useState(0);
  const puzzle = useQuery(guessGamePuzzleQuery(puzzleNumber));
  const catalog = useQuery(guessGameCatalogQuery());
  const progress = useGuessGameProgress(
    puzzle.data?.id ?? "",
    replayRun === 0,
    replayRun,
  );
  const { settings, update } = useDailyGameSettings();
  const stats = useQuery(guessGameStatsQuery(progress.playerId));
  const leaderboard = useQuery(
    guessGameLeaderboardQuery(puzzle.data?.id ?? ""),
  );
  const session = progress.session.data;
  const guesses = session?.guesses ?? [];
  const total = puzzle.data?.max_guesses ?? 10;
  const finished = session ? session.status !== "active" : false;
  const answer = session?.answer;
  const count = finished
    ? session?.status === "won"
      ? `On pole in ${guesses.length}`
      : `Answer: ${answer?.full_name ?? "—"}`
    : `Guess ${guesses.length + 1} of ${total}`;
  const excluded = new Set(guesses.map((guess) => guess.driver.driver_slug));

  return (
    <div className="min-h-[calc(100vh-52px)] bg-surface-page">
      <DailyGameUtilityBar
        settings={
          <DailyGameSettingsPanel settings={settings} onChange={update} />
        }
        statistics={
          <DailyGameStatsPanel
            stats={stats.data}
            leaderboard={leaderboard.data}
            loading={stats.isLoading || leaderboard.isLoading}
            maxScore={total}
          />
        }
        help={
          <GuessGameRules
            currentNumber={puzzle.data?.number ?? 0}
            history={puzzle.data?.history ?? []}
            onReplay={() => setReplayRun((run) => run + 1)}
          />
        }
      />
      <main className="page-frame">
        <div className="mx-auto mb-[120px] mt-16 w-full max-[760px]:mt-[34px] max-[760px]:max-w-[390px]">
          <div className="mx-auto w-[370px] max-w-full">
            <div className="mx-[5px] mb-2 flex min-h-[30px] items-center justify-end gap-3">
              <p className="text-xs font-bold text-ink-base">{count}</p>
              <DailyGameLights spent={guesses.length} total={total} />
            </div>
            <DailyGameDriverSearch
              catalog={catalog.data?.drivers}
              excluded={excluded}
              disabled={
                finished ||
                puzzle.isError ||
                progress.session.isError ||
                !session
              }
              loading={progress.submit.isPending}
              onSelect={(driver) => progress.submit.mutate(driver.driver_slug)}
            />
            {(puzzle.isLoading || progress.session.isLoading) && (
              <p className="mt-3 text-center text-xs text-ink-faint">
                Loading today&apos;s game…
              </p>
            )}
            {(puzzle.isError || progress.session.isError) && (
              <p className="mt-3 text-center text-xs text-danger-bright">
                Today&apos;s game could not load.
              </p>
            )}
            {progress.submit.isError && (
              <p
                className="mt-3 text-center text-xs text-danger-bright"
                role="alert"
              >
                {progress.submit.error.message}
              </p>
            )}
          </div>
          <div className="mt-7 grid gap-[34px]">
            {[...guesses].reverse().map((guess) => (
              <GuessGameRow
                key={guess.sequence}
                guess={guess}
                highContrast={settings.highContrast}
                reduceMotion={settings.reduceMotion}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function GuessGame({ puzzleNumber }: { puzzleNumber?: number }) {
  return (
    <GuessGameLoaded
      key={puzzleNumber ?? "daily"}
      puzzleNumber={puzzleNumber}
    />
  );
}
