import type { EngineEvent, EngineInput, EngineState, VehicleProfile } from "../types";

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Seuils de charge (doc 03 §L3) */
export const LOAD_ON_A = 0.4;
export const LOAD_OFF_A = -0.3;

/**
 * Moteur virtuel : vitesse + accélération → régime, rapport, charge, événements.
 * Pur (pas de dépendance audio) → testable.
 */
export class VehicleModel {
  rpm = 0;
  gear = 0;
  load = 0;
  running = false;
  private t = 0;
  private lastShift = -10;
  private shiftUntil = -1;
  private limiterUntil = -1;
  private startT = -1;
  private prevLoad = 0;
  private popAcc = 0;
  private rand = Math.random;
  events: EngineEvent[] = [];

  constructor(public p: VehicleProfile) {}

  start() { this.running = true; this.startT = this.t; this.rpm = 0; this.gear = 0; this.events.push({ type: "starter" }); }
  stop() { this.running = false; }

  rpmForGear(v: number, g: number): number {
    return (v / this.p.wheelCircumferenceM) * 60 * this.p.gears[g] * this.p.finalDrive;
  }

  /** Charge déduite de l'accélération (pseudo-pédale). */
  loadFromAccel(a: number): number {
    if (a > LOAD_ON_A) return clamp(0.2 + (a - LOAD_ON_A) / (this.p.aMaxMs2 - LOAD_ON_A) * 0.8, 0.2, 1);
    if (a < LOAD_OFF_A) return 0;
    return 0.12; // croisière
  }

  update(dt: number, inp: EngineInput): EngineState {
    this.t += dt;
    const p = this.p, t = this.t;
    if (!this.running) {
      this.rpm = Math.max(0, this.rpm - dt * 2500);
      this.load = 0;
      return this.state();
    }
    // ---- séquence de démarrage ----
    const st = t - this.startT;
    if (st < 1.4) {
      let target: number;
      if (st < 0.6) target = 250;                       // démarreur
      else if (st < 0.85) target = p.idleRpm * 1.9;     // envolée
      else target = p.idleRpm * 1.15;
      const tau = st < 0.6 ? 0.1 : st < 0.85 ? 0.07 : 0.25;
      this.rpm += (target - this.rpm) * (1 - Math.exp(-dt / tau));
      this.load = st >= 0.6 && st < 0.85 ? 0.6 : 0.05;
      return this.state();
    }

    const v = Math.max(0, inp.v);
    let loadT = this.loadFromAccel(inp.a);
    if (v < 0.5 && inp.a <= LOAD_ON_A) loadT = 0; // à l'arrêt sans accélérer : ralenti pur

    // ---- boîte de vitesses ----
    const n = p.gears.length;
    const shiftUp = p.shiftUpRpm.low + (p.shiftUpRpm.high - p.shiftUpRpm.low) * Math.pow(loadT, 1.5);
    if (v < 0.5) this.gear = 0;
    else if (t - this.lastShift > 0.6) {
      if (this.gear < n - 1 && this.rpmForGear(v, this.gear) > shiftUp) this.shift(this.gear + 1);
      else if (this.gear > 0 && this.rpmForGear(v, this.gear) < p.shiftDownRpm) this.shift(this.gear - 1);
      else if (this.gear > 0 && loadT > 0.8 && this.rpmForGear(v, this.gear) < p.redlineRpm * 0.5
               && this.rpmForGear(v, this.gear - 1) < p.redlineRpm * 0.85) this.shift(this.gear - 1); // kick-down
    }
    const shifting = t < this.shiftUntil;
    if (shifting) loadT = Math.min(loadT, 0.08);

    // ---- régime cible ----
    let target = this.rpmForGear(v, this.gear);
    if (this.gear === 0) {
      // patinage d'embrayage au départ : le régime peut monter au-dessus du « régime roues »
      const launch = p.idleRpm + loadT * (Math.min(3500, p.redlineRpm * 0.45) - p.idleRpm);
      target = Math.max(target, v < 6 ? launch : 0);
    }
    target = Math.max(target, p.idleRpm);

    // ---- rupteur ----
    let limiter = false;
    if (target >= p.limiterRpm) {
      target = p.limiterRpm;
      if (this.rpm >= p.limiterRpm - 40 && loadT > 0.5 && t > this.limiterUntil + 0.05) this.limiterUntil = t + 0.07;
    }
    if (t < this.limiterUntil) { target = p.limiterRpm - 300; loadT = 0; limiter = true; }

    // ---- inertie ----
    const up = target > this.rpm;
    const tau = shifting ? 0.06 : limiter ? 0.03 : (up ? p.inertia.tauUpMs : p.inertia.tauDownMs) / 1000;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt / tau));
    const loadTau = loadT > this.load ? 0.05 : 0.08;
    this.load += (loadT - this.load) * (1 - Math.exp(-dt / loadTau));

    // ---- pétarades ----
    if (this.prevLoad > 0.45 && loadT < 0.1 && this.rpm > 3500 && !limiter && !shifting) {
      const k = 1 + Math.floor(this.rand() * 3);
      for (let i = 0; i < k; i++) this.events.push({ type: "pop", delay: 0.04 + i * (0.05 + this.rand() * 0.12) });
    }
    if (loadT === 0 && this.rpm > 3800) {
      this.popAcc += dt * 1.8 * (this.rpm / p.redlineRpm);
      if (this.popAcc > this.rand() * 4) { this.popAcc = 0; this.events.push({ type: "pop", delay: 0 }); }
    }
    this.prevLoad = loadT;
    return { ...this.state(), limiter, shifting };
  }

  private shift(g: number) {
    if (g > this.gear) { this.shiftUntil = this.t + (this.p.shiftStyle === "hard" ? 0.09 : 0.18); this.events.push({ type: "shift" }); }
    this.gear = g; this.lastShift = this.t;
  }

  state(): EngineState {
    return { rpm: this.rpm, gear: this.gear, load: this.load, running: this.running, limiter: false, shifting: false };
  }
  takeEvents(): EngineEvent[] { const e = this.events; this.events = []; return e; }
}
