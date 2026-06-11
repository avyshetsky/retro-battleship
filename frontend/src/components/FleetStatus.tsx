import { isSunk } from '../game/board';
import { FLEET } from '../game/constants';
import type { Board } from '../game/types';

interface FleetStatusProps {
  /** The board whose fleet is being summarized. */
  board: Board;
  label: string;
}

/**
 * A small fleet legend that sits on the outer edge of a board. It lists each
 * ship as a compact pip bar — green while afloat, red and struck through once
 * sunk — so you can tell at a glance which ships remain without cluttering the
 * board itself.
 */
export function FleetStatus({ board, label }: FleetStatusProps) {
  const afloat = FLEET.reduce((n, spec) => {
    const ship = board.ships.find((s) => s.spec.id === spec.id);
    return n + (ship && isSunk(ship) ? 0 : 1);
  }, 0);

  return (
    <aside className="fleet-legend" aria-label={`${label} — ships remaining`}>
      <div className="fleet-legend-head">
        <span className="fleet-legend-title">{label}</span>
        <span className="fleet-legend-count">
          {afloat}/{FLEET.length}
        </span>
      </div>
      <ul className="fleet-legend-list">
        {FLEET.map((spec) => {
          const ship = board.ships.find((s) => s.spec.id === spec.id);
          const sunk = ship ? isSunk(ship) : false;
          return (
            <li
              key={spec.id}
              className={`fleet-legend-item ${sunk ? 'is-sunk' : 'is-afloat'}`}
              title={`${spec.name} — ${sunk ? 'SUNK' : 'AFLOAT'}`}
            >
              <span className="fleet-legend-pips" aria-hidden>
                {'▮'.repeat(spec.size)}
              </span>
              <span className="fleet-legend-name">{spec.name}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
