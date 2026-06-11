/**
 * Local high-score table, persisted in localStorage.
 *
 * The leaderboard backend is optional (the game runs fully client-side in LOCAL
 * AI MODE), so we keep a small local table of best games here. A "score" is the
 * number of shots taken to win — fewer is better — so the list is sorted
 * ascending and capped at the top few.
 */
import type { Difficulty } from './ai';

export interface ScoreEntry {
  name: string;
  shots: number;
  difficulty: Difficulty;
  createdAt: string;
}

const KEY = 'rb_top_scores';
const MAX = 5;

function load(): ScoreEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => typeof e?.name === 'string' && typeof e?.shots === 'number',
    );
  } catch {
    return [];
  }
}

function save(entries: ScoreEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage may be unavailable (private mode); scores just won't persist */
  }
}

/** Best games first (fewest shots), capped at the top `limit`. */
export function getTopScores(limit = MAX): ScoreEntry[] {
  return load()
    .sort((a, b) => a.shots - b.shots)
    .slice(0, limit);
}

/** Record a winning game and return the refreshed top list. */
export function addScore(entry: {
  name: string;
  shots: number;
  difficulty: Difficulty;
}): ScoreEntry[] {
  const next = [
    ...load(),
    { ...entry, createdAt: new Date().toISOString() },
  ]
    .sort((a, b) => a.shots - b.shots)
    .slice(0, MAX);
  save(next);
  return next;
}
