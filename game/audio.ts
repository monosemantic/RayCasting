// Small synthesized sound effects (WebAudio), no audio asset required.

type SfxName = "click" | "coin" | "exit-open" | "locked" | "hurt" | "warning" | "win" | "lose" | "buy";

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.6;

  // Browsers only allow audio after a user gesture.
  unlock() {
    if (this.ctx !== null) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    } catch {
      this.ctx = null;
    }
  }

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
    this.applyVolume();
  }

  private applyVolume() {
    if (this.master !== null) this.master.gain.value = this.enabled ? this.volume * 0.5 : 0;
  }

  private tone(freq: number, start: number, duration: number, type: OscillatorType, gain: number, slideTo?: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const t0 = ctx.currentTime + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env);
    env.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  play(name: SfxName) {
    if (!this.enabled || this.ctx === null || this.master === null) return;
    switch (name) {
      case "click":
        this.tone(520, 0, 0.06, "square", 0.15);
        break;
      case "coin":
        this.tone(988, 0, 0.08, "square", 0.25);
        this.tone(1319, 0.07, 0.18, "square", 0.25);
        break;
      case "exit-open":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.09, 0.22, "triangle", 0.35));
        break;
      case "locked":
        this.tone(196, 0, 0.18, "square", 0.2);
        this.tone(147, 0.12, 0.25, "square", 0.2);
        break;
      case "hurt":
        this.tone(220, 0, 0.35, "sawtooth", 0.35, 55);
        break;
      case "warning":
        this.tone(880, 0, 0.12, "square", 0.2);
        this.tone(880, 0.2, 0.12, "square", 0.2);
        break;
      case "win":
        [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.12, 0.3, "triangle", 0.35));
        break;
      case "lose":
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, i * 0.18, 0.35, "sawtooth", 0.25));
        break;
      case "buy":
        this.tone(660, 0, 0.08, "square", 0.25);
        this.tone(990, 0.08, 0.08, "square", 0.25);
        this.tone(1320, 0.16, 0.2, "square", 0.25);
        break;
    }
  }
}
