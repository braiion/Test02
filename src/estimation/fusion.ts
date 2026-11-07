/**
 * Fusion accéléromètre (rapide, ~60 Hz, mais dérive) + GPS (lent, ~1 Hz, en retard, mais juste).
 * Filtre complémentaire : on intègre l'accélération en continu, et chaque point GPS recale
 * la vitesse (en tenant compte de son retard) et le biais de l'accéléromètre.
 */
export class FusionEstimator {
  v = 0; a = 0; bias = 0;
  lastImuT = -1; lastGpsT = -1;
  gpsDelay = 0.25;              // retard supposé de la vitesse GPS (s)
  private hist: { t: number; v: number }[] = [];
  private stillCount = 0;

  get active() { return this.lastImuT > 0; }

  onImu(t: number, aLong: number) {
    const dt = this.lastImuT < 0 ? 0 : Math.min(0.1, t - this.lastImuT);
    this.lastImuT = t;
    this.a = aLong - this.bias;
    this.v = Math.max(0, this.v + this.a * dt);
    if (this.v === 0 && this.a < 0) this.a = 0;
    this.hist.push({ t, v: this.v });
    while (this.hist.length && this.hist[0].t < t - 3) this.hist.shift();
  }

  onGps(t: number, z: number, aLongRaw: number) {
    const dtG = this.lastGpsT < 0 ? 1 : Math.max(0.2, t - this.lastGpsT);
    this.lastGpsT = t;
    if (z < 0.3) {                       // à l'arrêt : vitesse nulle, l'accéléro doit lire 0 → biais
      this.stillCount++;
      this.v = 0;
      if (this.stillCount >= 2) this.bias += 0.3 * (aLongRaw - this.bias);
      return;
    }
    this.stillCount = 0;
    const target = t - this.gpsDelay;
    let past = this.v;
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i].t <= target) { past = this.hist[i].v; break; }
    const r = z - past;
    this.v = Math.max(0, this.v + 0.6 * r);            // recalage vitesse
    this.bias = Math.max(-1.5, Math.min(1.5, this.bias - 0.15 * r / dtG)); // dérive → biais
    for (const h of this.hist) h.v += 0.6 * r;
  }

  predict(lookahead: number) { return Math.max(0, this.v + this.a * lookahead); }
  reset() { this.v = 0; this.a = 0; this.bias = 0; this.lastImuT = -1; this.lastGpsT = -1; this.hist = []; this.stillCount = 0; }
}
