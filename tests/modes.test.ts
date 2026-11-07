import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { VehicleModel } from "../src/engine/vehicleModel";
import { DRIVE_MODES, type DriveModeId } from "../src/engine/driveModes";
import { PerfCurve } from "../src/engine/performance";
import type { VehicleProfile } from "../src/types";

const prof = (id: string): VehicleProfile => JSON.parse(readFileSync(`public/vehicles/${id}/vehicle.json`, "utf8"));
const host = new PerfCurve({ zeroTo100s: 4.8, topSpeedKmh: 201, launchAccel: 7.5 });
const dt = 1 / 60;

function make(id: string, mode: DriveModeId, calage = true) {
  const m = new VehicleModel(prof(id), { host, calage, mode: DRIVE_MODES[mode] });
  m.start(); for (let i = 0; i < 100; i++) m.update(dt, { v: 0, a: 0 });
  return m;
}
/** Pied au plancher sur la vraie courbe Tesla jusqu'à vEnd ; renvoie les régimes de passage montant. */
function wot(m: VehicleModel, vEnd: number) {
  let v = 0, g = m.gear; const ups: number[] = []; let prevRpm = 0;
  while (v < vEnd) { const a = host.aMax(v); v += a * dt; const s = m.update(dt, { v, a }); if (s.gear > g) ups.push(prevRpm); g = s.gear; prevRpm = s.rpm; }
  return { ups, v };
}

describe("Calage pédale sur les performances de la Tesla", () => {
  it("pied au plancher à 130 km/h = pleine charge, même si la Tesla accélère moins fort", () => {
    const m = make("v12-svj", "normal");
    const v = 130 / 3.6, a = host.aMax(v);
    for (let i = 0; i < 60; i++) m.update(dt, { v, a });
    expect(a).toBeLessThan(3);           // la Tesla ne pousse plus qu'environ 2–3 m/s²
    expect(m.load).toBeGreaterThan(0.95); // … mais le moteur simulé est bien à fond
  });
  it("calage : la SVJ simulée est plus haut dans les rapports que sans calage", () => {
    const a = make("v12-svj", "normal", true), b = make("v12-svj", "normal", false);
    const ra = wot(a, 100 / 3.6), rb = wot(b, 100 / 3.6);
    expect(a.vVirt).toBeGreaterThan(b.vVirt * 1.3);
    expect(a.gear).toBeGreaterThanOrEqual(b.gear);
    void ra; void rb;
  });
});

describe("Modes de conduite", () => {
  it("Confort passe les rapports plus tôt, Sport tire plus haut (accélération modérée)", () => {
    const res: Record<string, number> = {};
    for (const mode of ["confort", "sport"] as const) {
      const m = make("v8-us", mode);
      let v = 0, g = 0, maxRpm = 0;
      for (let i = 0; i < 60 * 8; i++) { const a = host.aMax(v) * 0.35; v += a * dt; const s = m.update(dt, { v, a }); if (s.gear === 0) maxRpm = Math.max(maxRpm, s.rpm); g = s.gear; }
      res[mode] = maxRpm; void g;
    }
    expect(res.sport).toBeGreaterThan(res.confort * 1.4);
  });

  it("au freinage, Sport rétrograde plus tôt (régime plus haut) que Confort", () => {
    const downRpm: Record<string, number> = {};
    for (const mode of ["confort", "sport"] as const) {
      const m = make("v10-cgt", mode);
      wot(m, 120 / 3.6);
      let v = 120 / 3.6, g = m.gear; const rpms: number[] = [];
      for (let i = 0; i < 60 * 6 && v > 2; i++) {
        v -= 4 * dt; const s = m.update(dt, { v, a: -4 });
        if (s.gear < g) rpms.push(s.rpm); g = s.gear;
      }
      downRpm[mode] = rpms.length ? rpms.reduce((x, y) => x + y) / rpms.length : 0;
    }
    expect(downRpm.sport).toBeGreaterThan(downRpm.confort);
  });

  it("Sport : coup de gaz au rétrogradage (le régime remonte vite, charge > 0)", () => {
    const m = make("v12-svj", "sport");
    wot(m, 110 / 3.6);
    let v = 110 / 3.6, g = m.gear, sawBlip = false;
    for (let i = 0; i < 60 * 5 && v > 3; i++) {
      v -= 5 * dt; const s = m.update(dt, { v, a: -5 });
      if (s.gear < g) { for (let k = 0; k < 6; k++) { const s2 = m.update(dt, { v, a: -5 }); if (s2.load > 0.3) sawBlip = true; } }
      g = m.gear;
    }
    expect(sawBlip).toBe(true);
  });

  it("Confort : pas de coup de gaz ni de pétarades au lâcher", () => {
    const m = make("v12-svj", "confort");
    wot(m, 110 / 3.6); m.takeEvents();
    let v = 110 / 3.6; let pops = 0;
    for (let i = 0; i < 60 * 4; i++) { v -= 2 * dt; m.update(dt, { v, a: -2 }); pops += m.takeEvents().filter((e) => e.type === "pop").length; }
    expect(pops).toBeLessThanOrEqual(1);
  });
});
