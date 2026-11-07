export interface SampleRef { rpm: number; file: string }
export interface VehicleProfile {
  id: string;
  name: string;
  engine: string;
  cylinders: number;
  idleRpm: number;
  redlineRpm: number;
  limiterRpm: number;
  gears: number[];
  finalDrive: number;
  wheelCircumferenceM: number;
  /** Point de passage réel pied au plancher (tr/min) ; option : un régime par rapport (1→2, 2→3…). */
  shift?: { wotRpm: number; perGear?: number[]; note?: string };
  aMaxMs2: number;
  inertia: { tauUpMs: number; tauDownMs: number };
  shiftStyle?: "soft" | "hard";
  perf?: { zeroTo100s: number; topSpeedKmh: number; launchAccel: number; drag?: number };
  synth?: SynthParams;
  samples: null | {
    onLoad: SampleRef[];
    offLoad?: SampleRef[];
    idle?: string;
    startup?: string;
    shutdown?: string;
    pops?: string[];
    limiter?: string;
  };
}
/** Paramètres du son de remplacement synthétique (en attendant les vrais enregistrements). */
export interface SynthParams {
  irregularity: number; // énergie des harmoniques hors allumage (V8 cross-plane = élevé)
  brightness: number;   // fréquence de coupure de base (Hz)
  noise: number;        // souffle admission/échappement
  rough: number;        // rugosité (étalement des harmoniques)
}
export interface EngineInput { v: number; a: number }
export interface EngineState {
  rpm: number; gear: number; load: number; running: boolean;
  limiter: boolean; shifting: boolean;
}
export type EngineEvent = { type: "pop"; delay: number } | { type: "shift" } | { type: "starter" };
