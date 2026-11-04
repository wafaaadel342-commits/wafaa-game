// Synthesized sound effects using the Web Audio API exclusively.
// Layered oscillators (sine + triangle with slight detune), smooth envelopes,
// low-pass filtering, filtered noise bursts, and ConvolverNode reverb impulse.

class SoundManager {
  private ctx: AudioContext | null = null;
  private volume: number = 0.8;
  private muted: boolean = false;
  private reverbNode: ConvolverNode | null = null;
  private reverbWet: GainNode | null = null;

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window === "undefined") return;
    try {
      const vol = localStorage.getItem("tahaddi-volume");
      if (vol !== null) {
        const parsed = Number(vol);
        if (!isNaN(parsed)) this.volume = Math.max(0, Math.min(1, parsed / 100));
      }
      const m = localStorage.getItem("tahaddi-muted");
      if (m !== null) {
        this.muted = m === "true";
      }
    } catch {
      // ignore
    }
  }

  public getVolume(): number {
    return Math.round(this.volume * 100);
  }

  public setVolume(percent: number) {
    const clamped = Math.max(0, Math.min(100, percent));
    this.volume = clamped / 100;
    try {
      localStorage.setItem("tahaddi-volume", String(clamped));
    } catch {
      // ignore
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem("tahaddi-muted", String(muted));
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    return next;
  }

  public unlock() {
    this.getContext();
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initReverb(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private initReverb(ctx: AudioContext) {
    try {
      const duration = 0.6;
      const decay = 2.8;
      const rate = ctx.sampleRate;
      const length = Math.floor(rate * duration);
      const impulse = ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.exp(-t * decay);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
      }

      const conv = ctx.createConvolver();
      conv.buffer = impulse;

      const wet = ctx.createGain();
      wet.gain.value = 0.22;

      conv.connect(wet);
      wet.connect(ctx.destination);

      this.reverbNode = conv;
      this.reverbWet = wet;
    } catch {
      // fallback gracefully if convolver fails
      this.reverbNode = null;
    }
  }

  // Helper to connect a node to both master out and optional reverb wet
  private routeWithReverb(node: AudioNode, ctx: AudioContext, sendAmount = 0.35) {
    node.connect(ctx.destination);
    if (this.reverbNode) {
      const send = ctx.createGain();
      send.gain.value = sendAmount;
      node.connect(send);
      send.connect(this.reverbNode);
    }
  }

  // 1) Card press / soft UI click
  public playCardPress() {
    this.playClick();
  }

  public playClick() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(620, now);
    osc1.frequency.exponentialRampToValueAtTime(320, now + 0.04);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(630, now);
    osc2.frequency.exponentialRampToValueAtTime(325, now + 0.04);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, now);

    const masterGain = 0.22 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(masterGain, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.05);
    osc2.stop(now + 0.05);
  }

  // 2) Page transition swoosh (filtered noise burst with gentle downward sweep)
  public playSwoosh() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.16;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + duration);

    const gain = ctx.createGain();
    const peak = 0.18 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + duration + 0.01);
  }

  // 3) Letter placed in answer slot (soft wooden pop)
  public playLetterPlaced() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(540, now);
    osc1.frequency.exponentialRampToValueAtTime(260, now + 0.065);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(820, now);
    osc2.frequency.exponentialRampToValueAtTime(380, now + 0.05);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);

    const peak = 0.28 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.08);
    osc2.stop(now + 0.08);
  }

  // 4) Letter returned to tray (soft gentle swoosh/tap)
  public playLetterReturned() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.05);

    const peak = 0.18 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 5) Shuffle letter tiles (quick rattle of micro pops)
  public playShuffle() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const clicks = [
      { time: 0, freq: 520 },
      { time: 0.035, freq: 680 },
      { time: 0.07, freq: 460 },
      { time: 0.11, freq: 610 },
    ];

    clicks.forEach(({ time, freq }) => {
      const t = start + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.025);

      const peak = 0.16 * this.volume;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.035);
    });
  }

  // 6) Hint reveal (sparkle: bright ascending chime with reverb)
  public playHintReveal() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const notes = [784, 987.77, 1174.66, 1567.98]; // G5, B5, D6, G6
    const dur = 0.06;

    notes.forEach((freq, idx) => {
      const t = start + idx * dur;
      const osc = ctx.createOscillator();
      const oscDetune = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      oscDetune.type = "triangle";
      oscDetune.frequency.setValueAtTime(freq * 1.006, t);

      const peak = 0.18 * this.volume;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      oscDetune.connect(gain);
      this.routeWithReverb(gain, ctx, 0.4);

      osc.start(t);
      oscDetune.start(t);
      osc.stop(t + 0.38);
      oscDetune.stop(t + 0.38);
    });
  }

  // 7) Word solved / correct answer: bright rising arpeggio with reverb
  public playWordSolved() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    const step = 0.07;

    notes.forEach((freq, i) => {
      const t = start + i * step;
      const osc = ctx.createOscillator();
      const oscTri = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      oscTri.type = "triangle";
      oscTri.frequency.setValueAtTime(freq * 1.004, t);

      const peak = 0.24 * this.volume;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

      osc.connect(gain);
      oscTri.connect(gain);
      this.routeWithReverb(gain, ctx, 0.45);

      osc.start(t);
      oscTri.start(t);
      osc.stop(t + 0.4);
      oscTri.stop(t + 0.4);
    });
  }

  // Alias for quiz correct answer
  public playCorrect() {
    this.playWordSolved();
  }

  // 8) Streak milestone chime (shimmering rich chord + reverb)
  public playStreakChime() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const chord = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6

    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const oscTri = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      oscTri.type = "triangle";
      oscTri.frequency.setValueAtTime(freq * 1.005, start);

      const peak = 0.16 * this.volume;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);

      osc.connect(gain);
      oscTri.connect(gain);
      this.routeWithReverb(gain, ctx, 0.5);

      osc.start(start);
      oscTri.start(start);
      osc.stop(start + 0.75);
      oscTri.stop(start + 0.75);
    });
  }

  // 9) Wrong attempt (soft low buzz with low-pass filter)
  public playWrong() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.linearRampToValueAtTime(85, now + 0.22);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(143, now);
    osc2.frequency.linearRampToValueAtTime(88, now + 0.22);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, now);

    const peak = 0.2 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.26);
    osc2.stop(now + 0.26);
  }

  // 10) Gentle tick in the last 5 seconds
  public playTick() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(940, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.022);

    const peak = 0.15 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.028);
  }

  // 11) Low tone on timeout
  public playTimeout() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(222, now);
    osc2.frequency.exponentialRampToValueAtTime(122, now + 0.35);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, now);

    const peak = 0.24 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.38);
    osc2.stop(now + 0.38);
  }

  // 12) Short 3-note start jingle when round begins
  public playStartJingle() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25]; // A4, C#5, E5
    const start = ctx.currentTime;
    const step = 0.085;

    notes.forEach((freq, i) => {
      const t = start + i * step;
      const osc = ctx.createOscillator();
      const oscTri = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      oscTri.type = "triangle";
      oscTri.frequency.setValueAtTime(freq * 1.004, t);

      const peak = 0.22 * this.volume;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);

      osc.connect(gain);
      oscTri.connect(gain);
      this.routeWithReverb(gain, ctx, 0.3);

      osc.start(t);
      oscTri.start(t);
      osc.stop(t + 0.28);
      oscTri.stop(t + 0.28);
    });
  }

  // 13) Round-complete fanfare (win variant: heroic layered chords + reverb)
  public playFanfare() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const chords = [
      { freqs: [523.25, 659.25], time: 0, dur: 0.12 }, // C5 + E5
      { freqs: [659.25, 783.99], time: 0.12, dur: 0.12 }, // E5 + G5
      { freqs: [783.99, 987.77], time: 0.24, dur: 0.15 }, // G5 + B5
      { freqs: [1046.5, 1318.51, 1567.98], time: 0.4, dur: 0.65 }, // C6 + E6 + G6 triumph
    ];

    chords.forEach(({ freqs, time, dur }) => {
      const t = start + time;
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const oscTri = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);

        oscTri.type = "triangle";
        oscTri.frequency.setValueAtTime(freq * 1.003, t);

        const peak = (0.24 / freqs.length) * this.volume;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(peak, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        oscTri.connect(gain);
        this.routeWithReverb(gain, ctx, 0.5);

        osc.start(t);
        oscTri.start(t);
        osc.stop(t + dur + 0.05);
        oscTri.stop(t + dur + 0.05);
      });
    });
  }

  // 14) Round-complete fanfare (lose / try again variant)
  public playTryAgain() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const sequence = [
      { freq: 440.0, time: 0, dur: 0.18 }, // A4
      { freq: 392.0, time: 0.18, dur: 0.18 }, // G4
      { freq: 349.23, time: 0.36, dur: 0.4 }, // F4
    ];

    sequence.forEach(({ freq, time, dur }) => {
      const t = start + time;
      const osc = ctx.createOscillator();
      const oscTri = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      oscTri.type = "triangle";
      oscTri.frequency.setValueAtTime(freq * 1.003, t);

      const peak = 0.2 * this.volume;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      oscTri.connect(gain);
      this.routeWithReverb(gain, ctx, 0.35);

      osc.start(t);
      oscTri.start(t);
      osc.stop(t + dur + 0.05);
      oscTri.stop(t + dur + 0.05);
    });
  }

  // 15) Tab switch (crisp two-tone rising pop)
  public playTabSwitch() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.05);

    const peak = 0.2 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  // 16) Tile removed / returned (alias to playLetterReturned)
  public playTileRemove() {
    this.playLetterReturned();
  }

  // 17) Hint used (alias to playHintReveal)
  public playHintUsed() {
    this.playHintReveal();
  }

  // 18) Generic sound dispatcher for backward compatibility
  public play(name?: string) {
    if (!name) {
      this.playClick();
      return;
    }
    switch (name) {
      case "correct":
      case "wordSolved":
        this.playCorrect();
        break;
      case "wrong":
        this.playWrong();
        break;
      case "click":
        this.playClick();
        break;
      case "tabSwitch":
        this.playTabSwitch();
        break;
      case "hint":
        this.playHintReveal();
        break;
      case "fanfare":
        this.playFanfare();
        break;
      case "tryAgain":
        this.playTryAgain();
        break;
      case "start":
        this.playStartJingle();
        break;
      case "tick":
        this.playTick();
        break;
      case "timeout":
        this.playTimeout();
        break;
      default:
        this.playClick();
        break;
    }
  }
}

export const sound = new SoundManager();
