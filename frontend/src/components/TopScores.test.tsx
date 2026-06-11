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
      { name: 'GLOBOSS', shots: 9, difficulty: 'hard', won: true, created_at: '2024-01-01' },
    ];
    mockedFetch.mockResolvedValue(rows);

    render(<TopScores refreshKey={0} currentShots={0} inBattle={false} />);

    await waitFor(() => expect(screen.getByText('GLOBOSS')).toBeInTheDocument());
    expect(screen.getByText('GLOBAL')).toBeInTheDocument();
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
