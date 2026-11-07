/**
 * Simulateur de conduite « type Tesla » pour le mode Démo : pédale 0–1, frein,
 * régénération au lâcher (conduite une pédale).
 */
export class Simulator {
  v = 0; a = 0; pedal = 0; brake = false;
  step(dt: number) {
    const v = this.v;
    let a: number;
    if (this.brake) a = -7;
    else if (this.pedal > 0.02) {
      const aMax = 6.5 * Math.min(1, 22 / Math.max(v, 1e-3) * 0.9 + 0.1); // couple constant puis puissance constante
      a = this.pedal * Math.min(6.5, aMax) - 0.0004 * v * v - 0.1;
    } else a = v > 0.5 ? -1.6 - 0.0004 * v * v : -0.5; // régénération
    this.a = a;
    this.v = Math.max(0, Math.min(70, v + a * dt));
    if (this.v === 0) this.a = Math.max(0, this.a);
  }
}
