import { useEffect, useRef, useState } from 'react';
import { coordKey } from '../game/board';
import { BOARD_SIZE } from '../game/constants';
import type { Board } from '../game/types';

/** Which board a shark surfaces in. */
export type SharkSide = 'player' | 'enemy';

/** A dorsal fin just cruises by; a 'wave' shark grins and waves. */
export type SharkKind = 'fin' | 'wave';

export interface BoardShark {
  id: number;
  side: SharkSide;
  /** Cell the shark surfaces in. */
  row: number;
  col: number;
  /** Direction it drifts while surfaced. */
  dir: 1 | -1;
  /** How many cells it traverses before diving (0-2). */
  span: number;
  kind: SharkKind;
  /** Lifetime in ms (surface → dive). */
  life: number;
}

const FIN_LIFE = 3200;
const WAVE_LIFE = 3800;

/** Cells that are off-limits for surfacing: ships and any fired-at cells. */
function blockedCells(board: Board): Set<string> {
  const set = new Set<string>();
  for (const ship of board.ships) {
    for (const cell of ship.cells) set.add(coordKey(cell));
  }
  for (const key of board.shots.keys()) set.add(key);
  return set;
}

function isOpen(blocked: Set<string>, row: number, col: number): boolean {
  return (
    row >= 0 &&
    row < BOARD_SIZE &&
    col >= 0 &&
    col < BOARD_SIZE &&
    !blocked.has(`${row},${col}`)
  );
}

/** Pick a surfacing spot in open water on a randomly chosen board. */
function spawnShark(playerBoard: Board, aiBoard: Board, id: number): BoardShark | null {
  const side: SharkSide = Math.random() < 0.5 ? 'player' : 'enemy';
  const board = side === 'player' ? playerBoard : aiBoard;
  const blocked = blockedCells(board);

  const open: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (isOpen(blocked, row, col)) open.push({ row, col });
    }
  }
  if (open.length === 0) return null;

  const start = open[Math.floor(Math.random() * open.length)];

  // How far it can drift while staying over open water (cap at 2 cells).
  let runRight = 0;
  while (runRight < 2 && isOpen(blocked, start.row, start.col + runRight + 1)) runRight++;
  let runLeft = 0;
  while (runLeft < 2 && isOpen(blocked, start.row, start.col - runLeft - 1)) runLeft++;

  const goRight = runRight >= runLeft;
  const dir: 1 | -1 = goRight ? 1 : -1;
  const span = goRight ? runRight : runLeft;

  const kind: SharkKind = Math.random() < 0.45 ? 'wave' : 'fin';
  // A waving shark mostly stays put to greet the player; a fin cruises further.
  const finalSpan = kind === 'wave' ? Math.min(span, 1) : span;

  return {
    id,
    side,
    row: start.row,
    col: start.col,
    dir,
    span: finalSpan,
    kind,
    life: kind === 'wave' ? WAVE_LIFE : FIN_LIFE,
  };
}

/**
 * Ambient sharks that occasionally surface in open cells of either board while a
 * battle is underway, drift a cell or two, then dive back down. Returns the
 * currently-surfaced sharks; rendering is left to the grids so each shark lands
 * in a real cell. Inactive (placement / game-over) ⇒ no sharks.
 */
export function useSharks(active: boolean, playerBoard: Board, aiBoard: Board): BoardShark[] {
  const [sharks, setSharks] = useState<BoardShark[]>([]);
  const idRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  // Always spawn against the freshest boards without restarting the scheduler.
  const boardsRef = useRef({ playerBoard, aiBoard });
  useEffect(() => {
    boardsRef.current = { playerBoard, aiBoard };
  });

  useEffect(() => {
    if (!active) return;

    const spawn = (first: boolean) => {
      const id = idRef.current++;
      const shark = spawnShark(
        boardsRef.current.playerBoard,
        boardsRef.current.aiBoard,
        id,
      );
      setSharks((prev) => {
        const base = first ? [] : prev;
        return shark ? [...base, shark] : base;
      });
      if (shark) {
        window.setTimeout(() => {
          setSharks((prev) => prev.filter((s) => s.id !== shark.id));
        }, shark.life);
      }
      timerRef.current = window.setTimeout(
        () => spawn(false),
        2600 + Math.random() * 4200,
      );
    };

    timerRef.current = window.setTimeout(() => spawn(true), 1400 + Math.random() * 2400);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [active]);

  return active ? sharks : [];
}
