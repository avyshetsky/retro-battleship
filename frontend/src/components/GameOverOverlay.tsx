interface GameOverOverlayProps {
  winner: 'player' | 'ai';
  shots: number;
  onPlayAgain: () => void;
}

/** Full-screen win/lose card shown when a game ends. */
export function GameOverOverlay({ winner, shots, onPlayAgain }: GameOverOverlayProps) {
  const playerWon = winner === 'player';
  return (
    <div className="overlay">
      <div className={`overlay-card ${playerWon ? 'win' : 'lose'}`}>
        <h2>{playerWon ? 'VICTORY!' : 'DEFEATED'}</h2>
        <p>
          {playerWon
            ? `Enemy fleet sunk in ${shots} shots.`
            : 'Admiral Byte sank your fleet.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={onPlayAgain}>
          INSERT COIN — PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
