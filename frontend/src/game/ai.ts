import { BOARD_SIZE } from './constants';
import { coordKey, inBounds } from './board';
import type { Coord, ShotResult } from './types';
import type { Rng } from './board';

/**
 * Difficulty levels for the AI opponent.
 * - `easy`   : fires completely at random.
 * - `medium` : hunt/target — random search, then focuses around hits.
 * - `hard`   : medium plus a checkerboard "parity" search, which is the
 *              optimal way to find ships of length >= 2 with fewer shots.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Mutable memory the AI carries between shots. It only ever records the
 * results of its *own* shots — it never reads the opponent's ship positions,
 * so it plays fairly.
 */
export interface AIState {
  difficulty: Difficulty;
  /** Coordinate keys the AI has already fired at. */
  tried: Set<string>;
  /** Promising cells to try next (neighbours of unresolved hits). */
  targetQueue: Coord[];
  /** Hits belonging to the ship currently being hunted, in fire order. */
  activeHits: Coord[];
}

export function createAI(difficulty: Difficulty = 'hard'): AIState {
  return { difficulty, tried: new Set(), targetQueue: [], activeHits: [] };
}

const NEIGHBOURS: Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

function untriedNeighbours(state: AIState, c: Coord): Coord[] {
  return NEIGHBOURS.map((d) => ({ row: c.row + d.row, col: c.col + d.col }))
    .filter(inBounds)
    .filter((n) => !state.tried.has(coordKey(n)));
}

/**
 * If the AI has two or more in-line hits on the active ship, return the two
 * cells that extend that line (so it finishes ships efficiently instead of
 * poking randomly around a hit).
 */
function lineExtensions(state: AIState): Coord[] {
  const hits = state.activeHits;
  if (hits.length < 2) return [];

  const sameRow = hits.every((h) => h.row === hits[0].row);
  const sameCol = hits.every((h) => h.col === hits[0].col);
  if (!sameRow && !sameCol) return [];

  const extensions: Coord[] = [];
  if (sameRow) {
    const cols = hits.map((h) => h.col);
    const row = hits[0].row;
    extensions.push({ row, col: Math.min(...cols) - 1 });
    extensions.push({ row, col: Math.max(...cols) + 1 });
  } else {
    const rows = hits.map((h) => h.row);
    const col = hits[0].col;
    extensions.push({ row: Math.min(...rows) - 1, col });
    extensions.push({ row: Math.max(...rows) + 1, col });
  }
  return extensions.filter(inBounds).filter((c) => !state.tried.has(coordKey(c)));
}

/** All cells that have never been fired at. */
function availableCells(state: AIState): Coord[] {
  const cells: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const c = { row, col };
      if (!state.tried.has(coordKey(c))) cells.push(c);
    }
  }
  return cells;
}

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Choose the AI's next target. Pure with respect to game state — the only
 * external input is the RNG, which makes behaviour deterministic in tests.
 */
export function chooseMove(state: AIState, rng: Rng = Math.random): Coord {
  // 1. Finish a wounded ship by extending the line of hits.
  if (state.difficulty !== 'easy') {
    const extensions = lineExtensions(state);
    if (extensions.length > 0) return pick(extensions, rng);

    // 2. Otherwise probe queued neighbours of an isolated hit. We *find* rather
    //    than mutate the queue so the function stays pure (no side effects on
    //    the caller's state); stale entries are skipped via the `tried` guard.
    const queued = state.targetQueue.find(
      (c) => inBounds(c) && !state.tried.has(coordKey(c)),
    );
    if (queued) return queued;
  }

  const available = availableCells(state);

  // 3. Hard mode: search on a checkerboard so we never waste shots on cells
  //    that cannot complete a 2-cell ship until the parity set is exhausted.
  if (state.difficulty === 'hard') {
    const parityCells = available.filter((c) => (c.row + c.col) % 2 === 0);
    if (parityCells.length > 0) return pick(parityCells, rng);
  }

  return pick(available, rng);
}

/**
 * Record the result of a shot and return updated AI memory. Treated immutably:
 * the returned state is a fresh object.
 */
export function registerResult(
  state: AIState,
  target: Coord,
  result: ShotResult,
): AIState {
  if (result === 'already') return state;

  const tried = new Set(state.tried);
  tried.add(coordKey(target));

  let activeHits = state.activeHits;
  let targetQueue = state.targetQueue;

  if (result === 'hit') {
    activeHits = [...state.activeHits, target];
    targetQueue = [...state.targetQueue, ...untriedNeighbours({ ...state, tried }, target)];
  } else if (result === 'sunk') {
    // The wounded ship is finished — forget it and resume hunting from scratch.
    activeHits = [];
    targetQueue = [];
  }

  return { ...state, tried, activeHits, targetQueue };
}
