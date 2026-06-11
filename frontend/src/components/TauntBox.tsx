import { useEffect, useState } from 'react';

interface TauntBoxProps {
  taunt: string;
}

/** Milliseconds per character for the typewriter reveal. */
const TYPE_SPEED = 42;

/**
 * The AI's smack-talk panel with a retro typewriter reveal.
 *
 * Only the most recent taunt is ever shown. A new taunt immediately cancels
 * any in-progress reveal and types itself out instead — so clicking rapidly
 * (e.g. hunting for a ship) never queues up a backlog, and once taunts stop
 * arriving the last line simply stays put.
 */
export function TauntBox({ taunt }: TauntBoxProps) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!taunt) return;
    // Start at -1 so the first tick renders '' (the reset) without calling
    // setState synchronously in the effect body.
    let i = -1;
    const typeId = window.setInterval(() => {
      i++;
      setShown(taunt.slice(0, i));
      if (i >= taunt.length) window.clearInterval(typeId);
    }, TYPE_SPEED);
    return () => window.clearInterval(typeId);
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
