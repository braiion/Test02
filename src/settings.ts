export interface Settings { volume: number; lookaheadMs: number; mode: "gps" | "demo"; debug: boolean; simMode: SimMode }
export type SimMode = "perfect" | "gps" | "gps+imu";
const KEY = "enginesync.settings.v1";
const DEF: Settings = { volume: 0.8, lookaheadMs: 400, mode: "demo", debug: false, simMode: "perfect" };
export function loadSettings(): Settings {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEF }; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ } }
