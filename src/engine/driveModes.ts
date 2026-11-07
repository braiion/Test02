/**
 * Modes de conduite : comme sur une vraie voiture, ils changent la loi de passage des rapports,
 * la sensibilité de la pédale, la vivacité du moteur (et donc du compte-tours) et les effets.
 * Les régimes sont exprimés en fraction de la zone rouge du véhicule simulé.
 */
export type DriveModeId = "confort" | "normal" | "sport";

export interface DriveMode {
  id: DriveModeId;
  label: string;
  upshiftLow: number;      // passage montant à charge faible (fraction de la zone rouge)
  upshiftHigh: number;     // passage montant pied au plancher
  downshiftCoast: number;  // rétrogradage en roue libre / croisière
  downshiftBrake: number;  // au freinage : on rétrograde dès que le régime APRÈS rétrogradage reste sous ce plafond
  kickdownLoad: number;    // charge déclenchant le kick-down
  pedalGamma: number;      // courbe pédale : charge = (accél / accél max possible)^gamma (<1 = nerveux)
  tauScale: number;        // vivacité moteur / compte-tours (multiplie les constantes d'inertie)
  shiftTime: number;       // durée de coupure au passage montant (s)
  minGearHold: number;     // temps mini entre deux changements (s)
  blip: number;            // coup de gaz au rétrogradage (0 = aucun, 1 = franc)
  pops: number;            // intensité des pétarades (0–1)
  holdOnLift: boolean;     // ne pas monter de rapport au lever de pied (garde le frein moteur)
}

export const DRIVE_MODES: Record<DriveModeId, DriveMode> = {
  confort: {
    id: "confort", label: "Confort",
    upshiftLow: 0.27, upshiftHigh: 0.72, downshiftCoast: 0.17, downshiftBrake: 0.42,
    kickdownLoad: 0.95, pedalGamma: 1.5, tauScale: 1.6, shiftTime: 0.28, minGearHold: 1.0,
    blip: 0, pops: 0, holdOnLift: false,
  },
  normal: {
    id: "normal", label: "Normal",
    upshiftLow: 0.33, upshiftHigh: 0.93, downshiftCoast: 0.2, downshiftBrake: 0.6,
    kickdownLoad: 0.8, pedalGamma: 1.0, tauScale: 1.0, shiftTime: 0.16, minGearHold: 0.6,
    blip: 0.5, pops: 0.5, holdOnLift: false,
  },
  sport: {
    id: "sport", label: "Sport",
    upshiftLow: 0.6, upshiftHigh: 0.985, downshiftCoast: 0.38, downshiftBrake: 0.8,
    kickdownLoad: 0.55, pedalGamma: 0.6, tauScale: 0.65, shiftTime: 0.07, minGearHold: 0.35,
    blip: 1, pops: 1, holdOnLift: true,
  },
};
