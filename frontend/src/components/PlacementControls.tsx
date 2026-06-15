import { FLEET } from '../game/constants';
import type { Orientation, ShipId, ShipSpec } from '../game/types';

/** Human-readable label (with a direction arrow) for an orientation. */
function orientationLabel(orientation: Orientation): string {
  return orientation === 'horizontal' ? 'HORIZONTAL ▶' : 'VERTICAL ▼';
}

interface PlacementControlsProps {
  /** The ship currently being placed or repositioned, if any. */
  activeSpec: ShipSpec | undefined;
  placedIds: Set<ShipId>;
  orientation: Orientation;
  /** True while the player is holding a previously-placed ship. */
  repositioning: boolean;
  /** True once every ship is on the board and nothing is being held. */
  allPlaced: boolean;
  onRotate: () => void;
  onRandomize: () => void;
  onReset: () => void;
  onStart: () => void;
}

/** The fleet dock, rotate/randomize/reset/start buttons, and contextual hint. */
export function PlacementControls({
  activeSpec,
  placedIds,
  orientation,
  repositioning,
  allPlaced,
  onRotate,
  onRandomize,
  onReset,
  onStart,
}: PlacementControlsProps) {
  return (
    <div className="placement-controls">
      <div className="dock">
        {FLEET.map((spec) => {
          const isActive = activeSpec?.id === spec.id;
          const isPlaced = placedIds.has(spec.id);
          return (
            <div
              key={spec.id}
              className={`dock-ship ${
                isActive ? 'dock-active' : isPlaced ? 'dock-placed' : ''
              }`}
            >
              <span className="dock-name">{spec.name}</span>
              <span
                className={`dock-pips${
                  isActive && orientation === 'vertical' ? ' dock-pips-v' : ''
                }`}
              >
                {'▮'.repeat(spec.size)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onRotate}>
          ROTATE: {orientationLabel(orientation)}
        </button>
        <button type="button" className="btn" onClick={onRandomize}>
          RANDOMIZE
        </button>
        <button type="button" className="btn" onClick={onReset}>
          RESET
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!allPlaced}
          onClick={onStart}
        >
          START BATTLE
        </button>
      </div>
      <p className="hint">
        {repositioning ? (
          <>
            Re-deploying <strong>{activeSpec?.name ?? 'ship'}</strong> —{' '}
            <strong className="orient">{orientationLabel(orientation)}</strong>.
            Click a free spot to drop it; ROTATE flips it.
          </>
        ) : allPlaced ? (
          <>
            Fleet deployed. <strong>Click any ship to move it</strong>, or hit
            START BATTLE.
          </>
        ) : (
          <>
            Placing <strong>{activeSpec?.name ?? 'fleet'}</strong> — orientation{' '}
            <strong className="orient">{orientationLabel(orientation)}</strong>.
            Hover your waters to preview, click to drop. Click a placed ship to
            move it; ROTATE flips direction; RANDOMIZE auto-deploys.
          </>
        )}
      </p>
    </div>
  );
}
