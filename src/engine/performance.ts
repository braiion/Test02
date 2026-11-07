/**
 * Courbes de performance « pied au plancher » à partir des données constructeur.
 *
 * Modèle : a(v) = min(a0, k / v) − c·v² − r, coupé à vmax (bridage électronique ou limite aéro)
 *   a0 = accélération max au démarrage (motricité), k = P/m (puissance massique),
 *   c = traînée aéro / masse, r = frottements. k est ajusté pour retrouver le 0–100 publié.
 *
 * Sert à :
 *  1. normaliser la pédale : charge = accélération mesurée / accélération max POSSIBLE à cette vitesse
 *     (une Tesla pousse moins fort à 130 km/h : pied au plancher doit rester « pleine charge ») ;
 *  2. caler le véhicule simulé : à temps de pied au plancher égal, on place le véhicule simulé à la
 *     vitesse qu'aurait la VRAIE voiture (une SVJ est plus rapide qu'une Model Y) → régime et rapports réalistes.
 */
export interface PerfSpec { zeroTo100s: number; topSpeedKmh: number; launchAccel: number; drag?: number }

const V100 = 100 / 3.6;
const DV = 0.05;

export class PerfCurve {
  readonly vmax: number; readonly a0: number; k = 0; readonly c: number; readonly r = 0.12;
  private tTable: Float64Array = new Float64Array(0); // temps (s) pour atteindre i·DV

  constructor(readonly spec: PerfSpec) {
    this.vmax = spec.topSpeedKmh / 3.6;
    this.a0 = spec.launchAccel;
    this.c = spec.drag ?? 0.00022; // ≈ ½ρ·Cx·S / m pour une voiture de sport
    // ajustement de k par dichotomie sur le 0–100
    let lo = 1, hi = 5000;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2; this.setK(mid);
      if (this.integrateTo(V100) > spec.zeroTo100s) lo = mid; else hi = mid;
    }
    this.setK((lo + hi) / 2);
    this.buildTable();
  }

  private setK(k: number) { this.k = k; }

  /** Accélération maximale possible à la vitesse v (m/s). */
  aMax(v: number): number {
    const vv = Math.max(0.1, v);
    if (vv >= this.vmax) return 0;
    const a = Math.min(this.a0, this.k / vv) - this.c * vv * vv - this.r;
    // approche douce du bridage sur les 3 derniers %
    const lim = Math.min(1, (this.vmax - vv) / (this.vmax * 0.03));
    return Math.max(0, a * lim);
  }

  private integrateTo(vt: number): number {
    let t = 0;
    for (let v = 0; v < vt; v += DV) { const a = this.aMax(v + DV / 2); if (a <= 1e-4) return Infinity; t += DV / a; }
    return t;
  }

  private buildTable() {
    const n = Math.floor((this.vmax * 0.99) / DV);
    this.tTable = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) this.tTable[i] = this.tTable[i - 1] + DV / this.aMax((i - 0.5) * DV);
  }

  /** Temps pied au plancher pour atteindre v. */
  timeTo(v: number): number {
    const x = Math.max(0, v) / DV, i = Math.floor(x), n = this.tTable.length - 1;
    if (i >= n) return this.tTable[n] + (v - n * DV) / Math.max(0.05, this.aMax(n * DV)); // au-delà : prolongé
    return this.tTable[i] + (this.tTable[i + 1] - this.tTable[i]) * (x - i);
  }

  /** Vitesse atteinte après t secondes pied au plancher. */
  speedAt(t: number): number {
    const tt = this.tTable, n = tt.length - 1;
    if (t <= 0) return 0;
    if (t >= tt[n]) return n * DV;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tt[m] <= t) lo = m; else hi = m; }
    return (lo + (t - tt[lo]) / (tt[hi] - tt[lo])) * DV;
  }
}

/** Vitesse du véhicule simulé correspondant à la vitesse réelle de la voiture hôte (même « temps de plancher »). */
export function mapSpeed(host: PerfCurve, target: PerfCurve, vHost: number): number {
  return target.speedAt(host.timeTo(vHost));
}
