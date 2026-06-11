import { useEffect, useRef, useState } from 'react';

interface Shark {
  id: number;
  /** 'fin' just shows a dorsal fin cruising past; 'wave' surfaces and waves. */
  kind: 'fin' | 'wave';
  /** Horizontal position (%) for surfacing sharks. */
  left: number;
  /** Vertical lane (%) for cruising fins. */
  top: number;
  /** Fins swim left-to-right or right-to-left. */
  dir: 1 | -1;
}

interface SharksProps {
  /** Sharks only appear while a battle is underway. */
  active: boolean;
}

const FIN_MS = 9000;
const WAVE_MS = 4200;

/**
 * Playful ambient critters: every so often a shark surfaces over the water.
 * Most just flash a dorsal fin and cruise off; occasionally one pops up, grins,
 * and waves at the player. Purely decorative — never intercepts clicks.
 */
export function Sharks({ active }: SharksProps) {
  const [sharks, setSharks] = useState<Shark[]>([]);
  const idRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const spawn = () => {
      const wave = Math.random() < 0.4;
      const id = idRef.current++;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const shark: Shark = {
        id,
        kind: wave ? 'wave' : 'fin',
        left: 12 + Math.random() * 70,
        top: 18 + Math.random() * 60,
        dir,
      };
      setSharks((prev) => [...prev, shark]);
      const life = wave ? WAVE_MS : FIN_MS;
      window.setTimeout(() => {
        setSharks((prev) => prev.filter((s) => s.id !== id));
      }, life);

      // Schedule the next surfacing at a random, unhurried interval.
      timerRef.current = window.setTimeout(spawn, 6000 + Math.random() * 9000);
    };

    timerRef.current = window.setTimeout(spawn, 2500 + Math.random() * 4000);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="shark-layer" aria-hidden>
      {sharks.map((s) =>
        s.kind === 'fin' ? (
          <div
            key={s.id}
            className={`shark-fin ${s.dir === 1 ? 'swim-right' : 'swim-left'}`}
            style={{ top: `${s.top}%` }}
          >
            <span className="fin" />
            <span className="wake" />
          </div>
        ) : (
          <div key={s.id} className="shark-wave" style={{ left: `${s.left}%` }}>
            <div className="shark-buddy">
              <span className="shark-dorsal" />
              <span className="shark-eye" />
              <span className="shark-smile" />
              <span className="shark-arm" />
            </div>
            <span className="wake" />
          </div>
        ),
      )}
    </div>
  );
}
