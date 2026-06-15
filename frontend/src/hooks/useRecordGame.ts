import { useEffect, useRef, useState } from 'react';
import { addScore } from '../game/scores';
import { recordGame } from '../api/client';
import type { Difficulty } from '../game/ai';
import type { Phase } from '../game/types';

interface UseRecordGameParams {
  phase: Phase;
  winner: 'player' | 'ai' | null;
  /** Bumps once per shot; combined with the winner it identifies a finished game. */
  turn: number;
  shots: number;
  difficulty: Difficulty;
  name: string;
}

/**
 * Persist a finished game to the leaderboard exactly once and return a key that
 * increments after the write settles. Consumers pass that key to the scoreboard
 * so it re-fetches *after* the new score lands — never racing the write.
 */
export function useRecordGame({
  phase,
  winner,
  turn,
  shots,
  difficulty,
  name,
}: UseRecordGameParams): number {
  const [leaderboardKey, setLeaderboardKey] = useState(0);
  const recordedRef = useRef('');

  useEffect(() => {
    if (phase !== 'game-over' || !winner) return;
    const gameId = `${winner}-${turn}`;
    if (recordedRef.current === gameId) return;
    recordedRef.current = gameId;

    // Preserve the player's chosen capitalization (e.g. "Alex", not "ALEX").
    const cleanName = (name.trim() || 'ANON').slice(0, 16);
    // Local top-scores table (works even in LOCAL AI MODE): only wins count.
    if (winner === 'player') {
      addScore({ name: cleanName, shots, difficulty });
    }
    // Refresh the table only after the score is persisted, otherwise the
    // re-fetch races the write and reads stale data (the new score is missing).
    void recordGame({
      name: cleanName,
      won: winner === 'player',
      shots,
      difficulty,
    }).finally(() => setLeaderboardKey((k) => k + 1));
  }, [phase, winner, turn, name, shots, difficulty]);

  return leaderboardKey;
}
