# Bug Report & Debugging Log

This document records bugs found while building Retro Battleship and how each
was fixed. It is a living document: a dedicated, exhaustive test pass is planned
as a follow-up, and its findings will be appended here.

Each entry follows: **symptom → root cause → fix → how we verified it.**

---

## 1. AI could corrupt React state by mutating its target queue

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

## 2. Cascading re-renders from `setState` inside effects

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

## 3. Game must never break when the backend is down

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

## 4. Ship placement edge cases (off-board / overlap)

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

## 5. Repeated shots at the same cell

- **Symptom (guarded):** Clicking an already-fired cell could waste a turn or
  double-count.
- **Root cause:** Both player and AI must treat a repeat shot as a no-op.
- **Fix:** `fireAt` returns an `already` result for previously-targeted cells;
  the UI ignores clicks on resolved cells, and the AI's `tried` set prevents it
  from ever repeating (asserted over a full-board sweep).
- **Verified:** `board.test.ts` "treats a repeated shot as a no-op"; `ai.test.ts`
  "never fires at the same cell twice over a full board sweep".

---

## Testing summary

| Suite                | Count | Status |
| -------------------- | ----- | ------ |
| Frontend (Vitest)    | 22    | ✅     |
| Backend (pytest)     | 14    | ✅     |
| Typecheck (tsc)      | —     | ✅     |
| Lint (eslint + ruff) | —     | ✅     |

## Planned follow-up (dedicated test pass)

- Full end-to-end UI testing (recorded golden paths) across all difficulties.
- Property-based tests for board/AI invariants.
- Load test the backend under the 2-replica HA setup and capture traces/metrics.
- Accessibility audit (keyboard navigation, screen-reader labels).
