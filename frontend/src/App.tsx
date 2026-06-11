import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Grid } from './components/Grid';
import { FleetStatus } from './components/FleetStatus';
import { TauntBox } from './components/TauntBox';
import { Leaderboard } from './components/Leaderboard';
import { useGame } from './hooks/useGame';
import { canPlace, coordKey, shipCells } from './game/board';
import { FLEET } from './game/constants';
import type { Coord } from './game/types';
import type { Difficulty } from './game/ai';
import { sound } from './audio/sound';
import type { MusicThemeId } from './audio/sound';
import {
  getBackendStatus,
  hasBackend,
  onBackendStatus,
  recordGame,
} from './api/client';
import type { BackendStatus } from './api/client';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function App() {
  const game = useGame();
  const { state } = game;
  const [hover, setHover] = useState<Coord | null>(null);
  const [name, setName] = useState('ADMIRAL');
  const [muted, setMuted] = useState(sound.muted);
  const [musicOn, setMusicOn] = useState(sound.musicOn);
  const [musicTheme, setMusicTheme] = useState<MusicThemeId>(sound.themeId);
  const [status, setStatus] = useState<BackendStatus>(getBackendStatus());
  const [leaderboardKey, setLeaderboardKey] = useState(0);
  const recordedRef = useRef<string>('');
  const lastSoundNonce = useRef<number>(-1);

  useEffect(() => onBackendStatus(setStatus), []);

  // Music defaults ON, but browsers block audio until a user gesture. Start it
  // on the first interaction anywhere on the page, then stop listening.
  useEffect(() => {
    const kick = () => {
      sound.unlock();
      setMusicOn(sound.musicOn);
    };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);

  // Map game events to sound effects (covers both player and AI shots).
  useEffect(() => {
    const pending = state.pendingEvent;
    if (!pending || lastSoundNonce.current === pending.nonce) return;
    lastSoundNonce.current = pending.nonce;
    switch (pending.event) {
      case 'player_hit':
      case 'ai_hit':
        sound.play('hit');
        break;
      case 'player_miss':
      case 'ai_miss':
        sound.play('miss');
        break;
      case 'player_sunk':
      case 'ai_sunk':
        sound.play('sink');
        break;
      case 'player_win':
        sound.play('victory');
        break;
      case 'ai_win':
        sound.play('defeat');
        break;
      default:
        break;
    }
  }, [state.pendingEvent]);

  // Record a finished game on the leaderboard exactly once.
  useEffect(() => {
    if (state.phase !== 'game-over' || !state.winner) return;
    const gameId = `${state.winner}-${state.turn}`;
    if (recordedRef.current === gameId) return;
    recordedRef.current = gameId;
    void recordGame({
      name: (name.trim() || 'ANON').slice(0, 16).toUpperCase(),
      won: state.winner === 'player',
      shots: game.shotsFired,
      difficulty: state.difficulty,
    }).then(() => setLeaderboardKey((k) => k + 1));
  }, [state.phase, state.winner, state.turn, name, game.shotsFired, state.difficulty]);

  const placingSpec =
    state.phase === 'placement' ? FLEET[state.placementIndex] : undefined;

  const previewCells = (() => {
    if (!placingSpec || !hover) return undefined;
    return new Set(
      shipCells(hover, state.orientation, placingSpec.size).map(coordKey),
    );
  })();
  const previewValid =
    placingSpec && hover
      ? canPlace(state.playerBoard, shipCells(hover, state.orientation, placingSpec.size))
      : true;

  const handlePlace = (coord: Coord) => {
    sound.unlock();
    if (!placingSpec) return;
    const valid = canPlace(
      state.playerBoard,
      shipCells(coord, state.orientation, placingSpec.size),
    );
    sound.play(valid ? 'place' : 'invalid');
    game.placeShipAt(coord);
  };

  const handleFire = (coord: Coord) => {
    sound.unlock();
    if (state.phase !== 'player-turn') return;
    if (state.aiBoard.shots.has(coordKey(coord))) return;
    sound.play('fire');
    game.fireAt(coord);
  };

  const allPlaced = state.placementIndex >= FLEET.length;
  const yourTurn = state.phase === 'player-turn';

  return (
    <div className="app crt">
      <div className="scanlines" aria-hidden />
      <header className="topbar">
        <h1 className="logo" data-text="BATTLESHIP">
          BATTLESHIP<span className="logo-sub">// 1984</span>
        </h1>
        <div className="toolbar">
          <label className="field">
            <span>CALLSIGN</span>
            <input
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              aria-label="Player callsign"
            />
          </label>
          <label className="field">
            <span>SKILL</span>
            <select
              value={state.difficulty}
              disabled={state.phase !== 'placement'}
              onChange={(e) => game.setDifficulty(e.target.value as Difficulty)}
              aria-label="Difficulty"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={muted}
            onClick={() => {
              sound.unlock();
              setMuted(sound.toggleMuted());
            }}
            title="Toggle sound effects"
          >
            {muted ? 'SFX OFF' : 'SFX ON'}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={musicOn}
            onClick={() => {
              sound.unlock();
              setMusicOn(sound.toggleMusic());
            }}
            title="Toggle music"
          >
            {musicOn ? 'MUSIC ON' : 'MUSIC OFF'}
          </button>
          <label className="field">
            <span>THEME</span>
            <select
              value={musicTheme}
              onChange={(e) => {
                sound.unlock();
                const id = e.target.value as MusicThemeId;
                sound.setTheme(id);
                setMusicTheme(id);
              }}
              aria-label="Music theme"
            >
              {sound.themes.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.name}
                </option>
              ))}
            </select>
          </label>
          {hasBackend() && (
            <span className={`status status-${status}`} title="Backend status">
              ● {status.toUpperCase()}
            </span>
          )}
        </div>
      </header>

      <TauntBox taunt={state.taunt} />

      <main className="boards">
        <section className="board-col">
          <Grid
            board={state.playerBoard}
            reveal
            interactive={state.phase === 'placement'}
            label="YOUR WATERS"
            onCellClick={handlePlace}
            onCellHover={setHover}
            previewCells={previewCells}
            previewValid={previewValid}
          />
          <FleetStatus board={state.playerBoard} label="YOUR FLEET" />
        </section>

        <section className="board-col">
          <Grid
            board={state.aiBoard}
            reveal={state.phase === 'game-over'}
            interactive={yourTurn}
            label="ENEMY WATERS"
            onCellClick={handleFire}
          />
          <FleetStatus board={state.aiBoard} label="ENEMY FLEET" />
          {state.phase === 'ai-turn' && (
            <div className="turn-pill">ENEMY TARGETING...</div>
          )}
          {yourTurn && <div className="turn-pill turn-pill-go">YOUR MOVE</div>}
        </section>
      </main>

      <section className="controls">
        {state.phase === 'placement' ? (
          <div className="placement-controls">
            <div className="dock">
              {FLEET.map((spec, i) => (
                <div
                  key={spec.id}
                  className={`dock-ship ${
                    i < state.placementIndex
                      ? 'dock-placed'
                      : i === state.placementIndex
                        ? 'dock-active'
                        : ''
                  }`}
                >
                  <span className="dock-name">{spec.name}</span>
                  <span
                    className={`dock-pips${
                      i === state.placementIndex &&
                      state.orientation === 'vertical'
                        ? ' dock-pips-v'
                        : ''
                    }`}
                  >
                    {'▮'.repeat(spec.size)}
                  </span>
                </div>
              ))}
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  sound.play('select');
                  game.rotate();
                }}
              >
                ROTATE:{' '}
                {state.orientation === 'horizontal'
                  ? 'HORIZONTAL ▶'
                  : 'VERTICAL ▼'}
              </button>
              <button type="button" className="btn" onClick={game.randomize}>
                RANDOMIZE
              </button>
              <button type="button" className="btn" onClick={game.resetPlacement}>
                RESET
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!allPlaced}
                onClick={() => {
                  sound.unlock();
                  sound.play('select');
                  game.startGame();
                }}
              >
                START BATTLE
              </button>
            </div>
            <p className="hint">
              Placing <strong>{placingSpec?.name ?? 'fleet'}</strong> —
              orientation{' '}
              <strong className="orient">
                {state.orientation === 'horizontal'
                  ? 'HORIZONTAL ▶'
                  : 'VERTICAL ▼'}
              </strong>
              . Hover your waters to preview, click to drop. ROTATE flips the
              direction; RANDOMIZE auto-deploys.
            </p>
          </div>
        ) : (
          <div className="battle-log">
            <div className="panel-title">BATTLE LOG</div>
            <ul>
              {state.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <Leaderboard refreshKey={leaderboardKey} />
      </section>

      {state.phase === 'game-over' && (
        <div className="overlay">
          <div className={`overlay-card ${state.winner === 'player' ? 'win' : 'lose'}`}>
            <h2>{state.winner === 'player' ? 'VICTORY!' : 'DEFEATED'}</h2>
            <p>
              {state.winner === 'player'
                ? `Enemy fleet sunk in ${game.shotsFired} shots.`
                : 'Admiral Byte sank your fleet.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                sound.unlock();
                sound.play('select');
                game.newGame();
              }}
            >
              INSERT COIN — PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <span>RETRO BATTLESHIP</span>
        <span>·</span>
        <span>{hasBackend() ? 'AI SERVED BY API' : 'LOCAL AI MODE'}</span>
      </footer>
    </div>
  );
}

export default App;
