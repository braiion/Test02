import type { EngineEvent, EngineInput, EngineState, VehicleProfile } from "../types";
import { DRIVE_MODES, type DriveMode } from "./driveModes";
import { PerfCurve, mapSpeed } from "./performance";

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Seuils de charge (doc 03 §L3) */
export const LOAD_ON_A = 0.4;
export const LOAD_OFF_A = -0.3;
export const BRAKE_A = -0.9;      // en dessous : on considère qu'on freine / régénère fort

export interface ModelOptions {
  host?: PerfCurve;       // performances de la voiture réelle (Tesla)
  calage?: boolean;       // caler le véhicule simulé sur ses vraies performances
  mode?: DriveMode;
}

/**
 * Moteur virtuel : vitesse + accélération RÉELLES (Tesla) → régime, rapport, charge, événements
 * du véhicule SIMULÉ. Pur (pas d'audio) → testable.
 */
export class VehicleModel {
  rpm = 0;
  gear = 0;
  load = 0;
  running = false;
  vVirt = 0;              // vitesse du véhicule simulé (m/s)
  ratio = 0;              // accélération / accélération max possible (≈ position de pédale)
  mode: DriveMode;
  calage: boolean;
  readonly target: PerfCurve | null;
  host: PerfCurve | null;
  private t = 0;
  private lastShift = -10;
  private shiftUntil = -1;
  private blipUntil = -1;
  private limiterUntil = -1;
  private startT = -1;
  private prevLoad = 0;
  private popAcc = 0;
  private rand = Math.random;
  events: EngineEvent[] = [];

  constructor(public p: VehicleProfile, o: ModelOptions = {}) {
    this.mode = o.mode ?? DRIVE_MODES.normal;
    this.host = o.host ?? null;
    this.calage = o.calage ?? true;
    this.target = p.perf ? new PerfCurve(p.perf) : null;
  }

  start() { this.running = true; this.startT = this.t; this.rpm = 0; this.gear = 0; this.events.push({ type: "starter" }); }
  stop() { this.running = false; }

  rpmForGear(v: number, g: number): number {
    return (v / this.p.wheelCircumferenceM) * 60 * this.p.gears[g] * this.p.finalDrive;
  }

  /** Accélération max que la voiture réelle peut fournir à cette vitesse. */
  private hostAMax(v: number): number {
    return this.host ? Math.max(0.6, this.host.aMax(v)) : this.p.aMaxMs2;
  }

  /** Charge (0–1) : accélération rapportée à ce que la voiture PEUT faire à cette vitesse, puis courbe du mode. */
  loadFrom(a: number, v: number): number {
    if (a < LOAD_OFF_A) { this.ratio = 0; return 0; }
    if (a <= LOAD_ON_A) { this.ratio = Math.max(0, a) / this.hostAMax(v); return 0.12; } // croisière
    const r = clamp(a / this.hostAMax(v), 0, 1);
    this.ratio = r;
    return clamp(0.15 + 0.85 * Math.pow(r, this.mode.pedalGamma), 0.15, 1);
  }

  update(dt: number, inp: EngineInput): EngineState {
    this.t += dt;
    const p = this.p, t = this.t, m = this.mode, red = p.redlineRpm;
    if (!this.running) {
      this.rpm = Math.max(0, this.rpm - dt * 2500);
      this.load = 0;
      return this.state();
    }
    // ---- séquence de démarrage ----
    const st = t - this.startT;
    if (st < 1.4) {
      let target: number;
      if (st < 0.6) target = 250;
      else if (st < 0.85) target = p.idleRpm * 1.9;
      else target = p.idleRpm * 1.15;
      const tau = st < 0.6 ? 0.1 : st < 0.85 ? 0.07 : 0.25;
      this.rpm += (target - this.rpm) * (1 - Math.exp(-dt / tau));
      this.load = st >= 0.6 && st < 0.85 ? 0.6 : 0.05;
      return this.state();
    }

    const vReal = Math.max(0, inp.v);
    const v = this.calage && this.host && this.target ? mapSpeed(this.host, this.target, vReal) : vReal;
    this.vVirt = v;
    let loadT = this.loadFrom(inp.a, vReal);
    if (vReal < 0.5 && inp.a <= LOAD_ON_A) loadT = 0;
    const braking = inp.a < BRAKE_A;

    // ---- boîte de vitesses ----
    const n = p.gears.length;
    const shiftUp = red * (m.upshiftLow + (m.upshiftHigh - m.upshiftLow) * Math.pow(clamp((loadT - 0.12) / 0.88, 0, 1), 1.3));
    const cur = this.rpmForGear(v, this.gear);
    const lower = this.gear > 0 ? this.rpmForGear(v, this.gear - 1) : Infinity;
    if (vReal < 0.5) this.gear = 0;
    else if (t - this.lastShift > m.minGearHold) {
      const lifting = loadT < 0.13;
      const decel = inp.a < LOAD_OFF_A;   // on ralentit : une boîte ne monte jamais de rapport (sauf sur-régime)
      const blockUp = (decel || (m.holdOnLift && lifting)) && cur < red * 0.97;
      if (this.gear < n - 1 && cur > shiftUp && !blockUp) this.shift(this.gear + 1);
      else if (this.gear > 0 && braking && lower < red * m.downshiftBrake) this.shift(this.gear - 1);       // rétro au freinage
      else if (this.gear > 0 && cur < red * m.downshiftCoast && lower < red * 0.8) this.shift(this.gear - 1); // rétro en roue libre
      else if (this.gear > 0 && loadT >= m.kickdownLoad && cur < red * 0.55 && lower < red * 0.88) this.shift(this.gear - 1); // kick-down
    }
    const shifting = t < this.shiftUntil;
    const blipping = t < this.blipUntil;
    if (shifting) loadT = Math.min(loadT, 0.08);
    if (blipping) loadT = Math.max(loadT, 0.35 + 0.4 * m.blip);

    // ---- régime cible ----
    let target = this.rpmForGear(v, this.gear);
    if (this.gear === 0) {
      const launch = p.idleRpm + loadT * (Math.min(3500, red * 0.45) - p.idleRpm);
      target = Math.max(target, vReal < 6 ? launch : 0);
    }
    target = Math.max(target, p.idleRpm);

    // ---- rupteur ----
    let limiter = false;
    if (target >= p.limiterRpm) {
      target = p.limiterRpm;
      if (this.rpm >= p.limiterRpm - 40 && loadT > 0.5 && t > this.limiterUntil + 0.05) this.limiterUntil = t + 0.07;
    }
    if (t < this.limiterUntil) { target = p.limiterRpm - 300; loadT = 0; limiter = true; }

    // ---- inertie (vivacité selon le mode) ----
    const up = target > this.rpm;
    const tau = blipping ? 0.045 : shifting ? 0.06 : limiter ? 0.03
      : ((up ? p.inertia.tauUpMs : p.inertia.tauDownMs) / 1000) * m.tauScale;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt / tau));
    const loadTau = (loadT > this.load ? 0.05 : 0.08) * Math.sqrt(m.tauScale);
    this.load += (loadT - this.load) * (1 - Math.exp(-dt / loadTau));

    // ---- pétarades ----
    if (m.pops > 0) {
      if (this.prevLoad > 0.45 && loadT < 0.1 && this.rpm > red * 0.42 && !limiter && !shifting && this.rand() < 0.3 + 0.7 * m.pops) {
        const k = 1 + Math.floor(this.rand() * (1 + 2 * m.pops));
        for (let i = 0; i < k; i++) this.events.push({ type: "pop", delay: 0.04 + i * (0.05 + this.rand() * 0.12) });
      }
      if (loadT === 0 && this.rpm > red * 0.45) {
        this.popAcc += dt * 1.8 * m.pops * (this.rpm / red);
        if (this.popAcc > this.rand() * 4) { this.popAcc = 0; this.events.push({ type: "pop", delay: 0 }); }
      }
    }
    this.prevLoad = loadT;
    return { ...this.state(), limiter, shifting: shifting || blipping };
  }

  private shift(g: number) {
    const m = this.mode;
    if (g > this.gear) {
      const hard = this.p.shiftStyle === "hard" ? 0.7 : 1;
      this.shiftUntil = this.t + m.shiftTime * hard;
      this.events.push({ type: "shift" });
    } else if (m.blip > 0) {
      this.blipUntil = this.t + 0.12 + 0.06 * m.blip;   // coup de gaz de rétrogradage (talon-pointe)
      if (m.pops >= 0.5 && this.rand() < m.pops * 0.6) this.events.push({ type: "pop", delay: 0.2 + this.rand() * 0.1 });
    }
    this.gear = g; this.lastShift = this.t;
  }

  state(): EngineState {
    return { rpm: this.rpm, gear: this.gear, load: this.load, running: this.running, limiter: false, shifting: false };
  }
  takeEvents(): EngineEvent[] { const e = this.events; this.events = []; return e; }
}
