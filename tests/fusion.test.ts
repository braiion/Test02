import { describe, it, expect } from "vitest";
import { MotionProcessor, type Vec } from "../src/sensors/motion";
import { FusionEstimator } from "../src/estimation/fusion";
import { SpeedEstimator } from "../src/estimation/estimator";

// téléphone posé de travers
const rot = (v: Vec): Vec => { const a = 0.9, b = 0.5, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const x1 = ca * v[0] - sa * v[1], y1 = sa * v[0] + ca * v[1]; return [x1, cb * y1 - sb * v[2], sb * y1 + cb * v[2]]; };

/** Scénario : 30 km/h stabilisé, puis coup d'accélérateur à t=10 s (4 m/s² pendant 3 s), puis lâcher (−2 m/s²). */
const accelAt = (t: number) => (t >= 10 && t < 13 ? 4 : t >= 13 && t < 16 ? -2 : 0);

function run(withImu: boolean) {
  const mp = new MotionProcessor(), fu = new FusionEstimator(), est = new SpeedEstimator();
  let v = 8.3, nextFix = 0; const hist: { t: number; v: number }[] = [];
  const dt = 1 / 60; let firstReact = NaN;
  // calibration préalable (accélération franche) pour isoler la mesure de latence
  for (let i = 0; i < 120; i++) mp.push({ t: -3 + i * dt, lin: rot([3, 0, 0]), incl: rot([3, 0, 9.81]) });
  mp.calibrateNow();
  for (let i = 0; i < 300; i++) mp.push({ t: -1 + i * dt / 3, lin: rot([0, 0, 0]), incl: rot([0, 0, 9.81]) });
  fu.v = v;
  for (let t = 0; t < 20; t += dt) {
    const a = accelAt(t); v += a * dt; hist.push({ t, v });
    if (t >= nextFix) { nextFix += 1; const old = hist.find((h) => h.t >= t - 0.3)!; est.update({ t, v: old.v }); if (withImu) fu.onGps(t, old.v, mp.aLong); }
    let aUsed: number;
    if (withImu) { const al = mp.push({ t, lin: rot([a, 0, 0]), incl: rot([a, 0, 9.81]) })!; fu.onImu(t, al); aUsed = fu.a; }
    else aUsed = est.accelAt(t, 0.4);
    if (t >= 10 && Number.isNaN(firstReact) && aUsed > 0.4) firstReact = t - 10; // seuil « en charge »
  }
  return { firstReact, mp };
}

describe("Accéléromètre + fusion", () => {
  it("apprend l'axe avant tout seul, quelle que soit l'orientation du téléphone", () => {
    const mp = new MotionProcessor();
    let t = 0;
    for (let k = 0; k < 6; k++) for (let i = 0; i < 180; i++, t += 1 / 60) {
      const a = k % 2 ? -2 : 3; // accélérations / décélérations alternées
      mp.push({ t, lin: rot([a, (Math.random() - .5) * .3, 0]), incl: rot([a, 0, 9.81]) });
      mp.learn(a, 1 / 60);
    }
    expect(mp.calibrated).toBe(true);
    const out = mp.push({ t, lin: rot([2.5, 0, 0]), incl: rot([2.5, 0, 9.81]) })!;
    // lissage 40 ms : on vérifie le signe et l'ordre de grandeur après quelques échantillons
    let o = out; for (let i = 0; i < 20; i++) o = mp.push({ t: t + i / 60, lin: rot([2.5, 0, 0]), incl: rot([2.5, 0, 9.81]) })!;
    expect(o).toBeGreaterThan(2.2); expect(o).toBeLessThan(2.8);
  });

  it("réagit au coup d'accélérateur en < 100 ms (contre ~1 s au GPS seul)", () => {
    const imu = run(true), gps = run(false);
    console.log(`réaction : accéléro ${(imu.firstReact * 1000).toFixed(0)} ms, GPS seul ${(gps.firstReact * 1000).toFixed(0)} ms`);
    expect(imu.firstReact).toBeLessThan(0.1);
    expect(gps.firstReact).toBeGreaterThan(0.3);
  });

  it("la fusion garde une vitesse juste malgré un biais d'accéléromètre", () => {
    const fu = new FusionEstimator(); let v = 0, nextFix = 0; const dt = 1 / 60; const hist: { t: number; v: number }[] = [];
    for (let t = 0; t < 60; t += dt) {
      const a = t < 8 ? 3 : t < 40 ? 0 : -0.5; v = Math.max(0, v + a * dt); hist.push({ t, v });
      fu.onImu(t, a + 0.4); // biais de 0,4 m/s² (téléphone légèrement incliné)
      if (t >= nextFix) { nextFix += 1; const old = hist.find((h) => h.t >= t - 0.25)!; fu.onGps(t, old.v, a + 0.4); }
    }
    expect(Math.abs(fu.v - v)).toBeLessThan(1.0);   // < 3,6 km/h d'écart
    expect(fu.bias).toBeGreaterThan(0.2);
  });
});
