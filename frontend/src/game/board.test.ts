import { describe, it, expect } from 'vitest';
import {
  boundingBox,
  canPlace,
  coordKey,
  createEmptyBoard,
  fireAt,
  inBounds,
  isFleetDestroyed,
  isSunk,
  parseKey,
  placeShip,
  randomFleet,
  shipAt,
  shipById,
  shipCells,
  shipsRemaining,
} from './board';
import { BOARD_SIZE, FLEET, TOTAL_SHIP_CELLS } from './constants';
import { mulberry32 } from './rng';
import type { Coord } from './types';

const carrier = FLEET[0]; // size 5
const destroyer = FLEET[4]; // size 2

describe('coordinate helpers', () => {
  it('round-trips coordinate keys', () => {
    const c: Coord = { row: 3, col: 7 };
    expect(parseKey(coordKey(c))).toEqual(c);
  });

  it('detects out-of-bounds coordinates', () => {
    expect(inBounds({ row: 0, col: 0 })).toBe(true);
    expect(inBounds({ row: 9, col: 9 })).toBe(true);
    expect(inBounds({ row: -1, col: 0 })).toBe(false);
    expect(inBounds({ row: 0, col: BOARD_SIZE })).toBe(false);
  });

  it('computes ship cells for both orientations', () => {
    expect(shipCells({ row: 0, col: 0 }, 'horizontal', 3)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
    expect(shipCells({ row: 0, col: 0 }, 'vertical', 3)).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ]);
  });
});

describe('ship placement', () => {
  it('places a ship within bounds', () => {
    const board = placeShip(createEmptyBoard(), carrier, { row: 0, col: 0 }, 'horizontal');
    expect(board).not.toBeNull();
    expect(board!.ships).toHaveLength(1);
  });

  it('rejects placement that runs off the board', () => {
    const board = placeShip(createEmptyBoard(), carrier, { row: 0, col: 8 }, 'horizontal');
    expect(board).toBeNull();
  });

  it('rejects overlapping placement', () => {
    const board = placeShip(createEmptyBoard(), carrier, { row: 0, col: 0 }, 'horizontal')!;
    const overlap = placeShip(board, destroyer, { row: 0, col: 0 }, 'vertical');
    expect(overlap).toBeNull();
  });

  it('allows adjacent (touching) ships', () => {
    const board = placeShip(createEmptyBoard(), carrier, { row: 0, col: 0 }, 'horizontal')!;
    const adjacent = placeShip(board, destroyer, { row: 1, col: 0 }, 'horizontal');
    expect(adjacent).not.toBeNull();
  });

  it('canPlace agrees with placeShip', () => {
    const board = createEmptyBoard();
    expect(canPlace(board, shipCells({ row: 0, col: 0 }, 'horizontal', 5))).toBe(true);
    expect(canPlace(board, shipCells({ row: 0, col: 8 }, 'horizontal', 5))).toBe(false);
  });
});

describe('randomFleet', () => {
  it('places the full fleet without overlaps', () => {
    const board = randomFleet(mulberry32(42));
    expect(board.ships).toHaveLength(FLEET.length);

    const occupied = new Set<string>();
    let total = 0;
    for (const ship of board.ships) {
      for (const cell of ship.cells) {
        expect(inBounds(cell)).toBe(true);
        expect(occupied.has(coordKey(cell))).toBe(false);
        occupied.add(coordKey(cell));
        total++;
      }
    }
    expect(total).toBe(TOTAL_SHIP_CELLS);
  });

  it('is deterministic for a given seed', () => {
    const a = randomFleet(mulberry32(7));
    const b = randomFleet(mulberry32(7));
    expect(a.ships.map((s) => s.cells)).toEqual(b.ships.map((s) => s.cells));
  });
});

describe('firing', () => {
  it('reports a miss on empty water', () => {
    const board = placeShip(createEmptyBoard(), destroyer, { row: 0, col: 0 }, 'horizontal')!;
    const { result } = fireAt(board, { row: 5, col: 5 });
    expect(result).toBe('miss');
  });

  it('reports a hit and then a sink', () => {
    const board = placeShip(createEmptyBoard(), destroyer, { row: 0, col: 0 }, 'horizontal')!;
    const first = fireAt(board, { row: 0, col: 0 });
    expect(first.result).toBe('hit');
    const second = fireAt(first.board, { row: 0, col: 1 });
    expect(second.result).toBe('sunk');
    expect(isFleetDestroyed(second.board)).toBe(true);
  });

  it('does not mutate the original board (immutability)', () => {
    const board = placeShip(createEmptyBoard(), destroyer, { row: 0, col: 0 }, 'horizontal')!;
    fireAt(board, { row: 0, col: 0 });
    expect(board.shots.size).toBe(0);
    expect(board.ships[0].hits.size).toBe(0);
  });

  it('treats a repeated shot as a no-op', () => {
    const board = placeShip(createEmptyBoard(), destroyer, { row: 0, col: 0 }, 'horizontal')!;
    const once = fireAt(board, { row: 0, col: 0 });
    const twice = fireAt(once.board, { row: 0, col: 0 });
    expect(twice.result).toBe('already');
    expect(twice.board).toBe(once.board);
  });

  it('tracks ships remaining', () => {
    let board = placeShip(createEmptyBoard(), destroyer, { row: 0, col: 0 }, 'horizontal')!;
    board = placeShip(board, carrier, { row: 2, col: 0 }, 'horizontal')!;
    expect(shipsRemaining(board)).toBe(2);
    board = fireAt(board, { row: 0, col: 0 }).board;
    board = fireAt(board, { row: 0, col: 1 }).board;
    expect(shipsRemaining(board)).toBe(1);
  });

  it('shipAt and isSunk behave correctly', () => {
    const board = placeShip(createEmptyBoard(), destroyer, { row: 4, col: 4 }, 'vertical')!;
    expect(shipAt(board, { row: 4, col: 4 })?.spec.id).toBe('destroyer');
    expect(shipAt(board, { row: 0, col: 0 })).toBeUndefined();
    expect(isSunk(board.ships[0])).toBe(false);
  });
});

describe('geometry + lookup helpers', () => {
  it('finds a placed ship by id and reports undefined otherwise', () => {
    const board = placeShip(createEmptyBoard(), carrier, { row: 0, col: 0 }, 'horizontal')!;
    expect(shipById(board, 'carrier')?.spec.size).toBe(5);
    expect(shipById(board, 'destroyer')).toBeUndefined();
  });

  it('computes the bounding box for horizontal and vertical footprints', () => {
    expect(boundingBox(shipCells({ row: 2, col: 3 }, 'horizontal', 4))).toEqual({
      minRow: 2,
      minCol: 3,
      spanRow: 1,
      spanCol: 4,
    });
    expect(boundingBox(shipCells({ row: 5, col: 1 }, 'vertical', 3))).toEqual({
      minRow: 5,
      minCol: 1,
      spanRow: 3,
      spanCol: 1,
    });
  });
});
