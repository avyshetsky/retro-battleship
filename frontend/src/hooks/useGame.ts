import { useEffect, useReducer, useRef } from 'react';
import {
  createEmptyBoard,
  fireAt,
  isFleetDestroyed,
  placeShip,
  randomFleet,
} from '../game/board';
import { createAI, registerResult } from '../game/ai';
import type { AIState, Difficulty } from '../game/ai';
import { FLEET } from '../game/constants';
import type { Board, Coord, Orientation, Phase, ShipId } from '../game/types';
import type { TauntEvent } from '../game/taunts';
import { requestAiMove, requestTaunt } from '../api/client';
import { sound } from '../audio/sound';

export interface GameState {
  phase: Phase;
  difficulty: Difficulty;
  playerBoard: Board;
  aiBoard: Board;
  aiState: AIState;
  /** Index into FLEET of the next ship to place during setup. */
  placementIndex: number;
  /** Id of an already-placed ship the player lifted to reposition, if any. */
  repositioning: ShipId | null;
  orientation: Orientation;
  taunt: string;
  log: string[];
  winner: 'player' | 'ai' | null;
  /** Increments every shot; used to drive the async AI turn exactly once. */
  turn: number;
  /** Latest taunt-worthy event, plus a nonce so repeats still fire. */
  pendingEvent: { event: TauntEvent; nonce: number } | null;
}

type Action =
  | { type: 'ROTATE' }
  | { type: 'PLACE_SHIP'; origin: Coord }
  | { type: 'PICKUP_SHIP'; id: ShipId }
  | { type: 'RANDOMIZE' }
  | { type: 'RESET_PLACEMENT' }
  | { type: 'START_GAME' }
  | { type: 'PLAYER_FIRE'; coord: Coord }
  | { type: 'AI_FIRE'; coord: Coord }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'SET_TAUNT'; text: string }
  | { type: 'NEW_GAME' };

function initialState(difficulty: Difficulty = 'hard'): GameState {
  return {
    phase: 'placement',
    difficulty,
    playerBoard: createEmptyBoard(),
    aiBoard: createEmptyBoard(),
    aiState: createAI(difficulty),
    placementIndex: 0,
    repositioning: null,
    orientation: 'horizontal',
    taunt: 'PLACE YOUR FLEET, ADMIRAL. I AM ALREADY BORED.',
    log: ['>> SYSTEM ONLINE. AWAITING FLEET DEPLOYMENT.'],
    winner: null,
    turn: 0,
    pendingEvent: null,
  };
}

function withEvent(state: GameState, event: TauntEvent): GameState {
  return { ...state, pendingEvent: { event, nonce: state.turn + 1 } };
}

function logLine(state: GameState, line: string): string[] {
  return [...state.log, line].slice(-6);
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ROTATE':
      return {
        ...state,
        orientation:
          state.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      };

    case 'PLACE_SHIP': {
      if (state.phase !== 'placement') return state;
      // While repositioning we re-place the lifted ship; otherwise we place the
      // next ship in the deployment sequence.
      const spec = state.repositioning
        ? FLEET.find((s) => s.id === state.repositioning)
        : FLEET[state.placementIndex];
      if (!spec) return state;
      const next = placeShip(
        state.playerBoard,
        spec,
        action.origin,
        state.orientation,
      );
      if (!next) return state; // illegal placement; UI plays an error sound
      if (state.repositioning) {
        return {
          ...state,
          playerBoard: next,
          repositioning: null,
          log: logLine(state, `>> ${spec.name.toUpperCase()} REPOSITIONED.`),
        };
      }
      return {
        ...state,
        playerBoard: next,
        placementIndex: state.placementIndex + 1,
        log: logLine(state, `>> ${spec.name.toUpperCase()} DEPLOYED.`),
      };
    }

    case 'PICKUP_SHIP': {
      if (state.phase !== 'placement') return state;
      if (state.repositioning) return state; // already holding a ship
      const ship = state.playerBoard.ships.find(
        (s) => s.spec.id === action.id,
      );
      if (!ship) return state;
      return {
        ...state,
        playerBoard: {
          ships: state.playerBoard.ships.filter(
            (s) => s.spec.id !== action.id,
          ),
          shots: new Map(state.playerBoard.shots),
        },
        // Adopt the lifted ship's orientation so its preview matches as it was.
        orientation: ship.orientation,
        repositioning: action.id,
        log: logLine(state, `>> ${ship.spec.name.toUpperCase()} LIFTED — PICK A NEW SPOT.`),
      };
    }

    case 'RANDOMIZE': {
      if (state.phase !== 'placement') return state;
      return {
        ...state,
        playerBoard: randomFleet(),
        placementIndex: FLEET.length,
        repositioning: null,
        log: logLine(state, '>> FLEET AUTO-DEPLOYED.'),
      };
    }

    case 'RESET_PLACEMENT':
      return {
        ...state,
        playerBoard: createEmptyBoard(),
        placementIndex: 0,
        repositioning: null,
        log: logLine(state, '>> FLEET CLEARED.'),
      };

    case 'START_GAME': {
      if (state.placementIndex < FLEET.length || state.repositioning) return state;
      return withEvent(
        {
          ...state,
          phase: 'player-turn',
          aiBoard: randomFleet(),
          aiState: createAI(state.difficulty),
          log: logLine(state, '>> BATTLE COMMENCED. FIRE AT WILL.'),
        },
        'game_start',
      );
    }

    case 'PLAYER_FIRE': {
      if (state.phase !== 'player-turn') return state;
      const { board, result } = fireAt(state.aiBoard, action.coord);
      if (result === 'already') return state;

      const turn = state.turn + 1;
      const base: GameState = { ...state, aiBoard: board, turn };

      if (result === 'miss') {
        return withEvent(
          { ...base, phase: 'ai-turn', log: logLine(state, '>> YOUR SHOT: MISS.') },
          'player_miss',
        );
      }
      if (isFleetDestroyed(board)) {
        return withEvent(
          {
            ...base,
            phase: 'game-over',
            winner: 'player',
            log: logLine(state, '>> ENEMY FLEET DESTROYED. YOU WIN!'),
          },
          'player_win',
        );
      }
      const event: TauntEvent = result === 'sunk' ? 'player_sunk' : 'player_hit';
      return withEvent(
        {
          ...base,
          phase: 'ai-turn',
          log: logLine(
            state,
            result === 'sunk' ? '>> YOUR SHOT: SHIP SUNK!' : '>> YOUR SHOT: HIT!',
          ),
        },
        event,
      );
    }

    case 'AI_FIRE': {
      if (state.phase !== 'ai-turn') return state;
      const { board, result } = fireAt(state.playerBoard, action.coord);
      if (result === 'already') return state; // AI never repeats, but be safe

      const aiState = registerResult(state.aiState, action.coord, result);
      const turn = state.turn + 1;
      const base: GameState = { ...state, playerBoard: board, aiState, turn };

      // The AI's auto-response should not emit its own taunt: each player
      // click yields exactly one taunt (from PLAYER_FIRE). The only exception
      // is the AI winning, which is a terminal, one-off line.
      if (result === 'miss') {
        return {
          ...base,
          phase: 'player-turn',
          log: logLine(state, '>> ENEMY SHOT: MISS.'),
        };
      }
      if (isFleetDestroyed(board)) {
        return withEvent(
          {
            ...base,
            phase: 'game-over',
            winner: 'ai',
            log: logLine(state, '>> YOUR FLEET DESTROYED. DEFEAT.'),
          },
          'ai_win',
        );
      }
      return {
        ...base,
        phase: 'player-turn',
        log: logLine(
          state,
          result === 'sunk' ? '>> ENEMY SHOT: SHIP SUNK!' : '>> ENEMY SHOT: HIT!',
        ),
      };
    }

    case 'SET_DIFFICULTY':
      return {
        ...state,
        difficulty: action.difficulty,
        aiState: createAI(action.difficulty),
      };

    case 'SET_TAUNT':
      return { ...state, taunt: action.text };

    case 'NEW_GAME':
      return initialState(state.difficulty);

    default:
      return state;
  }
}

export interface UseGame {
  state: GameState;
  rotate: () => void;
  placeShipAt: (origin: Coord) => void;
  pickupShip: (id: ShipId) => void;
  randomize: () => void;
  resetPlacement: () => void;
  startGame: () => void;
  fireAt: (coord: Coord) => void;
  setDifficulty: (d: Difficulty) => void;
  newGame: () => void;
  shotsFired: number;
}

export function useGame(): UseGame {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const aiTurnRef = useRef<number>(-1);
  const tauntRef = useRef<number>(-1);

  // Drive the AI's turn exactly once per transition into 'ai-turn'.
  useEffect(() => {
    if (state.phase !== 'ai-turn') return;
    if (aiTurnRef.current === state.turn) return; // already handled this turn
    aiTurnRef.current = state.turn;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const move = await requestAiMove(state.aiState);
      if (cancelled) return;
      sound.play('fire');
      dispatch({ type: 'AI_FIRE', coord: move });
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.phase, state.turn, state.aiState]);

  // Resolve taunts asynchronously (backend, with local fallback).
  useEffect(() => {
    const pending = state.pendingEvent;
    if (!pending) return;
    if (tauntRef.current === pending.nonce) return;
    tauntRef.current = pending.nonce;

    let cancelled = false;
    void (async () => {
      const text = await requestTaunt(pending.event);
      if (!cancelled) dispatch({ type: 'SET_TAUNT', text });
    })();

    return () => {
      cancelled = true;
    };
  }, [state.pendingEvent]);

  return {
    state,
    rotate: () => dispatch({ type: 'ROTATE' }),
    placeShipAt: (origin) => dispatch({ type: 'PLACE_SHIP', origin }),
    pickupShip: (id) => dispatch({ type: 'PICKUP_SHIP', id }),
    randomize: () => dispatch({ type: 'RANDOMIZE' }),
    resetPlacement: () => dispatch({ type: 'RESET_PLACEMENT' }),
    startGame: () => dispatch({ type: 'START_GAME' }),
    fireAt: (coord) => dispatch({ type: 'PLAYER_FIRE', coord }),
    setDifficulty: (d) => dispatch({ type: 'SET_DIFFICULTY', difficulty: d }),
    newGame: () => dispatch({ type: 'NEW_GAME' }),
    shotsFired: state.aiBoard.shots.size,
  };
}
