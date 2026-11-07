import type { PerfCurve } from "../engine/performance";

/**
 * Simulateur de conduite pour le mode Démo, basé sur la courbe de performance RÉELLE de la voiture hôte
 * (pied au plancher = accélération max possible à cette vitesse), régénération au lâcher, frein.
 */
export class Simulator {
  v = 0; a = 0; pedal = 0; brake = false;
  host: PerfCurve | null = null;
  regenMax = 2.0;
  step(dt: number) {
    const v = this.v;
    let a: number;
    if (this.brake) a = -7;
    else if (this.pedal > 0.02) {
      const aMax = this.host ? this.host.aMax(v) : 6;
      const resist = 0.12 + 0.00022 * v * v;
      a = this.pedal * (aMax + resist) - resist;
    } else a = v > 0.5 ? -this.regenMax * Math.min(1, v / 5) - 0.00022 * v * v : 0; // régénération (une pédale)
    this.a = a;
    this.v = Math.max(0, v + a * dt);
    if (this.v === 0) this.a = Math.max(0, this.a);
  }
}
