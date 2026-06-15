# Bug Report & Debugging Log

This document records bugs found while building Retro Battleship and how each was
fixed. Entries are grouped by **how the bug was discovered**:

- **Section A — Caught by Devin** (pre-emptive code review, lint, unit tests, the
  focused bug hunt, and the end-to-end refactor test pass).
- **Section B — Reported by the user** (found through manual playtesting).

Each entry follows: **symptom → root cause → fix → how we verified it.**

---

## At a glance

| #  | Bug                                                        | Found by | Fixed |
| -- | ---------------------------------------------------------- | -------- | ----- |
| A1 | AI mutated React state via `targetQueue.shift()`          | Devin    | ✅    |
| A2 | Cascading re-renders from `setState` inside effects       | Devin    | ✅    |
| A3 | Game froze when the backend was slow/offline              | Devin    | ✅    |
| A4 | Ship placement allowed off-board / overlapping ships      | Devin    | ✅    |
| A5 | Repeated shots at the same cell wasted a turn             | Devin    | ✅    |
| A6 | GLOBAL leaderboard never fell back to LOCAL on fetch fail | Devin    | ✅    |
| A7 | AI abandoned a wounded ship after sinking an adjacent one | Devin    | ✅    |
| B1 | SFX toggle highlighted `OFF` in green instead of `ON`     | User     | ✅    |
| B2 | A winning score didn't appear on the leaderboard          | User     | ✅    |
| B3 | Top scores didn't persist across browsers/sessions        | User     | ✅    |
| B4 | Leaderboard briefly showed duplicate / out-of-order rows  | User     | ✅    |
| B5 | The player's name was force-saved in ALL CAPS             | User     | ✅    |

> The user also gave UI/design feedback (warship graphics, legend/score/hint
> font sizes, sharks, music timing, and matching the theme dropdown's open
> options to the closed box). Those are product changes rather than bugs, so they
> live in the PR/commit history, not in this log.

---

# Section A — Caught by Devin

Found through code review, ESLint, the unit suites, a dedicated bug hunt, and the
recorded end-to-end refactor test pass — without the user pointing them out.

## A1. AI could corrupt React state by mutating its target queue

- **Symptom:** Intermittent, hard-to-reproduce oddities in the AI's targeting
  after a hit, especially across rapid turns.
- **Root cause:** `chooseMove` in `frontend/src/game/ai.ts` selected a queued
  target with `state.targetQueue.shift()`, which **mutates** the array held in
  React state. Mutating state outside the reducer breaks React's snapshot model
  and can desync the UI from the actual game state.
- **Fix:** Made `chooseMove` pure — it now `find`s the first still-valid queued
  cell instead of shifting. Stale entries are skipped via the existing `tried`
  guard, and the queue is rebuilt immutably in `registerResult`.
- **Verified:** `ai.test.ts` ("targets neighbours after a hit", "extends along a
  line", full-game integration test) all pass, and the same logic is mirrored
  and tested server-side in `backend/tests/test_ai.py`.

## A2. Cascading re-renders from `setState` inside effects

- **Symptom:** ESLint (`react-hooks/set-state-in-effect`) flagged the taunt
  typewriter and the leaderboard loader; both called `setState` synchronously in
  an effect body, which can trigger cascading renders.
- **Root cause:** `TauntBox` reset the typewriter with a synchronous
  `setShown('')`, and `Leaderboard` called `setLoading(true)` synchronously
  before fetching.
- **Fix:** `TauntBox` now starts its interval counter at `-1` so the first tick
  renders the empty string (the reset happens inside the interval callback).
  `Leaderboard` moves `setLoading(true)` inside an async IIFE so no state is set
  synchronously in the effect body.
- **Verified:** `npm run lint` is clean; the typewriter and leaderboard behave
  identically in the browser.

## A3. Game must never break when the backend is down

- **Symptom (anticipated failure mode):** If the API is slow or offline, naive
  `fetch` calls would hang or throw, freezing the game.
- **Root cause:** Network calls for AI moves and taunts are on the critical
  gameplay path.
- **Fix:** Every API call (`requestAiMove`, `requestTaunt`, `recordGame`,
  `fetchLeaderboard`) has a 2.5s timeout and a `try/catch` that falls back to
  the local AI / local taunt catalogue. The UI shows a live backend status
  (`ONLINE` / `OFFLINE` / `LOCAL`).
- **Verified:** Playing with `VITE_API_BASE_URL` unset (LOCAL AI MODE) plays a
  full game end-to-end; killing the backend mid-game does not interrupt play.

## A4. Ship placement edge cases (off-board / overlap)

- **Symptom (guarded):** Ships could be placed running off the grid edge or
  overlapping another ship.
- **Root cause:** Placement must validate every target cell for bounds and
  occupancy.
- **Fix:** `canPlace` checks `inBounds` and occupancy for all cells; `placeShip`
  returns `null` on invalid placement, and the UI shows a red invalid-preview
  and plays an "invalid" sound instead of placing.
- **Verified:** `board.test.ts` covers "rejects placement that runs off the
  board", "rejects overlapping placement", and "allows adjacent (touching)
  ships".

## A5. Repeated shots at the same cell

- **Symptom (guarded):** Clicking an already-fired cell could waste a turn or
  double-count.
- **Root cause:** Both player and AI must treat a repeat shot as a no-op.
- **Fix:** `fireAt` returns an `already` result for previously-targeted cells;
  the UI ignores clicks on resolved cells, and the AI's `tried` set prevents it
  from ever repeating (asserted over a full-board sweep).
- **Verified:** `board.test.ts` "treats a repeated shot as a no-op"; `ai.test.ts`
  "never fires at the same cell twice over a full board sweep".

## A6. GLOBAL leaderboard never fell back to LOCAL when Supabase was unreachable

- **Symptom:** If the leaderboard fetch failed, the panel showed
  "NO VICTORIES YET" under a GLOBAL badge instead of the player's local best
  games — making a transient outage look like an empty board.
- **Root cause:** On fetch failure `globalEntries` became `[]`, which the panel
  rendered as an empty leaderboard rather than degrading to local data.
- **Fix:** `TopScores` returns `null` (not `[]`) on failure and falls back to the
  local table, keeping the board populated during an outage.
- **Verified:** `frontend/src/components/TopScores.test.tsx` (null-on-failure
  preserves the local fallback).

## A7. AI abandoned a known hit after sinking an adjacent ship

- **Symptom:** Mid-fight the AI would suddenly "play dumb" — reverting to random
  hunting even though it had already landed a hit on a second, still-afloat ship.
- **Root cause:** When the AI's line-search crossed from one ship into a touching
  ship, sinking the first ship wiped **all** tracked hits, including the hit it
  had already scored on the second ship.
- **Fix:** On a sink, only the sunk ship's cells are cleared from the tracked
  hits; hits on still-afloat adjacent ships are retained so the AI keeps hunting
  them.
- **Verified:** `frontend/src/game/ai.test.ts` (retains hits on a still-afloat
  adjacent ship after a sink).

> **End-to-end refactor test pass (no new bugs):** After decomposing the 422-line
> `App.tsx` into hooks/components, a recorded golden-path playthrough (placement →
> rotate/reposition → battle → VICTORY → leaderboard → PLAY AGAIN) confirmed the
> refactor was behavior-preserving. All five UI flows passed with no regressions.
> See `test-report.md`.

---

# Section B — Reported by the user

Found by the user through manual playtesting and reported back.

## B1. SFX toggle highlighted the wrong state

- **Symptom:** The `SFX: OFF` label was highlighted in green (the "active" color)
  while `SFX: ON` was not — the opposite of what the colors should mean.
- **Root cause:** The toggle's active/green styling was keyed to the wrong
  boolean state.
- **Fix:** `SFX ON` now highlights green when sound effects are enabled and drops
  the green when muted; the `MUSIC` toggle is unaffected.
- **Verified:** Confirmed in the browser — toggling SFX flips the green highlight
  to the correct (`ON`) state.

## B2. A winning score didn't appear on the leaderboard

- **Symptom:** The user finished a game with a record-worthy score, but it did
  not show up on the TOP SCORES board (it would only appear a game later).
- **Root cause (diagnosed by Devin after the user flagged the symptom):** On game
  over, `App.tsx` bumped `leaderboardKey` (triggering the GLOBAL re-fetch) **at
  the same time** it called `recordGame(...)`. The read raced the write, so it
  almost always returned the pre-win data.
- **Fix:** Refresh the leaderboard only **after** the save resolves —
  `void recordGame({...}).then(() => setLeaderboardKey(k => k + 1))`. This works
  for LOCAL mode too, where `recordGame` resolves instantly.
- **Verified:** `frontend/src/App.test.tsx` asserts the re-fetch fires only after
  the write resolves (read-after-write). Confirmed live in the recorded refactor
  test: a fresh win (`REFTEST 18`) appeared on the GLOBAL board **immediately**,
  ordered by shots next to the server-seeded `TESTBOT 17`.

## B3. Top scores didn't persist across browsers/sessions

- **Symptom:** Opening the game in an incognito window showed none of the
  previously set high scores — the leaderboard was effectively per-browser.
- **Root cause:** Scores were stored only in `localStorage`, which is scoped to a
  single browser profile, so other users/sessions never saw them.
- **Fix:** Added a shared backend leaderboard (Supabase Postgres + PostgREST)
  read/written by every visitor, behind a feature flag with the existing
  `localStorage` fallback. Row-level-security allows public reads and constrained
  inserts only (no edits/deletes). The badge reads **GLOBAL** when configured.
- **Verified:** Reads and constrained inserts succeed against the live project
  (edits/deletes are blocked by RLS); a score saved in one browser appears in a
  fresh incognito window, confirming cross-session persistence.

## B4. Leaderboard briefly showed duplicate / out-of-order rows on a new score

- **Symptom:** After winning with a score that tied an existing entry, the
  TOP SCORES table momentarily showed extra rows that were out of order (e.g.
  `37, 41, 37`) and even an apparent extra row. A page refresh corrected the
  order and dropped the phantom row.
- **Root cause:** The seeded high scores were inserted in a single SQL statement,
  so Postgres evaluated `now()` **once** and gave every seeded row an identical
  `created_at`. The React row key was `${name}-${created_at}`, so those rows
  shared the **same key**. Duplicate keys break React's list reconciliation,
  producing ghost/duplicated rows and stale ordering until a full remount
  (refresh) rebuilt the list.
- **Fix:** Fetch the row's unique `id` from Supabase and use it as the React key
  (`frontend/src/api/client.ts`, `frontend/src/components/TopScores.tsx`); local
  rows fold the array index into their key. `TopScores` also now sorts entries by
  shots ascending before rendering, so any out-of-order or slow response can
  never display a jumbled board.
- **Verified:** `frontend/src/components/TopScores.test.tsx` ("renders every row
  in shots order even when rows share a created_at"); confirmed in the local
  production build that the four Alex/ALEX rows render sorted (37, 37, 41, 57).

## B5. The player's name was force-saved in ALL CAPS

- **Symptom:** A score recorded as `Alex` showed up on the board as `ALEX`, even
  though the user never typed it in all caps.
- **Root cause:** `useRecordGame` upper-cased the callsign
  (`name.trim().slice(0,16).toUpperCase()`) before writing it to the leaderboard.
- **Fix:** Drop the `.toUpperCase()` and persist the name exactly as typed (still
  trimmed and capped at 16 chars, with an `ANON` fallback). The pre-existing
  `ALEX` row is leftover historical data; new wins preserve their original case.
- **Verified:** `frontend/src/hooks/useRecordGame.ts`; the full suite still
  passes and the local build records mixed-case names unchanged.

---

## Testing summary

| Suite                | Count | Status |
| -------------------- | ----- | ------ |
| Frontend (Vitest)    | 33    | ✅     |
| Backend (pytest)     | 16    | ✅     |
| Typecheck (tsc)      | —     | ✅     |
| Lint (eslint + ruff) | —     | ✅     |
| End-to-end UI pass   | 5/5   | ✅     |

## Planned follow-up (dedicated test pass)

- Property-based tests for board/AI invariants.
- Load test the backend under the 2-replica HA setup and capture traces/metrics.
- Accessibility audit (keyboard navigation, screen-reader labels).
