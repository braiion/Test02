/**
 * Estimation vitesse/accélération à partir de mesures lentes (GPS ≈ 1 Hz) + prédiction à 60 Hz.
 * Voir doc 03 §2 (L1, L2).
 */
export interface Measurement { t: number; v: number } // t en secondes (horloge locale), v en m/s

export class SpeedEstimator {
  v = 0; a = 0; tLast = -1;
  alpha = 0.85; beta = 0.6;     // la vitesse Doppler est précise → on lui fait confiance
  aDecayS = 1.2;                // si plus de mesure : l'accélération estimée décroît
  maxA = 10;
  count = 0;

  update(m: Measurement): void {
    if (this.tLast < 0) { this.v = m.v; this.a = 0; this.tLast = m.t; this.count = 1; return; }
    const dt = m.t - this.tLast;
    if (dt <= 0.02) return;                         // doublon
    if (dt > 4) { this.v = m.v; this.a = 0; this.tLast = m.t; return; } // trou → réinitialise
    // rejet des sauts non physiques (> 12 m/s² ≈ impossible)
    if (Math.abs(m.v - this.v) / dt > 15) return;
    const vp = this.v + this.a * dt;
    const r = m.v - vp;
    this.v = vp + this.alpha * r;
    this.a = Math.max(-this.maxA, Math.min(this.maxA, this.a + (this.beta / dt) * r));
    this.tLast = m.t; this.count++;
  }

  /** Accélération effective à l'instant `now` (+ anticipation), avec décroissance. */
  accelAt(now: number, lookahead: number): number {
    if (this.tLast < 0) return 0;
    const T = Math.max(0, now - this.tLast + lookahead);
    return this.a * Math.exp(-T / this.aDecayS);
  }

  /** Vitesse prédite : v + ∫ a·e^(−s/τ) ds sur [0, T]. */
  predict(now: number, lookahead: number): number {
    if (this.tLast < 0) return 0;
    const T = Math.max(0, now - this.tLast + lookahead);
    const v = this.v + this.a * this.aDecayS * (1 - Math.exp(-T / this.aDecayS));
    return v < 0.3 ? 0 : v;
  }

  reset() { this.v = 0; this.a = 0; this.tLast = -1; this.count = 0; }
}

/** Distance haversine en mètres. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000, r = Math.PI / 180, dLa = (lat2 - lat1) * r, dLo = (lon2 - lon1) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
