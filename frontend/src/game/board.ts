import { BOARD_SIZE, FLEET } from './constants';
import type {
  Board,
  Coord,
  Orientation,
  Ship,
  ShipSpec,
  ShotResult,
} from './types';

/** Serialize a coordinate to a stable string key (e.g. `"3,7"`). */
export function coordKey(c: Coord): string {
  return `${c.row},${c.col}`;
}

/** Parse a coordinate key produced by {@link coordKey}. */
export function parseKey(key: string): Coord {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

/** True if a coordinate lies on the board. */
export function inBounds(c: Coord): boolean {
  return c.row >= 0 && c.row < BOARD_SIZE && c.col >= 0 && c.col < BOARD_SIZE;
}

/** Compute the list of cells a ship would occupy from a given origin. */
export function shipCells(
  origin: Coord,
  orientation: Orientation,
  size: number,
): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < size; i++) {
    cells.push({
      row: origin.row + (orientation === 'vertical' ? i : 0),
      col: origin.col + (orientation === 'horizontal' ? i : 0),
    });
  }
  return cells;
}

/** Create an empty board with no ships and no shots. */
export function createEmptyBoard(): Board {
  return { ships: [], shots: new Map() };
}

/**
 * Whether a set of candidate cells can legally hold a new ship: every cell must
 * be in bounds and must not touch any existing ship (overlap is disallowed).
 */
export function canPlace(board: Board, cells: Coord[]): boolean {
  if (!cells.every(inBounds)) return false;
  const occupied = new Set<string>();
  for (const ship of board.ships) {
    for (const cell of ship.cells) occupied.add(coordKey(cell));
  }
  return cells.every((c) => !occupied.has(coordKey(c)));
}

/**
 * Return a new board with the given ship placed, or `null` if the placement is
 * illegal. Boards are treated as immutable: callers receive a fresh object.
 */
export function placeShip(
  board: Board,
  spec: ShipSpec,
  origin: Coord,
  orientation: Orientation,
): Board | null {
  const cells = shipCells(origin, orientation, spec.size);
  if (!canPlace(board, cells)) return null;
  const ship: Ship = { spec, origin, orientation, cells, hits: new Set() };
  return {
    ships: [...board.ships, ship],
    shots: new Map(board.shots),
  };
}

/** A simple seedable RNG so games can be made deterministic in tests. */
export type Rng = () => number;

/** Randomly place the entire fleet on a fresh board. */
export function randomFleet(rng: Rng = Math.random): Board {
  let board = createEmptyBoard();
  for (const spec of FLEET) {
    let placed = false;
    // Bounded retries: with a 10x10 board and the standard fleet this
    // practically always succeeds well within the limit.
    for (let attempt = 0; attempt < 1000 && !placed; attempt++) {
      const orientation: Orientation = rng() < 0.5 ? 'horizontal' : 'vertical';
      const maxRow =
        orientation === 'vertical' ? BOARD_SIZE - spec.size : BOARD_SIZE - 1;
      const maxCol =
        orientation === 'horizontal' ? BOARD_SIZE - spec.size : BOARD_SIZE - 1;
      const origin: Coord = {
        row: Math.floor(rng() * (maxRow + 1)),
        col: Math.floor(rng() * (maxCol + 1)),
      };
      const next = placeShip(board, spec, origin, orientation);
      if (next) {
        board = next;
        placed = true;
      }
    }
    if (!placed) {
      throw new Error(`Failed to place ${spec.name} after many attempts`);
    }
  }
  return board;
}

/** Find the ship occupying a coordinate, if any. */
export function shipAt(board: Board, c: Coord): Ship | undefined {
  const key = coordKey(c);
  return board.ships.find((ship) => ship.cells.some((cell) => coordKey(cell) === key));
}

/** Whether every cell of a ship has been hit. */
export function isSunk(ship: Ship): boolean {
  return ship.hits.size === ship.spec.size;
}

/** Whether every ship on the board has been sunk. */
export function isFleetDestroyed(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

/** Number of ships still afloat. */
export function shipsRemaining(board: Board): number {
  return board.ships.filter((s) => !isSunk(s)).length;
}

/**
 * Fire at a coordinate on `board`. Returns a new board plus the outcome. Firing
 * at a cell that was already targeted is a no-op that reports `'already'`.
 */
export function fireAt(
  board: Board,
  target: Coord,
): { board: Board; result: ShotResult; ship?: Ship } {
  const key = coordKey(target);
  if (board.shots.has(key)) {
    return { board, result: 'already' };
  }

  const ship = shipAt(board, target);
  const shots = new Map(board.shots);
  shots.set(key, ship ? 'hit' : 'miss');

  if (!ship) {
    return { board: { ...board, shots }, result: 'miss' };
  }

  // Rebuild ships immutably so the hit ship gets an updated `hits` set.
  const updatedShips = board.ships.map((s) => {
    if (s !== ship) return s;
    const hits = new Set(s.hits);
    hits.add(key);
    return { ...s, hits };
  });
  const nextBoard: Board = { ships: updatedShips, shots };
  const hitShip = updatedShips.find((s) => s.spec.id === ship.spec.id)!;
  return {
    board: nextBoard,
    result: isSunk(hitShip) ? 'sunk' : 'hit',
    ship: hitShip,
  };
}
