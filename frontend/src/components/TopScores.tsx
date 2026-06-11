import { useMemo } from 'react';
import { getTopScores } from '../game/scores';

interface TopScoresProps {
  /** Bumped whenever a game finishes, to refresh the table. */
  refreshKey: number;
  /** Shots the player has fired so far this game. */
  currentShots: number;
  /** Whether a battle is currently underway (so the live counter is relevant). */
  inBattle: boolean;
}

/**
 * High-score panel shown beside the battle log. Lists the five best games (won
 * with the fewest shots) and a live counter of the player's current shots so
 * they can see how they're tracking against the record.
 */
export function TopScores({ refreshKey, currentShots, inBattle }: TopScoresProps) {
  // refreshKey changes after each finished game; re-read the stored table then.
  const entries = useMemo(() => {
    void refreshKey;
    return getTopScores();
  }, [refreshKey]);
  const best = entries.length > 0 ? entries[0].shots : null;

  return (
    <div className="top-scores">
      <div className="panel-title">TOP SCORES</div>
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
              <tr key={`${e.name}-${e.createdAt}`}>
                <td>{i + 1}</td>
                <td>{e.name}</td>
                <td>{e.shots}</td>
                <td>{e.difficulty.slice(0, 1).toUpperCase()}</td>
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
