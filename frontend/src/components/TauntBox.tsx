import { useEffect, useRef, useState } from 'react';

interface TauntBoxProps {
  taunt: string;
}

/** Milliseconds per character for the typewriter reveal. */
const TYPE_SPEED = 42;
/** How long a fully-typed line lingers before the next one starts. */
const DWELL_MS = 1600;

/**
 * The AI's smack-talk panel with a retro typewriter reveal.
 *
 * Taunts can fire faster than they can be read (a miss, then the enemy's
 * reply ~650ms later). To stop lines from cutting each other off, incoming
 * taunts are queued and played one at a time: each line types out fully,
 * lingers for a beat, then the next begins.
 */
export function TauntBox({ taunt }: TauntBoxProps) {
  const [shown, setShown] = useState('');
  const queue = useRef<string[]>([]);
  const typing = useRef(false);
  const lastEnqueued = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const start = useRef<() => void>(() => {});

  // Set up the play loop once. `step` is a local closure so it can schedule
  // itself; every setState happens inside a timer callback (never synchronously
  // in the effect body) to satisfy the react-hooks rules.
  useEffect(() => {
    typing.current = false;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      const next = queue.current.shift();
      if (next === undefined) {
        typing.current = false;
        return;
      }
      typing.current = true;
      // Start at -1 so the first tick renders '' (the reset).
      let i = -1;
      const typeId = window.setInterval(() => {
        i++;
        setShown(next.slice(0, i));
        if (i >= next.length) {
          window.clearInterval(typeId);
          const dwellId = window.setTimeout(step, DWELL_MS);
          timers.current.push(dwellId);
        }
      }, TYPE_SPEED);
      timers.current.push(typeId);
    };

    start.current = () => {
      if (!typing.current) step();
    };
    if (queue.current.length > 0) step();

    return () => {
      cancelled = true;
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, []);

  // Enqueue each new taunt and kick the loop if it is idle.
  useEffect(() => {
    if (!taunt || taunt === lastEnqueued.current) return;
    lastEnqueued.current = taunt;
    queue.current.push(taunt);
    start.current();
  }, [taunt]);

  return (
    <div className="taunt-box" aria-live="polite">
      <div className="taunt-avatar" aria-hidden>
        <div className="taunt-eye" />
        <div className="taunt-eye" />
        <div className="taunt-mouth" />
      </div>
      <div className="taunt-body">
        <div className="taunt-name">ADMIRAL BYTE</div>
        <div className="taunt-text">
          {shown}
          <span className="taunt-cursor">_</span>
        </div>
      </div>
    </div>
  );
}
