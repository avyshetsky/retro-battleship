import { isSunk } from '../game/board';
import { FLEET } from '../game/constants';
import type { Board } from '../game/types';

interface FleetStatusProps {
  /** The board whose fleet is being summarized. */
  board: Board;
  label: string;
}

/**
 * A compact roster showing, at a glance, which ships in a board's fleet are
 * still afloat versus already sunk. Sunk ships are dimmed and struck through.
 */
export function FleetStatus({ board, label }: FleetStatusProps) {
  const afloat = FLEET.reduce((n, spec) => {
    const ship = board.ships.find((s) => s.spec.id === spec.id);
    return n + (ship && isSunk(ship) ? 0 : 1);
  }, 0);

  return (
    <div className="fleet-status">
      <span className="fleet-status-label">
        {label} · {afloat}/{FLEET.length} AFLOAT
      </span>
      <div className="fleet-status-ships">
        {FLEET.map((spec) => {
          const ship = board.ships.find((s) => s.spec.id === spec.id);
          const sunk = ship ? isSunk(ship) : false;
          return (
            <div
              key={spec.id}
              className={`fleet-ship ${sunk ? 'fleet-ship-sunk' : 'fleet-ship-afloat'}`}
              title={`${spec.name} — ${sunk ? 'SUNK' : 'AFLOAT'}`}
            >
              <span className="fleet-ship-pips" aria-hidden>
                {'▮'.repeat(spec.size)}
              </span>
              <span className="fleet-ship-name">{spec.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
