import { useState } from 'react';
import { coordKey, isSunk, shipAt } from '../game/board';
import { BOARD_SIZE, COLUMN_LABELS, ROW_LABELS } from '../game/constants';
import type { Board, CellView, Coord } from '../game/types';

interface GridProps {
  board: Board;
  /** When true, the board's own ships are visible (the player's own grid). */
  reveal: boolean;
  /** Whether cells respond to clicks/hover. */
  interactive: boolean;
  label: string;
  onCellClick?: (coord: Coord) => void;
  /** Cells to highlight as a ship-placement preview. */
  previewCells?: Set<string>;
  previewValid?: boolean;
  onCellHover?: (coord: Coord | null) => void;
}

function cellView(board: Board, c: Coord, reveal: boolean): CellView {
  const key = coordKey(c);
  const shot = board.shots.get(key);
  if (shot === 'hit') {
    const ship = shipAt(board, c);
    return ship && isSunk(ship) ? 'sunk' : 'hit';
  }
  if (shot === 'miss') return 'miss';
  if (reveal && shipAt(board, c)) return 'ship';
  return 'water';
}

export function Grid({
  board,
  reveal,
  interactive,
  label,
  onCellClick,
  previewCells,
  previewValid = true,
  onCellHover,
}: GridProps) {
  const [hover, setHover] = useState<Coord | null>(null);

  return (
    <div className="grid-wrap">
      <div className="grid-label">{label}</div>
      <div className="grid" role="grid" aria-label={label}>
        <div className="corner" aria-hidden />
        {COLUMN_LABELS.map((l) => (
          <div key={`col-${l}`} className="axis axis-col" aria-hidden>
            {l}
          </div>
        ))}
        {Array.from({ length: BOARD_SIZE }, (_, row) => (
          <FragmentRow key={`row-${row}`}>
            <div className="axis axis-row" aria-hidden>
              {ROW_LABELS[row]}
            </div>
            {Array.from({ length: BOARD_SIZE }, (_, col) => {
              const coord = { row, col };
              const key = coordKey(coord);
              const view = cellView(board, coord, reveal);
              const isPreview = previewCells?.has(key) ?? false;
              const isHover =
                interactive && hover?.row === row && hover?.col === col;
              const classes = [
                'cell',
                `cell-${view}`,
                interactive ? 'cell-interactive' : '',
                isPreview ? (previewValid ? 'cell-preview' : 'cell-preview-bad') : '',
                isHover ? 'cell-hover' : '',
                view === 'ship' && interactive ? 'cell-movable' : '',
              ]
                .filter(Boolean)
                .join(' ');
              const cellLabel = `${COLUMN_LABELS[col]}${ROW_LABELS[row]}`;
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  className={classes}
                  aria-label={`${cellLabel} ${view}`}
                  data-coord={cellLabel}
                  data-view={view}
                  disabled={!interactive}
                  onClick={() => interactive && onCellClick?.(coord)}
                  onMouseEnter={() => {
                    if (!interactive) return;
                    setHover(coord);
                    onCellHover?.(coord);
                  }}
                  onMouseLeave={() => {
                    if (!interactive) return;
                    setHover(null);
                    onCellHover?.(null);
                  }}
                >
                  <span className="cell-mark" aria-hidden>
                    {view === 'hit' || view === 'sunk' ? '✸' : view === 'miss' ? '•' : ''}
                  </span>
                </button>
              );
            })}
          </FragmentRow>
        ))}
        {/* Draw a warship silhouette over each afloat, revealed ship so the
            fleet reads as actual vessels (hull + superstructure + turrets)
            rather than plain blocks. Sunk ships drop the hull and show the
            wreck + outline below. Grid offset is +2: column 1 / row 1 are the
            axis labels. */}
        {reveal &&
          board.ships
            .filter((ship) => !isSunk(ship))
            .map((ship) => {
              const rows = ship.cells.map((c) => c.row);
              const cols = ship.cells.map((c) => c.col);
              const minRow = Math.min(...rows);
              const minCol = Math.min(...cols);
              const spanRow = Math.max(...rows) - minRow + 1;
              const spanCol = Math.max(...cols) - minCol + 1;
              const horizontal = spanCol >= spanRow;
              return (
                <div
                  key={`hull-${ship.spec.id}`}
                  className={`ship-body ${horizontal ? 'ship-h' : 'ship-v'}`}
                  style={{
                    gridColumn: `${minCol + 2} / span ${spanCol}`,
                    gridRow: `${minRow + 2} / span ${spanRow}`,
                  }}
                  aria-hidden
                >
                  <span className="ship-turret ship-aft" />
                  <span className="ship-tower" />
                  <span className="ship-turret ship-fore" />
                </div>
              );
            })}
        {/* Outline every sunk ship's full footprint so its position is clear. */}
        {board.ships.filter(isSunk).map((ship) => {
          const rows = ship.cells.map((c) => c.row);
          const cols = ship.cells.map((c) => c.col);
          const minRow = Math.min(...rows);
          const minCol = Math.min(...cols);
          const spanRow = Math.max(...rows) - minRow + 1;
          const spanCol = Math.max(...cols) - minCol + 1;
          return (
            <div
              key={`outline-${ship.spec.id}`}
              className="ship-outline"
              style={{
                gridColumn: `${minCol + 2} / span ${spanCol}`,
                gridRow: `${minRow + 2} / span ${spanRow}`,
              }}
              aria-hidden
            />
          );
        })}
      </div>
    </div>
  );
}

/** Helper so a row's label + cells share one key without an extra DOM node. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
