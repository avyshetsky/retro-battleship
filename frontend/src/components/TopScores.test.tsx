import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the backend client so we can drive the leaderboard fetch outcome.
vi.mock('../api/client', () => ({
  hasBackend: vi.fn(() => true),
  fetchLeaderboard: vi.fn(),
}));

import { TopScores } from './TopScores';
import { fetchLeaderboard } from '../api/client';
import { addScore } from '../game/scores';
import type { LeaderboardEntry } from '../api/client';

const mockedFetch = vi.mocked(fetchLeaderboard);

describe('TopScores leaderboard source', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedFetch.mockReset();
  });

  it('shows the GLOBAL board when the fetch succeeds', async () => {
    const rows: LeaderboardEntry[] = [
      {
        id: '1',
        name: 'GLOBOSS',
        shots: 9,
        difficulty: 'hard',
        won: true,
        created_at: '2024-01-01',
      },
    ];
    mockedFetch.mockResolvedValue(rows);

    render(<TopScores refreshKey={0} currentShots={0} inBattle={false} />);

    await waitFor(() => expect(screen.getByText('GLOBOSS')).toBeInTheDocument());
    expect(screen.getByText('GLOBAL')).toBeInTheDocument();
  });

  it('renders every row in shots order even when rows share a created_at', async () => {
    // Seeded rows inserted in one SQL statement share a created_at timestamp;
    // the id keeps React keys unique and the panel sorts by shots ascending.
    const rows: LeaderboardEntry[] = [
      { id: 'a', name: 'Alex', shots: 41, difficulty: 'hard', won: true, created_at: 'T' },
      { id: 'b', name: 'Alex', shots: 37, difficulty: 'hard', won: true, created_at: 'T' },
      { id: 'c', name: 'Alex', shots: 57, difficulty: 'hard', won: true, created_at: 'T' },
    ];
    mockedFetch.mockResolvedValue(rows);

    render(<TopScores refreshKey={0} currentShots={0} inBattle={false} />);

    await waitFor(() => expect(screen.getAllByText('Alex')).toHaveLength(3));
    const shots = screen
      .getAllByText(/^(37|41|57)$/)
      .map((el) => el.textContent);
    expect(shots).toEqual(['37', '41', '57']);
  });

  it('falls back to local scores (not an empty board) when the fetch fails', async () => {
    // A failed fetch is signalled by `null`; the panel should keep showing the
    // browser's local best games under a LOCAL badge instead of "NO VICTORIES".
    mockedFetch.mockResolvedValue(null);
    addScore({ name: 'LOCALHERO', shots: 12, difficulty: 'hard' });

    render(<TopScores refreshKey={0} currentShots={0} inBattle={false} />);

    // Give the (rejected) fetch a tick to settle.
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(screen.getByText('LOCALHERO')).toBeInTheDocument();
    expect(screen.getByText('LOCAL')).toBeInTheDocument();
    expect(screen.queryByText(/NO VICTORIES/i)).not.toBeInTheDocument();
  });
});
