import { fft } from "./fft";
import type { SynthParams } from "../types";

/** PRNG déterministe (même son à chaque chargement). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const LOOP_LEN = 65536;

/**
 * Génère une boucle moteur parfaitement bouclable (synthèse additive par IFFT : toutes les
 * composantes tombent sur des bins entiers → périodique sur la longueur du buffer, aucun clic).
 * Son PROVISOIRE, uniquement pour valider la chaîne avant réception des vrais enregistrements.
 */
export function synthLoop(rpm: number, cylinders: number, load: number, p: SynthParams, sampleRate: number, seed: number): Float32Array<ArrayBuffer> {
  const N = LOOP_LEN, re = new Float64Array(N), im = new Float64Array(N);
  const rand = rng(seed), df = sampleRate / N;
  const f0 = rpm / 120;                 // fréquence du cycle moteur (4 temps)
  const firing = cylinders / 2;         // harmonique d'allumage (en multiples de f0)
  const fc = p.brightness * (0.55 + 0.9 * load) * (0.7 + rpm / 9000);
  const add = (freq: number, amp: number, phase: number) => {
    const b = Math.round(freq / df);
    if (b <= 0 || b >= N / 2) return;
    re[b] += amp * Math.cos(phase); im[b] += amp * Math.sin(phase);
  };
  for (let k = 1; k * f0 < 14000; k++) {
    const f = k * f0;
    const tilt = 1 / (1 + Math.pow(f / fc, 2.2));
    const sub = f < 40 ? 0.3 : 1;
    let w: number;
    if (k % firing === 0) w = 1;
    else if ((2 * k) % firing === 0) w = 0.5 * p.irregularity + 0.1;
    else w = p.irregularity * (0.4 + 0.6 * rand());
    if (load < 0.3) w *= k % firing === 0 ? 0.8 : 1.4; // hors charge : plus de « borborygmes »
    const amp = w * tilt * sub;
    const ph = k * 0.3 + rand() * (0.6 + p.rough * 2);  // phases partiellement cohérentes → impulsions
    add(f, amp, ph);
    // rugosité : énergie autour de l'harmonique
    for (let s = 1; s <= 3; s++) {
      add(f + s * df * 1.0, amp * p.rough * 0.5 / s, rand() * 6.283);
      add(f - s * df * 1.0, amp * p.rough * 0.5 / s, rand() * 6.283);
    }
  }
  // souffle (admission / flux d'échappement)
  const noiseAmp = p.noise * (0.3 + 0.9 * load) * (0.5 + rpm / 8000);
  const fn = 900 + 2500 * load + rpm / 3;
  for (let b = 2; b < N / 2; b++) {
    const f = b * df;
    if (f > 16000) break;
    const a = noiseAmp * 0.02 / (1 + Math.pow(f / fn, 2)) * (f < 60 ? f / 60 : 1);
    const ph = rand() * 6.283;
    re[b] += a * Math.cos(ph); im[b] += a * Math.sin(ph);
  }
  // symétrie hermitienne → signal réel
  for (let b = 1; b < N / 2; b++) { re[N - b] = re[b]; im[N - b] = -im[b]; }
  re[0] = 0; im[0] = 0;
  fft(re, im, true);
  const out = new Float32Array(N);
  let sum = 0;
  for (let i = 0; i < N; i++) { out[i] = re[i]; sum += re[i] * re[i]; }
  const rms = Math.sqrt(sum / N) || 1, g = 0.12 / rms; // même niveau RMS pour toutes les boucles
  for (let i = 0; i < N; i++) out[i] *= g;
  return out;
}

/** Petite détonation d'échappement (bruit filtré à décroissance rapide). */
export function synthPop(sampleRate: number, seed: number): Float32Array<ArrayBuffer> {
  const len = Math.floor(sampleRate * 0.18), out = new Float32Array(len), r = rng(seed);
  let lp = 0, lp2 = 0;
  const cutoff = 0.08 + r() * 0.1;
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * (35 + r() * 5)) * (t < 0.002 ? t / 0.002 : 1);
    const n = r() * 2 - 1;
    lp += cutoff * (n - lp); lp2 += 0.3 * (lp - lp2);
    out[i] = (lp2 * 3 + n * 0.25 * Math.exp(-t * 120)) * env;
  }
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < len; i++) out[i] *= 0.8 / (peak || 1);
  return out;
}

/** Démarreur (« wouin-wouin ») : dent de scie modulée. */
export function synthStarter(sampleRate: number): Float32Array<ArrayBuffer> {
  const len = Math.floor(sampleRate * 0.7), out = new Float32Array(len), r = rng(7);
  let ph = 0, lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const f = 140 + 25 * Math.sin(t * 2 * Math.PI * 9);
    ph += f / sampleRate; ph -= Math.floor(ph);
    const saw = ph * 2 - 1, n = r() * 2 - 1;
    lp += 0.15 * (saw + 0.3 * n - lp);
    const env = Math.min(1, t / 0.03) * Math.min(1, (0.7 - t) / 0.08);
    out[i] = lp * 0.35 * env * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 9));
  }
  return out;
}
