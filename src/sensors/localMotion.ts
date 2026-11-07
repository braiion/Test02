import { sampleFromArrays, type MotionSample } from "./motion";

/** Accéléromètre de l'appareil qui affiche la page (écran Tesla s'il est exposé, ou téléphone). */
export class LocalMotion {
  available = false;   // au moins un événement avec de vraies valeurs reçu
  private handler = (e: DeviceMotionEvent) => {
    const a = e.acceleration, g = e.accelerationIncludingGravity;
    const s = sampleFromArrays(performance.now() / 1000, a ? [a.x, a.y, a.z] : null, g ? [g.x, g.y, g.z] : null);
    if (!s.lin && !s.incl) return;
    this.available = true;
    this.onSample(s);
  };
  constructor(private onSample: (s: MotionSample) => void) {}

  /** Doit être appelé depuis un geste utilisateur (iOS demande une permission). */
  async start(): Promise<void> {
    const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    try { if (DME?.requestPermission) await DME.requestPermission(); } catch { /* refusé ou non requis */ }
    addEventListener("devicemotion", this.handler);
  }
  stop() { removeEventListener("devicemotion", this.handler); }
}
