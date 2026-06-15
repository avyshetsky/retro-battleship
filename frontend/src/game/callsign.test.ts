import { describe, it, expect, beforeEach } from 'vitest';
import { loadCallsign, saveCallsign } from './callsign';

describe('callsign persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no callsign has been stored', () => {
    expect(loadCallsign()).toBeNull();
  });

  it('round-trips a saved callsign', () => {
    saveCallsign('MAVERICK');
    expect(loadCallsign()).toBe('MAVERICK');
  });

  it('trims whitespace and treats a blank value as unset', () => {
    saveCallsign('  GOOSE  ');
    expect(loadCallsign()).toBe('GOOSE');
    localStorage.clear();
    saveCallsign('   ');
    expect(loadCallsign()).toBeNull();
  });

  it('caps the stored callsign at 16 characters', () => {
    saveCallsign('A'.repeat(40));
    expect(loadCallsign()).toBe('A'.repeat(16));
  });
});
