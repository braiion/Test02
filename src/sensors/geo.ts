import { haversine, type Measurement } from "../estimation/estimator";

/** Source GPS : vitesse Doppler (coords.speed) en priorité, sinon dérivée des positions. */
export class GeoSource {
  private id: number | null = null;
  private prev: { lat: number; lon: number; t: number } | null = null;
  lastRecv = 0; hz = 0; accuracy = NaN; dopplerOk = 0; dopplerNull = 0; error = "";
  private intervals: number[] = [];

  constructor(private onMeasure: (m: Measurement) => void) {}

  start() {
    if (!("geolocation" in navigator)) { this.error = "Géolocalisation indisponible"; return; }
    this.id = navigator.geolocation.watchPosition(
      (p) => this.onPos(p),
      (e) => { this.error = `GPS : ${e.message}`; },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }
  stop() { if (this.id !== null) navigator.geolocation.clearWatch(this.id); this.id = null; this.prev = null; }

  private onPos(p: GeolocationPosition) {
    const now = performance.now() / 1000, c = p.coords;
    if (this.lastRecv) { this.intervals.push(now - this.lastRecv); if (this.intervals.length > 20) this.intervals.shift(); }
    const mean = this.intervals.reduce((a, b) => a + b, 0) / (this.intervals.length || 1);
    this.hz = mean ? 1 / mean : 0;
    this.lastRecv = now; this.accuracy = c.accuracy; this.error = "";
    if (c.accuracy > 50) return;
    let v: number | null = null;
    if (c.speed !== null && !Number.isNaN(c.speed)) { v = c.speed; this.dopplerOk++; }
    else {
      this.dopplerNull++;
      if (this.prev) { const dt = now - this.prev.t; if (dt > 0.2) v = haversine(this.prev.lat, this.prev.lon, c.latitude, c.longitude) / dt; }
    }
    this.prev = { lat: c.latitude, lon: c.longitude, t: now };
    if (v !== null) this.onMeasure({ t: now, v });
  }
}
