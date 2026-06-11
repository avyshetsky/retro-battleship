import { describe, it, expect } from 'vitest';
import { chooseMove, createAI, registerResult } from './ai';
import { coordKey, createEmptyBoard, fireAt, isFleetDestroyed, placeShip } from './board';
import { BOARD_SIZE, FLEET } from './constants';
import { mulberry32 } from './rng';
import type { AIState } from './ai';
import type { Coord } from './types';

describe('AI move selection', () => {
  it('never fires at the same cell twice over a full board sweep', () => {
    const rng = mulberry32(123);
    let state = createAI('hard');
    const seen = new Set<string>();
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const move = chooseMove(state, rng);
      const key = coordKey(move);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      // pretend everything is a miss so the AI keeps hunting
      state = registerResult(state, move, 'miss');
    }
    expect(seen.size).toBe(BOARD_SIZE * BOARD_SIZE);
  });

  it('hard mode searches the checkerboard first', () => {
    const rng = mulberry32(99);
    let state = createAI('hard');
    for (let i = 0; i < 50; i++) {
      const move = chooseMove(state, rng);
      expect((move.row + move.col) % 2).toBe(0);
      state = registerResult(state, move, 'miss');
    }
  });

  it('targets neighbours after a hit', () => {
    let state: AIState = createAI('medium');
    const hit: Coord = { row: 5, col: 5 };
    state = registerResult(state, hit, 'hit');
    const rng = mulberry32(1);
    const next = chooseMove(state, rng);
    const isNeighbour =
      Math.abs(next.row - hit.row) + Math.abs(next.col - hit.col) === 1;
    expect(isNeighbour).toBe(true);
  });

  it('extends along a line once two hits are in a row', () => {
    let state: AIState = createAI('medium');
    state = registerResult(state, { row: 5, col: 5 }, 'hit');
    state = registerResult(state, { row: 5, col: 6 }, 'hit');
    const next = chooseMove(state, mulberry32(2));
    // Must continue the horizontal line: col 4 or col 7 on row 5.
    expect(next.row).toBe(5);
    expect([4, 7]).toContain(next.col);
  });

  it('clears its target memory after sinking a ship', () => {
    let state: AIState = createAI('medium');
    state = registerResult(state, { row: 5, col: 5 }, 'hit');
    state = registerResult(state, { row: 5, col: 6 }, 'sunk');
    expect(state.activeHits).toHaveLength(0);
    expect(state.targetQueue).toHaveLength(0);
  });

  it('keeps hunting a wounded adjacent ship after sinking its neighbour', () => {
    // Ship A sits at (5,5)-(5,6); ship B (still afloat) sits at (5,7)-(5,8).
    // The AI hits A then crosses into B before finishing A.
    let state: AIState = createAI('medium');
    state = registerResult(state, { row: 5, col: 6 }, 'hit'); // ship A
    state = registerResult(state, { row: 5, col: 7 }, 'hit'); // ship B
    // Sinking A must NOT discard the live hit on B.
    state = registerResult(state, { row: 5, col: 5 }, 'sunk', [
      { row: 5, col: 5 },
      { row: 5, col: 6 },
    ]);

    expect(state.activeHits).toEqual([{ row: 5, col: 7 }]);
    // It should immediately resume hunting around B's known hit, never the
    // already-sunk ship A's cells.
    const next = chooseMove(state, mulberry32(7));
    const isNeighbourOfB =
      Math.abs(next.row - 5) + Math.abs(next.col - 7) === 1;
    expect(isNeighbourOfB).toBe(true);
    expect([coordKey({ row: 5, col: 5 }), coordKey({ row: 5, col: 6 })]).not.toContain(
      coordKey(next),
    );
  });
});

describe('AI can finish a full game', () => {
  it('eventually destroys an entire fleet', () => {
    const rng = mulberry32(2024);
    let board = createEmptyBoard();
    // deterministic fleet
    let row = 0;
    for (const spec of FLEET) {
      board = placeShip(board, spec, { row, col: 0 }, 'horizontal')!;
      row += 2;
    }
    let state = createAI('hard');
    let shots = 0;
    while (!isFleetDestroyed(board) && shots < BOARD_SIZE * BOARD_SIZE) {
      const move = chooseMove(state, rng);
      const outcome = fireAt(board, move);
      board = outcome.board;
      state = registerResult(state, move, outcome.result);
      shots++;
    }
    expect(isFleetDestroyed(board)).toBe(true);
    expect(shots).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
  });
});
