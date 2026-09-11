"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDailyGamePlayer } from "@/hooks/useDailyGamePlayer";
import {
  guessGameKeys,
  guessGameSessionQuery,
  guessGameStatsInvalidation,
  submitGuessGameGuess,
} from "@/lib/queries/guessGame";

export function useGuessGameProgress(
  puzzleId: string,
  ranked = true,
  replayRun = 0,
) {
  const playerId = useDailyGamePlayer();
  const client = useQueryClient();
  const session = useQuery(
    guessGameSessionQuery(puzzleId, playerId, ranked, replayRun),
  );
  const submit = useMutation({
    mutationFn: (driverSlug: string) => {
      if (!session.data) throw new Error("The game session is still loading");
      return submitGuessGameGuess(
        session.data.session_id,
        driverSlug,
        playerId,
      );
    },
    onSuccess: (guess) => {
      client.setQueryData(
        guessGameKeys.session(puzzleId, playerId, ranked, replayRun),
        session.data
          ? {
              ...session.data,
              status: guess.correct
                ? "won"
                : guess.answer
                  ? "exhausted"
                  : "active",
              answer: guess.answer,
              guesses: [...session.data.guesses, guess],
            }
          : session.data,
      );
      void client.invalidateQueries(guessGameStatsInvalidation(playerId));
    },
  });
  return { playerId, session, submit };
}
