import type { EngineEvent, EngineState, SynthParams, VehicleProfile } from "../types";
import { synthLoop, synthPop, synthStarter } from "./synth";

interface Voice { rpm: number; src: AudioBufferSourceNode; gain: GainNode }

const DEFAULT_SYNTH: SynthParams = { irregularity: 0.3, brightness: 1800, noise: 1, rough: 0.4 };

/** Poids de crossfade à puissance constante entre deux boucles encadrantes. */
export function crossfadeWeights(rpms: number[], rpm: number): number[] {
  const w = new Array(rpms.length).fill(0);
  if (rpm <= rpms[0]) { w[0] = 1; return w; }
  const last = rpms.length - 1;
  if (rpm >= rpms[last]) { w[last] = 1; return w; }
  let i = 0; while (rpms[i + 1] < rpm) i++;
  const x = (rpm - rpms[i]) / (rpms[i + 1] - rpms[i]);
  w[i] = Math.cos(x * Math.PI / 2); w[i + 1] = Math.sin(x * Math.PI / 2);
  return w;
}

export class AudioEngine {
  readonly ctx: AudioContext;
  private master: GainNode;
  private onBus: GainNode; private offBus: GainNode; private fxBus: GainNode;
  private on: Voice[] = []; private off: Voice[] = [];
  private pops: AudioBuffer[] = []; private starter: AudioBuffer | null = null;
  private volume = 0.8;
  private tc = 0.03;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    const shelf = ctx.createBiquadFilter(); shelf.type = "lowshelf"; shelf.frequency.value = 120; shelf.gain.value = 3;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.onBus = ctx.createGain(); this.offBus = ctx.createGain(); this.fxBus = ctx.createGain();
    this.onBus.gain.value = 0; this.offBus.gain.value = 0; this.fxBus.gain.value = 0.7;
    for (const b of [this.onBus, this.offBus, this.fxBus]) b.connect(shelf);
    shelf.connect(comp).connect(this.master).connect(ctx.destination);
  }

  /** Charge les sons du véhicule : vrais samples si fournis, sinon synthèse provisoire. */
  async load(p: VehicleProfile, base: string, onProgress?: (x: number) => void): Promise<void> {
    this.dispose();
    const sr = this.ctx.sampleRate;
    if (p.samples) {
      const dec = async (f: string) => this.ctx.decodeAudioData(await (await fetch(base + f)).arrayBuffer());
      const all = [...p.samples.onLoad, ...(p.samples.offLoad ?? [])];
      let done = 0;
      const tick = () => onProgress?.(++done / all.length);
      const onBufs = await Promise.all(p.samples.onLoad.map(async (s) => { const b = await dec(s.file); tick(); return { rpm: s.rpm, b }; }));
      const offBufs = p.samples.offLoad
        ? await Promise.all(p.samples.offLoad.map(async (s) => { const b = await dec(s.file); tick(); return { rpm: s.rpm, b }; }))
        : onBufs;
      this.on = onBufs.map((x) => this.voice(x.rpm, x.b, this.onBus));
      this.off = offBufs.map((x) => this.voice(x.rpm, x.b, this.offBus));
      if (p.samples.pops) this.pops = await Promise.all(p.samples.pops.map(dec));
    } else {
      const sp = { ...DEFAULT_SYNTH, ...p.synth };
      const rpms: number[] = [];
      for (let r = Math.max(500, Math.floor(p.idleRpm / 500) * 500); r <= p.limiterRpm + 499; r += 500) rpms.push(r);
      const total = rpms.length * 2; let done = 0;
      for (const [bank, load, bus] of [[this.on, 1, this.onBus], [this.off, 0, this.offBus]] as const) {
        for (const r of rpms) {
          const data = synthLoop(r, p.cylinders, load, sp, sr, r * 7 + load * 13 + p.cylinders);
          const buf = this.ctx.createBuffer(1, data.length, sr); buf.copyToChannel(data, 0);
          bank.push(this.voice(r, buf, bus));
          onProgress?.(++done / total);
          await new Promise((res) => setTimeout(res, 0)); // laisse respirer l'interface
        }
      }
      for (let i = 0; i < 4; i++) { const d = synthPop(sr, 100 + i); const b = this.ctx.createBuffer(1, d.length, sr); b.copyToChannel(d, 0); this.pops.push(b); }
      const s = synthStarter(sr); this.starter = this.ctx.createBuffer(1, s.length, sr); this.starter.copyToChannel(s, 0);
    }
  }

  private voice(rpm: number, buf: AudioBuffer, bus: GainNode): Voice {
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const gain = this.ctx.createGain(); gain.gain.value = 0;
    src.connect(gain).connect(bus);
    src.start(this.ctx.currentTime, Math.random() * buf.duration); // phases décorrélées
    return { rpm, src, gain };
  }

  setVolume(v: number) { this.volume = v; }

  /** Appelé ~60 fois/s. */
  update(s: EngineState, idleRpm: number): void {
    const now = this.ctx.currentTime, tc = this.tc;
    const rpm = Math.max(1, s.rpm);
    for (const bank of [this.on, this.off]) {
      const w = crossfadeWeights(bank.map((v) => v.rpm), rpm);
      bank.forEach((v, i) => {
        v.gain.gain.setTargetAtTime(w[i], now, tc);
        const rate = Math.min(1.6, Math.max(0.5, rpm / v.rpm));
        v.src.playbackRate.setTargetAtTime(rate, now, tc);
      });
    }
    // mélange en charge / hors charge (puissance constante)
    const l = Math.min(1, Math.max(0, s.load));
    this.onBus.gain.setTargetAtTime(Math.sin(l * Math.PI / 2), now, 0.025);
    this.offBus.gain.setTargetAtTime(Math.cos(l * Math.PI / 2) * 0.75, now, 0.025);
    // niveau global : monte avec le régime et la charge ; s'éteint sous le ralenti (démarrage/arrêt)
    const below = Math.min(1, rpm / idleRpm);
    const level = (0.45 + 0.35 * Math.min(1, rpm / 7000) + 0.2 * l) * below * below;
    this.master.gain.setTargetAtTime(this.volume * level, now, tc);
  }

  handle(events: EngineEvent[]): void {
    const now = this.ctx.currentTime;
    for (const e of events) {
      if (e.type === "pop" && this.pops.length) {
        const src = this.ctx.createBufferSource(); src.buffer = this.pops[Math.floor(Math.random() * this.pops.length)];
        src.playbackRate.value = 0.85 + Math.random() * 0.35;
        const g = this.ctx.createGain(); g.gain.value = 0.5 + Math.random() * 0.5;
        src.connect(g).connect(this.fxBus); src.start(now + e.delay);
      } else if (e.type === "starter" && this.starter) {
        const src = this.ctx.createBufferSource(); src.buffer = this.starter;
        const g = this.ctx.createGain(); g.gain.value = this.volume * 0.8;
        src.connect(g).connect(this.ctx.destination); src.start(now);
      }
    }
  }

  get activeVoices() { return this.on.length + this.off.length; }

  dispose() {
    for (const v of [...this.on, ...this.off]) { try { v.src.stop(); } catch { /* déjà arrêtée */ } v.src.disconnect(); v.gain.disconnect(); }
    this.on = []; this.off = []; this.pops = []; this.starter = null;
  }
}
