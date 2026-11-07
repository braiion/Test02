import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SpeedEstimator } from "../src/estimation/estimator";
import { VehicleModel } from "../src/engine/vehicleModel";
import { crossfadeWeights } from "../src/audio/engine";
import { synthLoop, LOOP_LEN } from "../src/audio/synth";
import type { VehicleProfile } from "../src/types";

const prof = (id: string): VehicleProfile => JSON.parse(readFileSync(`public/vehicles/${id}/vehicle.json`, "utf8"));

describe("SpeedEstimator", () => {
  it("converge sur une vitesse constante", () => {
    const e = new SpeedEstimator();
    for (let t = 0; t < 10; t++) e.update({ t, v: 20 });
    expect(e.predict(10, 0.4)).toBeCloseTo(20, 1);
    expect(Math.abs(e.a)).toBeLessThan(0.05);
  });
  it("suit une rampe d'accélération avec prédiction (retard réduit)", () => {
    const e = new SpeedEstimator();
    const A = 4; // m/s²
    for (let t = 0; t <= 6; t++) e.update({ t, v: 10 + A * t });
    const truth = 10 + A * 6.5;
    const pred = e.predict(6.5, 0);   // entre deux points
    const naive = 10 + A * 6;        // « dernière mesure »
    expect(Math.abs(pred - truth)).toBeLessThan(Math.abs(naive - truth) * 0.5);
  });
  it("rejette un saut non physique", () => {
    const e = new SpeedEstimator();
    for (let t = 0; t < 4; t++) e.update({ t, v: 15 });
    e.update({ t: 4, v: 60 });
    expect(e.v).toBeCloseTo(15, 0);
  });
  it("l'accélération décroît si le GPS se tait", () => {
    const e = new SpeedEstimator();
    for (let t = 0; t <= 4; t++) e.update({ t, v: 3 * t });
    expect(e.accelAt(10, 0)).toBeLessThan(e.accelAt(4.2, 0) * 0.05);
  });
});

describe("VehicleModel", () => {
  for (const id of ["v8-us", "v10-cgt", "v12-svj"]) {
    it(`${id} : démarre, monte les rapports, ne dépasse pas le rupteur`, () => {
      const p = prof(id), m = new VehicleModel(p);
      m.start();
      for (let i = 0; i < 120; i++) m.update(1 / 60, { v: 0, a: 0 });
      expect(m.rpm).toBeGreaterThan(p.idleRpm * 0.9);
      let v = 0, maxRpm = 0, maxGear = 0;
      for (let i = 0; i < 60 * 12; i++) { v += 5 * (1 / 60); const s = m.update(1 / 60, { v, a: 5 }); maxRpm = Math.max(maxRpm, s.rpm); maxGear = Math.max(maxGear, s.gear); }
      expect(maxRpm).toBeLessThanOrEqual(p.limiterRpm + 1);
      expect(maxGear).toBeGreaterThanOrEqual(2);
      expect(m.gear).toBeGreaterThan(0);
    });
  }
  it("lâcher de pédale à haut régime → pétarades", () => {
    const m = new VehicleModel(prof("v12-svj")); m.start();
    for (let i = 0; i < 100; i++) m.update(1 / 60, { v: 0, a: 0 });
    for (let i = 0; i < 240; i++) m.update(1 / 60, { v: 25, a: 5 });
    m.takeEvents();
    for (let i = 0; i < 30; i++) m.update(1 / 60, { v: 25, a: -2 });
    expect(m.takeEvents().some((e) => e.type === "pop")).toBe(true);
  });
  it("pas de pompage : au plus 1 changement de rapport par 0,6 s", () => {
    const m = new VehicleModel(prof("v8-us")); m.start();
    for (let i = 0; i < 100; i++) m.update(1 / 60, { v: 0, a: 0 });
    let last = m.gear, changes: number[] = [];
    for (let i = 0; i < 600; i++) { const v = 14 + Math.sin(i / 7) * 1.5; const s = m.update(1 / 60, { v, a: i % 20 < 10 ? 1 : -1 }); if (s.gear !== last) { changes.push(i); last = s.gear; } }
    for (let k = 1; k < changes.length; k++) expect(changes[k] - changes[k - 1]).toBeGreaterThanOrEqual(36);
  });
});

describe("Audio", () => {
  it("crossfade à puissance constante", () => {
    const rpms = [1000, 1500, 2000, 2500];
    for (const r of [800, 1000, 1200, 1750, 2400, 3000]) {
      const w = crossfadeWeights(rpms, r);
      expect(w.reduce((a, b) => a + b * b, 0)).toBeCloseTo(1, 6);
    }
    const w = crossfadeWeights(rpms, 1750);
    expect(w[1]).toBeGreaterThan(0); expect(w[2]).toBeGreaterThan(0); expect(w[0]).toBe(0);
  });
  it("boucle synthétique sans discontinuité à la jonction", () => {
    const d = synthLoop(3000, 8, 1, { irregularity: 0.5, brightness: 1200, noise: 1, rough: 0.5 }, 48000, 1);
    expect(d.length).toBe(LOOP_LEN);
    let maxStep = 0; for (let i = 1; i < d.length; i++) maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]));
    const jump = Math.abs(d[0] - d[d.length - 1]);
    expect(jump).toBeLessThanOrEqual(maxStep * 1.01);
    expect(d.every(Number.isFinite)).toBe(true);
  });
});
