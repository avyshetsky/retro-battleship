/**
 * Retro sound engine built entirely on the Web Audio API.
 *
 * Rather than shipping (and depending on) external audio files, we synthesize
 * chiptune-style blips and a looping bass-line on the fly. This keeps the app
 * tiny, license-free, and resilient — there are no asset requests that can 404.
 */

type SfxName =
  | 'fire'
  | 'hit'
  | 'miss'
  | 'sink'
  | 'place'
  | 'invalid'
  | 'victory'
  | 'defeat'
  | 'select';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private _muted = false;
  private _musicOn = false;
  /** User's desired music state — defaults ON; actually starts on first gesture. */
  private _musicWanted = true;

  /** Lazily create the AudioContext (must follow a user gesture in browsers). */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      // Music and SFX have independent buses so each can be toggled alone.
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._muted ? 0 : 1;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /**
   * Unlock audio after a user interaction (required by autoplay policies).
   * If music is wanted (the default) but not yet playing, start it now that
   * we finally have a user gesture to satisfy the browser's autoplay policy.
   */
  unlock(): void {
    this.ensure();
    if (this._musicWanted && !this._musicOn) this.startMusic();
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    // Only the SFX bus is affected — music keeps playing through musicGain.
    if (this.sfxGain) this.sfxGain.gain.value = muted ? 0 : 1;
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /** Reflects the user's desired music state (what the toggle shows). */
  get musicOn(): boolean {
    return this._musicWanted;
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    type: OscillatorType,
    gainNode: GainNode,
    peak = 0.6,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(gainNode);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Short burst of filtered noise — used for hits/explosions. */
  private noise(start: number, duration: number, peak = 0.5): void {
    const ctx = this.ctx!;
    const frameCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, start);
    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain!);
    src.start(start);
    src.stop(start + duration);
  }

  /** A pitch-dropping sine "boom" — the body of an explosion. */
  private boom(
    start: number,
    fromFreq: number,
    toFreq: number,
    duration: number,
    peak: number,
    out?: GainNode,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromFreq, start);
    osc.frequency.exponentialRampToValueAtTime(toFreq, start + duration);
    env.gain.setValueAtTime(peak, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(out ?? this.sfxGain!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Punchy kick drum (pitch-dropping sine) routed through the music bus. */
  private kick(start: number): void {
    this.boom(start, 150, 50, 0.16, 0.9, this.musicGain!);
  }

  /** Snare/clap: a short band-limited noise burst on the music bus. */
  private drumNoise(
    start: number,
    duration: number,
    peak: number,
    cutoff: number,
    type: BiquadFilterType,
  ): void {
    const ctx = this.ctx!;
    const frameCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(cutoff, start);
    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain!);
    src.start(start);
    src.stop(start + duration);
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'fire':
        this.tone(880, t, 0.18, 'square', this.sfxGain, 0.4);
        this.tone(440, t + 0.02, 0.18, 'square', this.sfxGain, 0.3);
        break;
      case 'hit':
        // Punchy explosion: a pitch-dropping boom under a burst of debris noise.
        this.boom(t, 120, 42, 0.32, 0.95);
        this.noise(t, 0.4, 0.8);
        this.tone(220, t, 0.1, 'square', this.sfxGain, 0.25);
        break;
      case 'miss':
        this.tone(220, t, 0.18, 'sine', this.sfxGain, 0.3);
        this.tone(140, t + 0.05, 0.22, 'sine', this.sfxGain, 0.25);
        break;
      case 'sink': {
        // Big multi-stage detonation: deep boom, rolling debris, and a
        // descending "going down" tone sweep for that sinking-ship drama.
        this.boom(t, 170, 28, 0.6, 1.0);
        this.noise(t, 0.7, 0.75);
        this.noise(t + 0.18, 0.5, 0.5);
        this.noise(t + 0.38, 0.45, 0.35);
        [330, 262, 196, 147, 98].forEach((f, i) =>
          this.tone(f, t + i * 0.09, 0.2, 'sawtooth', this.sfxGain!, 0.4),
        );
        break;
      }
      case 'place':
        this.tone(660, t, 0.08, 'square', this.sfxGain, 0.3);
        break;
      case 'select':
        this.tone(880, t, 0.05, 'square', this.sfxGain, 0.25);
        break;
      case 'invalid':
        this.tone(120, t, 0.18, 'sawtooth', this.sfxGain, 0.4);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, t + i * 0.14, 0.2, 'square', this.sfxGain!, 0.45),
        );
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) =>
          this.tone(f, t + i * 0.18, 0.25, 'sawtooth', this.sfxGain!, 0.4),
        );
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Music: a small step sequencer that plays one of several battle themes.
  // Each theme is a 16-step loop with a bass line, a lead melody, and a drum
  // pattern (kick / snare / hat). `0` means "rest" for that step.
  // ---------------------------------------------------------------------------

  private _themeId: MusicThemeId = 'red-alert';

  /** Available music themes, in dropdown order. */
  get themes(): ReadonlyArray<{ id: MusicThemeId; name: string }> {
    return THEMES.map((t) => ({ id: t.id, name: t.name }));
  }

  get themeId(): MusicThemeId {
    return this._themeId;
  }

  /** Switch theme; if music is playing, restart on the new groove seamlessly. */
  setTheme(id: MusicThemeId): void {
    if (id === this._themeId) return;
    this._themeId = id;
    if (this._musicOn) {
      this.stopMusic();
      this.startMusic();
    }
  }

  toggleMusic(): boolean {
    this._musicWanted = !this._musicWanted;
    if (this._musicWanted) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
    return this._musicWanted;
  }

  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || !this.musicGain || this._musicOn) return;
    this._musicOn = true;
    this.musicStep = 0;
    const theme = THEMES.find((t) => t.id === this._themeId) ?? THEMES[0];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const s = this.musicStep % 16;

      const bass = theme.bass[s];
      if (bass) this.tone(bass, t, theme.stepMs / 1000, theme.bassType, this.musicGain, 0.5);

      const lead = theme.lead[s];
      if (lead) this.tone(lead, t, (theme.stepMs / 1000) * 0.9, theme.leadType, this.musicGain, 0.22);

      if (theme.kick[s]) this.kick(t);
      if (theme.snare[s]) this.drumNoise(t, 0.18, 0.5, 1800, 'bandpass');
      if (theme.hat[s]) this.drumNoise(t, 0.04, 0.25, 8000, 'highpass');

      this.musicStep++;
    }, this.themeStepMs(theme));
  }

  private themeStepMs(theme: MusicTheme): number {
    return theme.stepMs;
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this._musicOn = false;
  }
}

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

export type MusicThemeId =
  | 'red-alert'
  | 'neon-armada'
  | 'deep-six'
  | 'blitz'
  | 'victory-march';

interface MusicTheme {
  id: MusicThemeId;
  name: string;
  /** Milliseconds per 16th-note step (lower = faster/more frantic). */
  stepMs: number;
  bassType: OscillatorType;
  leadType: OscillatorType;
  /** 16-step patterns; 0 = rest. Frequencies in Hz. */
  bass: number[];
  lead: number[];
  kick: number[];
  snare: number[];
  hat: number[];
}

// Note frequencies (Hz) used by the themes below.
const C2 = 65.41, D2 = 73.42, E2 = 82.41, F2 = 87.31, G2 = 98.0, GS2 = 103.83;
const A2 = 110.0, AS2 = 116.54, C3 = 130.81;
const A3 = 220.0, C4 = 261.63, D4 = 293.66, DS4 = 311.13, E4 = 329.63, F4 = 349.23;
const G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33, DS5 = 622.25, E5 = 659.25, G5 = 783.99;

const X = 1; // drum hit, for readable patterns
const _ = 0; // rest

const THEMES: MusicTheme[] = [
  {
    id: 'red-alert',
    name: 'RED ALERT',
    stepMs: 150,
    bassType: 'sawtooth',
    leadType: 'square',
    // Driving D-minor pulse — tense and militaristic.
    bass: [D2, D2, D2, D2, A2, A2, A2, A2, AS2, AS2, AS2, AS2, A2, A2, A2, A2],
    lead: [D4, _, F4, _, A4, _, F4, _, G4, _, E4, _, D4, _, _, _],
    kick: [X, _, _, _, X, _, _, _, X, _, _, _, X, _, _, _],
    snare: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, X],
    hat: [_, X, _, X, _, X, _, X, _, X, _, X, _, X, _, X],
  },
  {
    id: 'neon-armada',
    name: 'NEON ARMADA',
    stepMs: 140,
    bassType: 'triangle',
    leadType: 'square',
    // Synthwave arpeggio cruise (A-minor).
    bass: [A2, _, _, _, A2, _, _, _, F2, _, _, _, G2, _, _, _],
    lead: [A3, C4, E4, A4, E4, C4, A3, C4, F4, A4, C5, A4, G4, D4, G4, D5],
    kick: [X, _, _, _, X, _, _, _, X, _, _, _, X, _, _, _],
    snare: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, _],
    hat: [X, _, X, _, X, _, X, _, X, _, X, _, X, _, X, _],
  },
  {
    id: 'deep-six',
    name: 'DEEP SIX',
    stepMs: 200,
    bassType: 'sine',
    leadType: 'triangle',
    // Slow, dark and ominous — the hunt beneath the waves.
    bass: [E2, _, _, _, _, _, _, _, C2, _, _, _, _, _, GS2, _],
    lead: [_, _, _, _, E4, _, _, _, _, _, _, _, DS4, _, _, _],
    kick: [X, _, _, _, _, _, _, _, X, _, _, _, _, _, _, _],
    snare: [_, _, _, _, _, _, _, _, X, _, _, _, _, _, _, _],
    hat: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, _],
  },
  {
    id: 'blitz',
    name: 'BLITZ',
    stepMs: 120,
    bassType: 'sawtooth',
    leadType: 'square',
    // Fast, aggressive chiptune march (C-minor).
    bass: [C2, C2, C2, C2, G2, G2, G2, G2, GS2, GS2, GS2, GS2, G2, G2, G2, G2],
    lead: [C5, _, _, C5, DS5, _, D5, _, C5, _, G4, _, DS5, _, D5, C5],
    kick: [X, _, X, _, X, _, X, _, X, _, X, _, X, _, X, _],
    snare: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, X],
    hat: [X, X, X, X, X, X, X, X, X, X, X, X, X, X, X, X],
  },
  {
    id: 'victory-march',
    name: 'VICTORY MARCH',
    stepMs: 160,
    bassType: 'triangle',
    leadType: 'square',
    // Bright major fanfare — for the confident admiral.
    bass: [C3, _, G2, _, C3, _, G2, _, F2, _, C3, _, G2, _, G2, _],
    lead: [C5, E5, G5, E5, C5, E5, G5, C5, A4, C5, E5, C5, G4, D5, G5, _],
    kick: [X, _, _, _, X, _, _, _, X, _, _, _, X, _, _, _],
    snare: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, _],
    hat: [_, X, _, X, _, X, _, X, _, X, _, X, _, X, _, X],
  },
];

/** Shared singleton used across the UI. */
export const sound = new SoundEngine();
