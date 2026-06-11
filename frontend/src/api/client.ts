/**
 * Thin client for the Battleship backend.
 *
 * The backend serves the AI opponent's moves and taunts and records games on a
 * leaderboard. Crucially, every call degrades gracefully: if the API is slow,
 * unreachable, or returns an error, we transparently fall back to the local
 * copy of the same logic so the game never breaks. This is what lets us run the
 * backend in HA (or even take it down entirely) without ruining the experience.
 */
import { chooseMove as localChooseMove } from '../game/ai';
import type { AIState, Difficulty } from '../game/ai';
import { getTaunt as localGetTaunt } from '../game/taunts';
import type { TauntEvent } from '../game/taunts';
import type { Coord } from '../game/types';

/** Base URL of the backend API, injected at build time. Empty => local only. */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/** How long to wait for the backend before falling back to local logic. */
const TIMEOUT_MS = 2500;

/** Whether a backend is configured at all. */
export function hasBackend(): boolean {
  return API_BASE.length > 0;
}

/** Tracks the most recent backend connectivity so the UI can show a badge. */
export type BackendStatus = 'unknown' | 'online' | 'offline' | 'local';

let lastStatus: BackendStatus = hasBackend() ? 'unknown' : 'local';
const listeners = new Set<(s: BackendStatus) => void>();

export function getBackendStatus(): BackendStatus {
  return lastStatus;
}

export function onBackendStatus(fn: (s: BackendStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(s: BackendStatus): void {
  if (s === lastStatus) return;
  lastStatus = s;
  for (const fn of listeners) fn(s);
}

/** Fetch with a timeout that never throws past the caller's catch. */
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the backend for the AI's next move. Falls back to the local AI on any
 * failure. The AI's memory always lives on the client, which keeps the backend
 * stateless and therefore easy to scale horizontally.
 */
export async function requestAiMove(state: AIState): Promise<Coord> {
  if (hasBackend()) {
    try {
      const data = await fetchJson<{ move: Coord }>('/api/ai/move', {
        method: 'POST',
        body: JSON.stringify({
          difficulty: state.difficulty,
          tried: [...state.tried],
          active_hits: state.activeHits,
          target_queue: state.targetQueue,
        }),
      });
      setStatus('online');
      return data.move;
    } catch {
      setStatus('offline');
    }
  }
  return localChooseMove(state);
}

/** Ask the backend for a taunt; fall back to the local catalogue. */
export async function requestTaunt(event: TauntEvent): Promise<string> {
  if (hasBackend()) {
    try {
      const data = await fetchJson<{ text: string }>('/api/taunt', {
        method: 'POST',
        body: JSON.stringify({ event }),
      });
      setStatus('online');
      return data.text;
    } catch {
      setStatus('offline');
    }
  }
  return localGetTaunt(event);
}

export interface LeaderboardEntry {
  name: string;
  won: boolean;
  shots: number;
  difficulty: Difficulty;
  created_at: string;
}

/** Record a finished game. Silently no-ops if the backend is unavailable. */
export async function recordGame(entry: {
  name: string;
  won: boolean;
  shots: number;
  difficulty: Difficulty;
}): Promise<void> {
  if (!hasBackend()) return;
  try {
    await fetchJson('/api/games', { method: 'POST', body: JSON.stringify(entry) });
    setStatus('online');
  } catch {
    setStatus('offline');
  }
}

/** Fetch the top leaderboard entries. Returns an empty list on failure. */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!hasBackend()) return [];
  try {
    const data = await fetchJson<{ entries: LeaderboardEntry[] }>('/api/leaderboard');
    setStatus('online');
    return data.entries;
  } catch {
    setStatus('offline');
    return [];
  }
}
