interface ArtProps {
  /** Facing direction; the art is drawn facing right and flipped for left. */
  dir: 1 | -1;
}

/** A lone dorsal fin slicing through the water. */
export function SharkFin({ dir }: ArtProps) {
  return (
    <svg
      className="shk-svg shk-fin-svg"
      viewBox="0 0 48 40"
      aria-hidden
      style={dir === -1 ? { transform: 'scaleX(-1)' } : undefined}
    >
      <ellipse className="shk-ripple" cx="24" cy="34" rx="20" ry="4" />
      <path className="shk-fin2" d="M10 34 C18 30 22 14 26 6 C28 16 34 30 38 34 Z" />
    </svg>
  );
}

/** A grinning shark that surfaces and waves a fin at the player. */
export function SharkWave({ dir }: ArtProps) {
  return (
    <svg
      className="shk-svg shk-wave-svg"
      viewBox="0 0 64 56"
      aria-hidden
      style={dir === -1 ? { transform: 'scaleX(-1)' } : undefined}
    >
      <ellipse className="shk-ripple" cx="34" cy="50" rx="27" ry="5" />

      {/* tail */}
      <path className="shk-body" d="M16 30 L4 18 L10 30 L4 42 Z" />
      {/* dorsal fin */}
      <path className="shk-fin2" d="M28 12 L36 1 L42 14 Z" />
      {/* body */}
      <path
        className="shk-body"
        d="M14 30 C14 16 26 9 39 10 C51 11 59 18 60 27 C61 33 57 39 50 41
           C40 44 28 44 21 41 C16 39 14 35 14 30 Z"
      />
      {/* lighter belly */}
      <path
        className="shk-belly"
        d="M19 34 C28 42 46 42 54 37 C50 41 40 43 30 42 C24 41 20 38 19 34 Z"
      />
      {/* open grinning mouth */}
      <path className="shk-mouth" d="M43 28 C50 28 57 30 60 32 C57 39 49 41 44 39 C40 37 40 31 43 28 Z" />
      {/* teeth */}
      <path
        className="shk-teeth"
        d="M44 29 L47 33 L50 29 L53 33 L56 30 L59 32 C56 29 49 28 44 29 Z"
      />
      {/* eye */}
      <circle className="shk-eyew" cx="45" cy="22" r="4.5" />
      <circle className="shk-eye" cx="46.5" cy="23" r="2.2" />

      {/* waving pectoral fin */}
      <g className="shk-arm">
        <path className="shk-fin2" d="M26 36 C22 42 21 49 25 53 C29 49 32 42 33 37 Z" />
      </g>
    </svg>
  );
}
