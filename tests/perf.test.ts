import { describe, it, expect } from "vitest";
import { PerfCurve, mapSpeed } from "../src/engine/performance";

const tesla = new PerfCurve({ zeroTo100s: 4.8, topSpeedKmh: 201, launchAccel: 7.5 });
const svj = new PerfCurve({ zeroTo100s: 2.8, topSpeedKmh: 350, launchAccel: 11 });
const kmh = (v: number) => v * 3.6;

describe("PerfCurve", () => {
  it("retrouve le 0–100 publié", () => {
    expect(tesla.timeTo(100 / 3.6)).toBeCloseTo(4.8, 1);
    expect(svj.timeTo(100 / 3.6)).toBeCloseTo(2.8, 1);
  });
  it("l'accélération max diminue avec la vitesse et s'annule à Vmax", () => {
    expect(tesla.aMax(30 / 3.6)).toBeGreaterThan(tesla.aMax(130 / 3.6) * 2);
    expect(tesla.aMax(200 / 3.6)).toBeLessThan(0.2);
  });
  it("calage : une Model Y à 100 km/h ↔ une SVJ nettement plus vite (même temps de plancher)", () => {
    const v = kmh(mapSpeed(tesla, svj, 100 / 3.6));
    console.log(`Model Y 100 km/h (4,8 s) ↔ SVJ ${v.toFixed(0)} km/h ; Model Y 50 ↔ SVJ ${kmh(mapSpeed(tesla, svj, 50 / 3.6)).toFixed(0)} ; 150 ↔ ${kmh(mapSpeed(tesla, svj, 150 / 3.6)).toFixed(0)}`);
    expect(v).toBeGreaterThan(130); expect(v).toBeLessThan(200);
    expect(mapSpeed(tesla, svj, 0)).toBe(0);
  });
  it("mapping monotone (pas de saut de régime)", () => {
    let prev = -1;
    for (let k = 0; k <= 220; k += 1) { const v = mapSpeed(tesla, svj, k / 3.6); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });
});
