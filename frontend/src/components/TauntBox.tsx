import { useEffect, useState } from 'react';

interface TauntBoxProps {
  taunt: string;
}

/** The AI's smack-talk panel, with a retro typewriter reveal. */
export function TauntBox({ taunt }: TauntBoxProps) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    // Start at -1 so the first tick renders an empty string (the reset),
    // keeping all setState calls inside the interval callback.
    let i = -1;
    const id = window.setInterval(() => {
      i++;
      setShown(taunt.slice(0, i));
      if (i >= taunt.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
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
