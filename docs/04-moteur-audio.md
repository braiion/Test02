# 04 — Moteur audio

## 1. Principe : synthèse par boucles multi-régimes (« granular RPM crossfade »)
Technique utilisée dans les jeux de course : on dispose de **boucles enregistrées à régime
constant** (ex. 1000, 1500, 2000… 7000 tr/min), en deux variantes :
- **onLoad** : moteur en charge (pied au plancher sur banc ou en côte),
- **offLoad** : moteur hors charge (lâcher de pédale, frein moteur).

À chaque instant, pour un régime `rpm` simulé :
1. On prend les **deux boucles encadrantes** (ex. 3000 et 3500 pour 3200 tr/min).
2. On les mélange avec un **crossfade à puissance constante** (`cos/sin`), pas linéaire (sinon creux de volume).
3. On ajuste la **hauteur** de chacune : `playbackRate = rpm / rpm_sample`
   (borné à 0,85–1,18 pour éviter l'effet « chipmunk »).
4. On mélange onLoad / offLoad selon la charge (0…1).

Toutes les boucles tournent **en permanence** (gain à 0 quand inutilisées) → aucun problème de
démarrage/phase, crossfade instantané. Pour ménager le CPU MCU2 : on ne garde actives que les
boucles dans une fenêtre de ±2 régimes autour du courant (les autres sont stoppées et
recréées à la volée, invisible car gain 0).

## 2. Graphe Web Audio
```
                 ┌─► [Src on_1000]─►[Gain]─┐
 onLoad bank ────┼─► [Src on_1500]─►[Gain]─┼─►[Gain onLoad]──┐
                 └─► ...                   ┘                 │
                 ┌─► [Src off_1000]─►[Gain]┐                 ├─►[LowShelf]─►[Compressor]─►[Master Gain]─► destination
 offLoad bank ───┼─► ...                   ┼─►[Gain offLoad]─┤
                 └─►                       ┘                 │
 idle loop ─────────────────────────────────►[Gain idle]─────┤
 one-shots (startup, pops, shift, limiter) ─►[Gain FX]───────┘
```
- **LowShelf** (+3 dB vers 120 Hz) : compense le manque de grave des haut-parleurs ressenti à faible volume.
- **DynamicsCompressor** : évite la saturation lors des sommes de boucles.
- **Master Gain** : volume utilisateur.

## 3. Modèle véhicule (VehicleModel)
### 3.1 Vitesse → régime
```
rpm_roues   = v / circonférence_roue × 60
rpm_cible   = rpm_roues × rapport[g] × pont
rpm_cible   = clamp(rpm_cible, idleRpm, limiterRpm)
```
### 3.2 Boîte automatique virtuelle
- Montée : quand `rpm ≥ shiftUp(charge)` ; `shiftUp` interpolé entre `low` (charge faible,
  conduite tranquille → passe tôt) et `high` (pleine charge → tire jusqu'à la zone rouge).
- Descente : quand `rpm ≤ shiftDownRpm`, ou rétrogradage « kick-down » si forte accélération soudaine.
- Anti-pompage : temporisation minimale 600 ms entre deux changements.
- Pendant un changement (≈150–250 ms) : coupure brève de charge (gain onLoad ↓), éventuel « pop » de passage.

### 3.3 Inertie
`rpm += (rpm_cible − rpm) × (1 − e^(−dt/τ))`, τ_montée ≈ 120 ms, τ_descente ≈ 250 ms
(changement de rapport : τ ≈ 60 ms pour un coup sec).

### 3.4 Charge (pseudo-pédale)
`load = clamp((a − a_croisière) / a_max_véhicule, 0, 1)` avec hystérésis (cf. doc 03 L3).
`a_max` dépend du véhicule (ex. 4 m/s²) : sur une Tesla qui accélère plus fort que le véhicule
simulé, on sature à 1 (pleine charge) — c'est voulu.

### 3.5 Événements
| Événement | Déclencheur | Son |
|---|---|---|
| Démarrage | Bouton « Démarrer » | `startup` puis fondu vers `idle` |
| Arrêt | Bouton « Couper » | `shutdown` |
| Pétarades | Passage charge→hors charge à rpm > 3500 | 1–3 `pops` aléatoires (pitch ±5 %, gain ±3 dB) |
| Rupteur | `rpm ≥ limiterRpm` et charge > 0,8 | `limiter` ou modulation de gain 15 Hz |
| Passage de rapport | Changement de `gear` | Creux de charge + `shift` éventuel |

## 4. Qualité audio : règles
- Boucles décodées une fois (`decodeAudioData`), `loop = true`, `loopStart/loopEnd` lus dans le manifest si fournis.
- **Pas de MP3** pour les boucles (padding d'encodeur → clic à chaque tour). Encodage : **Opus (WebM/Ogg)** ou **FLAC**.
- Toutes les variations de paramètres via `setTargetAtTime` (jamais `.value =` en direct).
- Normalisation de toutes les boucles d'un véhicule au **même niveau perçu** (LUFS) en amont
  (outil `tools/build-sounds.mjs`), sinon le crossfade « pompe ».

## 5. Mode Démo / Simulation
`SimSource` : curseur de pédale 0–100 % + bouton frein ; physique simple
(`a = pédale × a_max − frottements`) → même pipeline que le GPS. Sert à :
- régler les sons à la maison sur PC,
- tester dans la voiture à l'arrêt,
- démontrer le rendu sans rouler.
