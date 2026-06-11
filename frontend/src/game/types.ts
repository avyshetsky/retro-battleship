/**
 * Core domain types for the Battleship game.
 *
 * The game logic is intentionally framework-agnostic and pure so it can be
 * unit-tested in isolation and reused on both the client and (conceptually)
 * the server.
 */

/** Orientation of a ship on the board. */
export type Orientation = 'horizontal' | 'vertical';

/** A single board coordinate. `row` and `col` are zero-indexed. */
export interface Coord {
  row: number;
  col: number;
}

/** Stable identifier for each ship class in the fleet. */
export type ShipId =
  | 'carrier'
  | 'battleship'
  | 'cruiser'
  | 'submarine'
  | 'destroyer';

/** Static description of a ship class. */
export interface ShipSpec {
  id: ShipId;
  name: string;
  size: number;
}

/** A ship placed on a board. */
export interface Ship {
  spec: ShipSpec;
  origin: Coord;
  orientation: Orientation;
  /** Every coordinate the ship occupies, in order from origin. */
  cells: Coord[];
  /** Keys (see {@link coordKey}) of cells that have been hit. */
  hits: Set<string>;
}

/** The outcome of firing at a coordinate. */
export type ShotResult = 'miss' | 'hit' | 'sunk' | 'already';

/** A player's board: their fleet plus every shot the opponent has taken. */
export interface Board {
  ships: Ship[];
  /** Map of coordinate key -> whether the shot hit a ship. */
  shots: Map<string, 'hit' | 'miss'>;
}

/** Visual state of a single cell, used by the rendering layer. */
export type CellView = 'water' | 'ship' | 'hit' | 'miss' | 'sunk';

/** Whose turn it is / overall game phase. */
export type Phase = 'placement' | 'player-turn' | 'ai-turn' | 'game-over';
