# 07 — Roadmap & plan MVP

## Phase C — Conception ✅ (ce dossier)
Sortie : docs validées par moi, réponses aux questions ouvertes du PRD §9.

## Phase 0 — Diagnostic dans la voiture (≈ 1 session)
Objectif : **mesurer** au lieu de supposer (hypothèses H1–H7 du PRD).

| Tâche | Détail |
|---|---|
| P0.1 | Page `diag/index.html` autonome (pas de build), publiée en HTTPS |
| P0.2 | Affiche : support geolocation, `coords.speed` (null ?), intervalle moyen/min/max entre points, `accuracy`, `DeviceMotionEvent` dispo ?, `AudioContext.baseLatency/outputLatency`, user-agent |
| P0.3 | Bouton « Enregistrer 2 min » → export JSON des points (copiable / téléchargeable) pour rejouer les vrais trajets en simulation sur PC |
| P0.4 | Bip test pour vérifier l'audio en roulant (H5) |

Critère de sortie : on connaît la fréquence GPS réelle et la dispo de la vitesse Doppler →
on fixe les paramètres du filtre et le `lookahead` par défaut.

## Phase 1 — MVP (2–3 véhicules)
| Lot | Tâches | Dépend de |
|---|---|---|
| 1.1 Socle | Vite + TS, structure, déploiement GitHub/Cloudflare Pages, CI build | — |
| 1.2 Audio | `SoundBank` (chargement, décodage), `AudioEngine` (crossfade boucles, onLoad/offLoad, idle, master) | sons d'au moins 1 véhicule |
| 1.3 Sim | `SimSource` + mode Démo → réglage sonore sur PC | 1.2 |
| 1.4 Modèle | `VehicleModel` : boîte, inertie, charge, événements | 1.2 |
| 1.5 Capteurs | `GeoSource` + `StateEstimator` + `Predictor` ; **rejeu des traces JSON de la Phase 0** | Phase 0 |
| 1.6 UI | Garage, Cockpit, Réglages, Debug, persistance | 1.2–1.5 |
| 1.7 Outil sons | `tools/build-sounds.mjs` (ffmpeg) : contrôle, boucles, normalisation, Opus, manifest | sons reçus |
| 1.8 Hors-ligne | Service Worker (cache app + sons) | 1.6 |
| 1.9 Tests route | Protocole doc 08, calibration, ajustements | tout |
| 1.10 Véhicules 2 & 3 | Ajout via dossiers + JSON | 1.7 |

Critères de sortie MVP : PRD §7 atteints (latence médiane ≤ 300 ms, 0 coupure sur 3 trajets).

## Phase 2 — Améliorations (selon résultats)
- Télémétrie Tesla (pédale réelle) si la latence GPS reste frustrante (ADR-003).
- Plus de véhicules, éditeur de profil véhicule.
- Effets : turbo (sifflement lié à la charge), wastegate, boîte manuelle simulée (palettes à l'écran).
- Adaptation au mode de conduite (Chill/Standard → caractère du son).

## Ordre de démarrage concret
1. Tu réponds aux questions PRD §9 + tu m'envoies les sons du **premier** véhicule.
2. Je fais la Phase 0 (page diag) → tu la lances en roulant, tu m'envoies les mesures.
3. En parallèle, je construis 1.1 → 1.4 avec le mode Démo.
