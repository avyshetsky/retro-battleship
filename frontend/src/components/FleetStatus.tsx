import { isSunk, shipById } from '../game/board';
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
  const statuses = FLEET.map((spec) => {
    const ship = shipById(board, spec.id);
    return { spec, sunk: ship ? isSunk(ship) : false };
  });
  const afloat = statuses.filter((s) => !s.sunk).length;

  return (
    <aside className="fleet-legend" aria-label={`${label} — ships remaining`}>
      <div className="fleet-legend-head">
        <span className="fleet-legend-title">{label}</span>
        <span className="fleet-legend-count">
          {afloat}/{FLEET.length}
        </span>
      </div>
      <ul className="fleet-legend-list">
        {statuses.map(({ spec, sunk }) => (
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
        ))}
      </ul>
    </aside>
  );
}
