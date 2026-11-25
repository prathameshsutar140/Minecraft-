import { BlockDefinition, MobType } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public volume = 0.65;
  public muted = false;
  private lastStepTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || this.volume <= 0.01) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const length = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.ctx;
  }

  private playFilteredNoise(
    freq: number,
    q: number,
    duration: number,
    gainLevel: number,
    filterType: BiquadFilterType = 'bandpass'
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.Q.setValueAtTime(q, ctx.currentTime);

    const gain = ctx.createGain();
    const g = gainLevel * this.volume;
    gain.gain.setValueAtTime(g, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(ctx.currentTime, Math.random() * 0.5, duration);
    src.stop(ctx.currentTime + duration);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainLevel: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    }

    const gain = ctx.createGain();
    const g = gainLevel * this.volume;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(g, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  public playBlockBreak(group: BlockDefinition['soundGroup']) {
    switch (group) {
      case 'stone':
        this.playFilteredNoise(1100, 1.8, 0.14, 0.35);
        this.playTone(220, 95, 0.09, 'triangle', 0.2);
        break;
      case 'wood':
        this.playFilteredNoise(650, 2.2, 0.13, 0.3);
        this.playTone(190, 110, 0.09, 'square', 0.1);
        break;
      case 'glass':
        this.playFilteredNoise(3200, 1.0, 0.18, 0.35, 'highpass');
        this.playTone(1850, 2400, 0.07, 'sine', 0.14);
        break;
      case 'sand':
      case 'snow':
      case 'leaves':
        this.playFilteredNoise(1700, 0.9, 0.14, 0.25);
        break;
      case 'water':
        this.playFilteredNoise(500, 1.5, 0.2, 0.22);
        break;
      default:
        this.playFilteredNoise(820, 1.4, 0.12, 0.28);
        this.playTone(140, 75, 0.08, 'sine', 0.15);
    }
  }

  public playBlockPlace(group: BlockDefinition['soundGroup']) {
    if (group === 'stone') {
      this.playTone(300, 140, 0.06, 'triangle', 0.22);
      this.playFilteredNoise(1300, 2.5, 0.07, 0.22);
    } else if (group === 'wood') {
      this.playTone(240, 130, 0.07, 'triangle', 0.24);
    } else {
      this.playFilteredNoise(900, 1.6, 0.07, 0.2);
    }
  }

  public playDigTick(group: BlockDefinition['soundGroup']) {
    const freq = group === 'stone' ? 1400 : group === 'wood' ? 750 : 1000;
    this.playFilteredNoise(freq, 2.5, 0.045, 0.12);
  }

  public playFootstep(group: BlockDefinition['soundGroup']) {
    const now = performance.now();
    if (now - this.lastStepTime < 310) return;
    this.lastStepTime = now;
    const freq =
      group === 'stone' ? 980 : group === 'wood' ? 540 : group === 'sand' ? 1650 : 760;
    this.playFilteredNoise(freq + Math.random() * 160, 1.8, 0.06, 0.11);
  }

  public playHit(isCritical = false) {
    this.playTone(isCritical ? 240 : 170, 65, 0.11, 'sawtooth', 0.18);
    this.playFilteredNoise(900, 1.2, 0.08, 0.22);
  }

  public playHurt() {
    this.playTone(260, 120, 0.16, 'sawtooth', 0.22);
    this.playFilteredNoise(700, 1.5, 0.12, 0.2);
  }

  public playEat() {
    this.playFilteredNoise(1200, 2.0, 0.07, 0.2);
    this.playFilteredNoise(1500, 2.2, 0.07, 0.18);
  }

  public playXpOrb() {
    const base = 780 + Math.random() * 240;
    this.playTone(base, base * 1.25, 0.09, 'sine', 0.14);
  }

  public playLevelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n, 0.18, 'triangle', 0.16, idx * 0.08);
    });
  }

  public playExplosion() {
    this.playFilteredNoise(180, 0.6, 0.65, 0.6, 'lowpass');
    this.playTone(95, 28, 0.55, 'sawtooth', 0.35);
  }

  public playCreeperHiss() {
    this.playFilteredNoise(4200, 0.7, 0.45, 0.35, 'highpass');
  }

  public playBowShoot() {
    this.playTone(440, 160, 0.12, 'triangle', 0.16);
    this.playFilteredNoise(1900, 1.5, 0.07, 0.16);
  }

  public playDoorToggle() {
    this.playTone(210, 150, 0.09, 'triangle', 0.18);
    this.playFilteredNoise(620, 2.0, 0.06, 0.14);
  }

  public playTill() {
    this.playFilteredNoise(920, 1.4, 0.09, 0.22);
    this.playTone(180, 110, 0.06, 'sine', 0.14);
  }

  public playEnchant() {
    const notes = [659.25, 880, 1174.66, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.04, 0.2, 'sine', 0.15, idx * 0.055);
    });
  }

  public playTeleport() {
    this.playTone(960, 240, 0.22, 'sine', 0.2);
    this.playFilteredNoise(1800, 1.5, 0.18, 0.18);
  }

  public playClick() {
    this.playTone(620, 480, 0.04, 'square', 0.08);
  }

  public playMobSound(type: MobType) {
    switch (type) {
      case 'sheep':
        this.playTone(320, 290, 0.24, 'sawtooth', 0.09);
        break;
      case 'cow':
        this.playTone(135, 110, 0.38, 'sawtooth', 0.11);
        break;
      case 'pig':
        this.playTone(230, 310, 0.14, 'triangle', 0.12);
        break;
      case 'zombie':
        this.playTone(125, 85, 0.35, 'sawtooth', 0.12);
        break;
      case 'skeleton':
        this.playFilteredNoise(2100, 3.5, 0.08, 0.18);
        break;
      case 'creeper':
        this.playCreeperHiss();
        break;
      case 'spider':
        this.playFilteredNoise(3200, 2.4, 0.16, 0.16, 'bandpass');
        this.playTone(460, 260, 0.12, 'sawtooth', 0.08);
        break;
      case 'enderman':
        this.playTone(180, 95, 0.42, 'sine', 0.13);
        this.playTone(390, 520, 0.25, 'triangle', 0.07, 0.08);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
