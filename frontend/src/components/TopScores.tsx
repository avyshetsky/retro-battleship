import { useEffect, useMemo, useState } from 'react';
import { getTopScores } from '../game/scores';
import { fetchLeaderboard, hasBackend } from '../api/client';
import type { Difficulty } from '../game/ai';

interface TopScoresProps {
  /** Bumped whenever a game finishes, to refresh the table. */
  refreshKey: number;
  /** Shots the player has fired so far this game. */
  currentShots: number;
  /** Whether a battle is currently underway (so the live counter is relevant). */
  inBattle: boolean;
}

interface DisplayEntry {
  name: string;
  shots: number;
  difficulty: Difficulty;
  key: string;
}

/**
 * High-score panel shown beside the battle log. When a backend is configured it
 * shows the GLOBAL leaderboard (shared across every player); otherwise it falls
 * back to this browser's local best games. Also shows a live counter of the
 * player's current shots so they can see how they're tracking against the record.
 */
export function TopScores({ refreshKey, currentShots, inBattle }: TopScoresProps) {
  // refreshKey changes after each finished game; re-read the stored table then.
  const localEntries = useMemo<DisplayEntry[]>(() => {
    void refreshKey;
    // Locally-stored rows can share a createdAt, so fold in the index to keep
    // React keys unique (duplicate keys corrupt row reconciliation).
    return getTopScores().map((e, i) => ({
      name: e.name,
      shots: e.shots,
      difficulty: e.difficulty,
      key: `local-${e.createdAt}-${i}`,
    }));
  }, [refreshKey]);

  const [globalEntries, setGlobalEntries] = useState<DisplayEntry[] | null>(null);

  useEffect(() => {
    if (!hasBackend()) return;
    let cancelled = false;
    void fetchLeaderboard().then((list) => {
      // `null` means the request failed — keep the local fallback rather than
      // showing an empty GLOBAL board.
      if (cancelled || list === null) return;
      setGlobalEntries(
        list.slice(0, 5).map((e) => ({
          name: e.name,
          shots: e.shots,
          difficulty: e.difficulty,
          // The row id is unique even when seeded rows share a created_at
          // timestamp, so it's a safe React key.
          key: e.id,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const usingGlobal = hasBackend() && globalEntries !== null;
  // Always render fewest-shots-first and cap at five, independent of the source
  // ordering, so a slow or out-of-order response can never show a jumbled board.
  const entries = [...(usingGlobal ? globalEntries : localEntries)]
    .sort((a, b) => a.shots - b.shots)
    .slice(0, 5);
  const best = entries.length > 0 ? entries[0].shots : null;

  return (
    <div className="top-scores">
      <div className="panel-title">
        TOP SCORES
        <span className="ts-scope">{usingGlobal ? 'GLOBAL' : 'LOCAL'}</span>
      </div>
      {entries.length === 0 ? (
        <div className="top-scores-empty">NO VICTORIES YET. BE THE FIRST.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>NAME</th>
              <th>SHOTS</th>
              <th>MODE</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.key}>
                <td>{i + 1}</td>
                <td className="ts-name">{e.name}</td>
                <td className="ts-shots">{e.shots}</td>
                <td className="ts-mode">{e.difficulty.slice(0, 1).toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="top-scores-current" aria-live="polite">
        <span className="top-scores-current-label">YOUR SHOTS</span>
        <span className="top-scores-current-value">
          {inBattle || currentShots > 0 ? currentShots : '—'}
        </span>
        {best !== null && (
          <span className="top-scores-current-best">BEST {best}</span>
        )}
      </div>
    </div>
  );
}
