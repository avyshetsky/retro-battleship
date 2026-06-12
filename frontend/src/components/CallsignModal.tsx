import { useState } from 'react';
import { DEFAULT_CALLSIGN, MAX_CALLSIGN_LENGTH } from '../game/callsign';

interface CallsignModalProps {
  /** Called with the chosen callsign when the player confirms. */
  onConfirm: (name: string) => void;
}

/**
 * One-time welcome prompt asking a first-time player for their callsign. Once
 * confirmed it's remembered (see game/callsign.ts), so returning players never
 * see this again.
 */
export function CallsignModal({ onConfirm }: CallsignModalProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    onConfirm(trimmed || DEFAULT_CALLSIGN);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="callsign-title">
      <div className="modal">
        <div className="panel-title" id="callsign-title">
          ENTER CALLSIGN
        </div>
        <p className="modal-text">Admiral, identify yourself before you take command.</p>
        <input
          className="modal-input"
          autoFocus
          value={value}
          maxLength={MAX_CALLSIGN_LENGTH}
          placeholder={DEFAULT_CALLSIGN}
          aria-label="Enter your callsign"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button type="button" className="btn btn-primary" onClick={submit}>
          DEPLOY
        </button>
      </div>
    </div>
  );
}
