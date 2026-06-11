import { useEffect, useRef } from 'react';
import { sound } from '../audio/sound';
import type { TauntEvent } from '../game/taunts';

/** A game event tagged with a nonce so repeats of the same event still fire. */
type PendingEvent = { event: TauntEvent; nonce: number } | null;

/** Which sound effect, if any, a given game event should play. */
const EVENT_SOUND: Partial<Record<TauntEvent, Parameters<typeof sound.play>[0]>> = {
  player_hit: 'hit',
  ai_hit: 'hit',
  player_miss: 'miss',
  ai_miss: 'miss',
  player_sunk: 'sink',
  ai_sunk: 'sink',
  player_win: 'victory',
  ai_win: 'defeat',
};

/**
 * Play the sound effect mapped to the latest game event exactly once. Driven by
 * the event's nonce so the same event type firing twice in a row still plays.
 */
export function useSoundEffects(pending: PendingEvent): void {
  const lastNonce = useRef(-1);

  useEffect(() => {
    if (!pending || lastNonce.current === pending.nonce) return;
    lastNonce.current = pending.nonce;
    const effect = EVENT_SOUND[pending.event];
    if (effect) sound.play(effect);
  }, [pending]);
}
