import { useEffect, useState } from 'react';
import { fetchLeaderboard, hasBackend } from '../api/client';
import type { LeaderboardEntry } from '../api/client';

interface LeaderboardProps {
  /** Bumped by the parent whenever a game finishes, to trigger a refresh. */
  refreshKey: number;
}

/** High-score table backed by the API. Hidden entirely if no backend exists. */
export function Leaderboard({ refreshKey }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasBackend()) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchLeaderboard();
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!hasBackend()) return null;

  return (
    <div className="leaderboard">
      <div className="panel-title">HIGH SCORES</div>
      {loading && entries.length === 0 ? (
        <div className="leaderboard-empty">LOADING...</div>
      ) : entries.length === 0 ? (
        <div className="leaderboard-empty">NO VICTORIES YET. BE THE FIRST.</div>
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
              <tr key={`${e.name}-${e.created_at}`}>
                <td>{i + 1}</td>
                <td>{e.name}</td>
                <td>{e.shots}</td>
                <td>{e.difficulty.slice(0, 1).toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
