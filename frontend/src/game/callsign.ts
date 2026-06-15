/**
 * The player's callsign, remembered in localStorage so returning players don't
 * have to re-enter it. First-time visitors (no stored value) are prompted once.
 */
const KEY = 'rb_callsign';
export const DEFAULT_CALLSIGN = 'ADMIRAL';
export const MAX_CALLSIGN_LENGTH = 16;

/** The stored callsign, or `null` if this browser has never set one. */
export function loadCallsign(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export function saveCallsign(name: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, name.trim().slice(0, MAX_CALLSIGN_LENGTH));
  } catch {
    /* storage may be unavailable (private mode); just won't persist */
  }
}
