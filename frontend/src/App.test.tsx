import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createEmptyBoard } from './game/board';
import { createAI } from './game/ai';
import type { GameState, UseGame } from './hooks/useGame';

// A controllable game state the mocked hook hands back to <App />.
let mockGame: UseGame;

vi.mock('./hooks/useGame', () => ({
  useGame: () => mockGame,
}));

// recordGame resolves only when we say so, letting us observe ordering.
const h = vi.hoisted(() => {
  let resolveRecord: () => void = () => {};
  const recordGame = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveRecord = resolve;
      }),
  );
  return {
    recordGame,
    fetchLeaderboard: vi.fn(async () => []),
    addScore: vi.fn(),
    settleRecord: () => resolveRecord(),
  };
});

vi.mock('./api/client', () => ({
  hasApi: () => false,
  hasBackend: () => true,
  getBackendStatus: () => 'local' as const,
  onBackendStatus: () => () => {},
  recordGame: h.recordGame,
  fetchLeaderboard: h.fetchLeaderboard,
}));

vi.mock('./game/scores', () => ({
  addScore: h.addScore,
  getTopScores: () => [],
}));

import App from './App';

function makeGame(overrides: Partial<GameState>): UseGame {
  const state: GameState = {
    phase: 'player-turn',
    difficulty: 'hard',
    playerBoard: createEmptyBoard(),
    aiBoard: createEmptyBoard(),
    aiState: createAI('hard'),
    placementIndex: 5,
    repositioning: null,
    orientation: 'horizontal',
    taunt: '',
    log: [],
    winner: null,
    turn: 0,
    pendingEvent: null,
    ...overrides,
  };
  return {
    state,
    rotate: vi.fn(),
    placeShipAt: vi.fn(),
    pickupShip: vi.fn(),
    randomize: vi.fn(),
    resetPlacement: vi.fn(),
    startGame: vi.fn(),
    fireAt: vi.fn(),
    setDifficulty: vi.fn(),
    newGame: vi.fn(),
    shotsFired: 15,
  };
}

describe('leaderboard refresh ordering on game over', () => {
  beforeEach(() => {
    h.recordGame.mockClear();
    h.fetchLeaderboard.mockClear();
    h.addScore.mockClear();
  });

  it('refreshes the leaderboard only after the score is recorded', async () => {
    mockGame = makeGame({ phase: 'player-turn', winner: null });
    const { rerender } = render(<App />);

    // Initial GLOBAL fetch on mount.
    await vi.waitFor(() => expect(h.fetchLeaderboard).toHaveBeenCalledTimes(1));

    // Transition to a player victory.
    mockGame = makeGame({ phase: 'game-over', winner: 'player', turn: 10 });
    rerender(<App />);

    // The score must be submitted, but the refresh must NOT fire yet — the
    // record promise is still pending.
    await vi.waitFor(() => expect(h.recordGame).toHaveBeenCalledTimes(1));
    expect(h.addScore).toHaveBeenCalledTimes(1);
    expect(h.fetchLeaderboard).toHaveBeenCalledTimes(1);

    // Once the write resolves, the leaderboard refreshes (read-after-write).
    h.settleRecord();
    await vi.waitFor(() => expect(h.fetchLeaderboard).toHaveBeenCalledTimes(2));
  });
});
