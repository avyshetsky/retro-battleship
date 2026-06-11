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
  private musicTimer: number | null = null;
  private musicStep = 0;
  private _muted = false;
  private _musicOn = false;

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
      this.master.gain.value = this._muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Unlock audio after a user interaction (required by autoplay policies). */
  unlock(): void {
    this.ensure();
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.6;
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  get musicOn(): boolean {
    return this._musicOn;
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
    env.connect(this.master!);
    src.start(start);
    src.stop(start + duration);
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'fire':
        this.tone(880, t, 0.18, 'square', this.master, 0.4);
        this.tone(440, t + 0.02, 0.18, 'square', this.master, 0.3);
        break;
      case 'hit':
        this.noise(t, 0.35, 0.6);
        this.tone(160, t, 0.3, 'sawtooth', this.master, 0.4);
        break;
      case 'miss':
        this.tone(220, t, 0.18, 'sine', this.master, 0.3);
        this.tone(140, t + 0.05, 0.22, 'sine', this.master, 0.25);
        break;
      case 'sink':
        [523, 392, 330, 196].forEach((f, i) =>
          this.tone(f, t + i * 0.12, 0.16, 'square', this.master!, 0.4),
        );
        this.noise(t, 0.5, 0.4);
        break;
      case 'place':
        this.tone(660, t, 0.08, 'square', this.master, 0.3);
        break;
      case 'select':
        this.tone(880, t, 0.05, 'square', this.master, 0.25);
        break;
      case 'invalid':
        this.tone(120, t, 0.18, 'sawtooth', this.master, 0.4);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, t + i * 0.14, 0.2, 'square', this.master!, 0.45),
        );
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) =>
          this.tone(f, t + i * 0.18, 0.25, 'sawtooth', this.master!, 0.4),
        );
        break;
    }
  }

  /** A simple looping chiptune bass/arp driven by setInterval. */
  private readonly bassLine = [110, 110, 165, 110, 147, 110, 131, 98];
  private readonly arp = [440, 554, 659, 554];

  toggleMusic(): boolean {
    if (this._musicOn) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return this._musicOn;
  }

  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || !this.musicGain || this._musicOn) return;
    this._musicOn = true;
    this.musicStep = 0;
    const stepMs = 200;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const bass = this.bassLine[this.musicStep % this.bassLine.length];
      this.tone(bass, t, 0.18, 'triangle', this.musicGain, 0.5);
      if (this.musicStep % 2 === 0) {
        const note = this.arp[(this.musicStep / 2) % this.arp.length];
        this.tone(note, t, 0.12, 'square', this.musicGain, 0.25);
      }
      this.musicStep++;
    }, stepMs);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this._musicOn = false;
  }
}

/** Shared singleton used across the UI. */
export const sound = new SoundEngine();
