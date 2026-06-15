import type { ShipSpec } from './types';

/** Width/height of the (square) board. Classic Battleship is 10x10. */
export const BOARD_SIZE = 10;

/** Column labels (A..J) shown along the top of each board. */
export const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) =>
  String.fromCharCode(65 + i),
);

/** Row labels (1..10) shown down the side of each board. */
export const ROW_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) =>
  String(i + 1),
);

/** The standard Battleship fleet. */
export const FLEET: readonly ShipSpec[] = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
] as const;

/** Total number of cells occupied by a full fleet (used to detect a wipeout). */
export const TOTAL_SHIP_CELLS = FLEET.reduce((sum, s) => sum + s.size, 0);
