# 02 — Architecture technique

## 1. Principes
- **100 % côté client** : tout tourne dans le navigateur de la Tesla. Pas de serveur = pas de
  latence réseau dans la boucle temps réel, et coût 0 €.
- **Site statique** hébergé gratuitement en HTTPS.
- **Web Audio API** pour tout le rendu sonore (planification à l'échantillon près, threads audio natifs).
- **Aucune dépendance lourde** : TypeScript + Vite, pas de framework UI (ou Preact si besoin, ~4 ko).

## 2. Stack
| Couche | Choix | Raison |
|---|---|---|
| Langage | TypeScript | Robustesse du modèle physique / audio |
| Build | Vite | Rapide, sortie statique, hash des assets |
| UI | HTML/CSS vanilla (+ Preact éventuel) | Léger pour MCU2 |
| Audio | Web Audio API (`AudioBufferSourceNode`, `GainNode`, `BiquadFilterNode`, `DynamicsCompressorNode`) | Natif, faible latence, pas de JS dans le chemin audio |
| Capteurs | Geolocation API (`watchPosition`, `enableHighAccuracy`) | Seule source vitesse dispo sans serveur |
| Persistance | `localStorage` | Réglages |
| Hors-ligne | Service Worker (cache des sons) | Pas de rechargement en zone blanche |
| Hébergement | GitHub Pages ou Cloudflare Pages | Gratuit, HTTPS, CDN |
| Tests | Vitest (logique), page de simulation (audio) | |
| Outillage sons | Script Node/ffmpeg : normalisation, contrôle des boucles, encodage | |

## 3. Vue d'ensemble

```
┌──────────────────────── Navigateur Tesla ────────────────────────┐
│                                                                   │
│  [Geolocation]──► SensorSource ──► StateEstimator ──► Predictor   │
│  (≈1 Hz)          (brut)          (filtre α-β /     (projection  │
│                                    Kalman 1D)        à t+Δ)      │
│  [Mode Démo]───►  SimSource ─┘                          │         │
│                                                         ▼         │
│                                                  VehicleModel     │
│                                         (vitesse → régime, rapport│
│                                          charge/hors-charge,      │
│                                          inertie moteur)          │
│                                                         │ 60 Hz   │
│                                                         ▼         │
│                                                   AudioEngine     │
│                                   (crossfade N boucles, pitch,    │
│                                    one-shots, filtres, master)    │
│                                                         │         │
│                                                         ▼         │
│                                              Haut-parleurs voiture│
│  UI (sélection, réglages, debug overlay) ◄──── état partagé       │
└───────────────────────────────────────────────────────────────────┘
```

## 4. Modules

| Module | Responsabilité | Entrée → Sortie |
|---|---|---|
| `sensors/GeoSource` | `watchPosition`, horodatage, rejet des points aberrants | → `{t, speed, accuracy, lat, lon}` |
| `sensors/SimSource` | Pédale virtuelle + physique simplifiée (mode démo / PC) | → même interface |
| `estimation/StateEstimator` | Filtre vitesse + accélération (α-β ou Kalman 1D) | échantillons → `{v, a}` lissés |
| `estimation/Predictor` | Extrapole l'état à « maintenant + lookahead » | `{v,a,t}` → `v(t+Δ)` à 60 Hz |
| `engine/VehicleModel` | Boîte virtuelle, régime, charge, inertie, rupteur | `v, a` → `{rpm, load, gear, events}` |
| `audio/AudioEngine` | Graphe Web Audio, crossfade des boucles, one-shots | `{rpm, load}` → son |
| `audio/SoundBank` | Chargement, décodage, cache des samples d'un véhicule | manifest JSON → `AudioBuffer[]` |
| `config/vehicles/*.json` | Définition d'un véhicule (samples, régimes, rapports) | — |
| `ui/*` | Écrans, réglages, overlay debug | — |
| `diag/` | Page de diagnostic Phase 0 (autonome) | — |

### Boucle temps réel
- Les capteurs arrivent de façon **asynchrone** (≈1 Hz).
- Une boucle **`requestAnimationFrame` (≈60 Hz)** demande au `Predictor` l'état extrapolé,
  le passe au `VehicleModel`, puis applique les paramètres audio via
  `AudioParam.setTargetAtTime()` (lissage natif côté thread audio, pas de « zipper noise »).
- Si l'onglet n'est plus visible (rAF ralenti), un `setInterval` 30 Hz de secours prend le relais.

## 5. Format « véhicule » (manifest)
```jsonc
// public/vehicles/v8-muscle/vehicle.json
{
  "id": "v8-muscle",
  "name": "V8 Muscle",
  "idleRpm": 800,
  "redlineRpm": 6500,
  "limiterRpm": 6700,
  "gears": [3.2, 2.1, 1.5, 1.15, 0.9, 0.72],   // rapports de boîte
  "finalDrive": 3.55,
  "wheelCircumferenceM": 2.1,
  "shiftUpRpm":  { "low": 2500, "high": 6000 },  // selon charge
  "shiftDownRpm": 1300,
  "samples": {
    "onLoad":  [ { "rpm": 1000, "file": "on_1000.opus" }, ... ],
    "offLoad": [ { "rpm": 1000, "file": "off_1000.opus" }, ... ],
    "idle":    "idle.opus",
    "startup": "startup.opus",
    "shutdown":"shutdown.opus",
    "pops":    ["pop_01.opus", "pop_02.opus"],
    "limiter": "limiter.opus"
  },
  "mix": { "masterGainDb": -3, "lowShelfDb": 3 }
}
```
Ajouter un véhicule = déposer un dossier + un JSON. Aucun code.

## 6. Contraintes navigateur Tesla
| Contrainte | Conséquence |
|---|---|
| Chromium récent mais CPU faible sur MCU2 | Graphe audio simple : max ~8 sources actives, pas d'AudioWorklet lourd |
| Autoplay bloqué | Bouton « Démarrer » obligatoire → `audioContext.resume()` |
| Vidéo bloquée en roulant, audio OK (à confirmer H5/H7) | On ne fait que de l'audio |
| Écran tactile, conducteur | Gros boutons, pas de saisie texte |
| Connexion LTE variable | Préchargement total + Service Worker |
| HTTPS requis pour la géoloc | Hébergement HTTPS uniquement |
| Pas de Web Bluetooth / Web Serial (probable) | Pas d'accès direct à un dongle CAN depuis le navigateur |

## 7. Arborescence cible
```
/
├─ docs/                    ← conception (ce dossier)
├─ diag/index.html          ← page de diagnostic Phase 0 (autonome, sans build)
├─ src/
│  ├─ sensors/  estimation/  engine/  audio/  ui/
│  └─ main.ts
├─ public/vehicles/<id>/    ← vehicle.json + sons encodés
├─ sounds-src/<id>/         ← sons sources WAV (non publiés, .gitignore ou LFS)
├─ tools/build-sounds.mjs   ← normalisation + encodage + contrôle boucles
└─ tests/
```

## 8. Phase 2 (optionnelle) — Télémétrie Tesla
Voir doc 03 §6. Introduirait un petit serveur (Fleet Telemetry → WebSocket) et donc un coût
et de la latence réseau. Gardé **hors MVP**, uniquement si la Phase 0 montre que le GPS est
inexploitable ou si on veut la vraie position de pédale.
