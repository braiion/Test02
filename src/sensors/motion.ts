/**
 * Traitement accéléromètre → accélération LONGITUDINALE du véhicule (m/s², + = accélère).
 *
 * Le capteur (téléphone, ou écran Tesla si exposé) est dans une orientation inconnue :
 *  1. on estime la gravité (passe-bas de accelerationIncludingGravity) → plan horizontal ;
 *  2. on projette l'accélération linéaire sur ce plan ;
 *  3. on apprend l'axe « avant » en corrélant avec l'accélération GPS (auto),
 *     ou d'un coup avec « Calibrer » pendant une accélération franche.
 */
export type Vec = [number, number, number];
export interface MotionSample { t: number; lin: Vec | null; incl: Vec | null }

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lp = (s: Vec, x: Vec, k: number): Vec => [s[0] + k * (x[0] - s[0]), s[1] + k * (x[1] - s[1]), s[2] + k * (x[2] - s[2])];

export class MotionProcessor {
  g: Vec | null = null;          // gravité estimée
  hSlow: Vec = [0, 0, 0];        // accélération horizontale lissée (~0,7 s) pour l'apprentissage
  fwd: Vec | null = null;        // axe avant (unitaire, horizontal)
  private S: Vec = [0, 0, 0];    // accumulateur de corrélation
  learnWeight = 0;               // « quantité » d'apprentissage accumulée
  aLong = 0;                     // sortie lissée
  lastT = -1; hz = 0; count = 0;
  private hzAcc = 0; private hzT0 = -1;

  get calibrated() { return this.fwd !== null && this.learnWeight >= 3; }

  push(s: MotionSample): number | null {
    const dt = this.lastT < 0 ? 1 / 60 : Math.min(0.2, Math.max(0.001, s.t - this.lastT));
    this.lastT = s.t; this.count++;
    if (this.hzT0 < 0) this.hzT0 = s.t;
    this.hzAcc++;
    if (s.t - this.hzT0 >= 1) { this.hz = this.hzAcc / (s.t - this.hzT0); this.hzAcc = 0; this.hzT0 = s.t; }

    if (s.incl) this.g = this.g ? lp(this.g, s.incl, 1 - Math.exp(-dt / 1.5)) : [...s.incl] as Vec;
    let lin: Vec | null = s.lin;
    if (!lin && s.incl && this.g) lin = sub(s.incl, this.g);
    if (!lin) return null;
    let h = lin;
    if (this.g && norm(this.g) > 5) { const gh = scale(this.g, 1 / norm(this.g)); h = sub(lin, scale(gh, dot(lin, gh))); }
    this.hSlow = lp(this.hSlow, h, 1 - Math.exp(-dt / 0.7));
    if (!this.fwd) return null;
    const a = dot(h, this.fwd);
    this.aLong += (a - this.aLong) * (1 - Math.exp(-dt / 0.04)); // lissage 40 ms (anti-vibrations)
    return this.aLong;
  }

  /** Apprentissage auto : appelé avec l'accélération estimée par le GPS (lente mais signée correctement). */
  learn(aRef: number, dt: number) {
    if (Math.abs(aRef) < 0.6 || norm(this.hSlow) < 0.4) return;
    const w = aRef * dt;
    this.S = [this.S[0] + this.hSlow[0] * w, this.S[1] + this.hSlow[1] * w, this.S[2] + this.hSlow[2] * w];
    this.learnWeight += Math.abs(w);
    const n = norm(this.S);
    if (n > 1e-6) this.fwd = scale(this.S, 1 / n);
  }

  /** Calibration manuelle : à déclencher PENDANT une accélération franche (pied au plancher ~2 s). */
  calibrateNow(): boolean {
    const n = norm(this.hSlow);
    if (n < 1) return false;
    this.fwd = scale(this.hSlow, 1 / n);
    this.S = scale(this.fwd, 10); this.learnWeight = 10;
    return true;
  }

  reset() { this.g = null; this.hSlow = [0, 0, 0]; this.fwd = null; this.S = [0, 0, 0]; this.learnWeight = 0; this.aLong = 0; this.lastT = -1; }
}

/** Convertit un DeviceMotionEvent (ou un message du téléphone) en échantillon. */
export function sampleFromArrays(t: number, lin: (number | null)[] | null, incl: (number | null)[] | null): MotionSample {
  const ok = (v: (number | null)[] | null): Vec | null => (v && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v as Vec) : null);
  return { t, lin: ok(lin), incl: ok(incl) };
}
