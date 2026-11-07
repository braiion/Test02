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

**Calibrage pour le Model Y Juniper Grande Autonomie** (0–100 ≈ 5 s) : accélération moyenne
≈ 5,5 m/s², pic ≈ 7 m/s² au démarrage, régénération max ≈ −2 à −3 m/s² en lâcher de pédale.
→ `a_max` par défaut = **5 m/s²** (pleine charge atteinte un peu avant le plancher réel),
seuil hors charge −0,3 m/s² (la régénération déclenche donc bien le frein moteur + pétarades).
Un 0–100 en 5 s couvre ~3 rapports d'un V8 : la boîte virtuelle doit pouvoir monter vite
(temporisation anti-pompage 600 ms ⇒ OK).

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

## 6. Réalisme : calage sur les vraies performances (v0.3)

### 6.1 Courbe de performance (`src/engine/performance.ts`)
Pour chaque voiture (la Tesla **et** les véhicules simulés) :
`a_max(v) = min(a0, k/v) − c·v² − r`, coupée à la vitesse maxi.
- `a0` : motricité au départ, `k` : puissance massique (ajustée automatiquement pour retrouver le **0–100 publié**),
  `c` : traînée aéro, `r` : frottements.

| Voiture | 0–100 | Vmax | a0 | Source |
|---|---|---|---|---|
| Tesla Model Y Grande Autonomie Juniper (hôte) | 4,8 s | 201 km/h | 7,5 m/s² | fiche constructeur (modifiable dans l'appli) |
| V8 américain (type Mustang GT) | 4,5 s | 250 km/h | 8 | ordre de grandeur |
| V10 type Carrera GT | 3,9 s | 330 km/h | 9 | données publiées |
| V12 type Aventador SVJ | 2,8 s | 350 km/h | 11 | données publiées |

### 6.2 Pédale relative
La Tesla pousse 7,4 m/s² à 30 km/h mais 2 m/s² à 150 km/h. Avant, l'accélération absolue faisait croire
à un « demi-gaz » à haute vitesse. Maintenant : `ratio = a_mesurée / a_max_Tesla(v)` → pied au plancher = 100 % partout.

### 6.3 Calage du véhicule simulé
À **temps de pied au plancher égal**, on place le véhicule simulé à la vitesse qu'aurait la vraie voiture :
`v_simulée = vitesse_vraie_voiture( temps_Tesla(v_réelle) )`.
Exemple : Model Y à 100 km/h (4,8 s) ↔ SVJ à 141 km/h → le régime et les rapports montent au rythme d'une SVJ.
La fonction est monotone et sans état (pas de dérive). L'affichage montre toujours la vitesse **réelle**.
Désactivable (« Caler le véhicule simulé… »).

## 7. Modes de conduite (`src/engine/driveModes.ts`)
| Paramètre | Confort | Normal | Sport |
|---|---|---|---|
| Passage montant (fraction zone rouge, charge faible → plancher) | 0,27 → 0,72 | 0,33 → 0,93 | 0,60 → 0,985 |
| Rétrogradage au freinage : régime max après rétro | 0,42 | 0,60 | 0,80 |
| Rétrogradage en roue libre | 0,17 | 0,20 | 0,38 |
| Kick-down à partir de charge | 0,95 | 0,80 | 0,55 |
| Courbe pédale (gamma) | 1,5 (douce) | 1,0 | 0,6 (nerveuse) |
| Vivacité moteur / compte-tours (× inertie) | 1,6 (lent) | 1,0 | 0,65 (vif) |
| Coupure au passage montant | 0,28 s | 0,16 s | 0,07 s |
| Coup de gaz au rétrogradage | non | léger | franc + pétarade |
| Pétarades | aucune | modérées | max |
| Garde le rapport au lever de pied | non | non | oui |

Règle commune : **une boîte ne monte jamais de rapport en décélération** (sauf sur-régime) ;
au freinage, elle rétrograde dès que le régime après rétrogradage reste sous le plafond du mode.

### 6.4 Régimes et rapports (vérifiés sur sources, v0.3.1)
| Véhicule | Ralenti | Zone rouge | Rupteur | Rapports / pont | Vitesse au rupteur par rapport (km/h) |
|---|---|---|---|---|---|
| V8 type Mustang GT (Coyote 5.0) | 700 | 7500 | 7500 | 3,66 · 2,43 · 1,69 · 1,32 · 1,00 · 0,65 / 3,73 | 70 · 105 · 151 · 194 · 256 · (393) |
| V10 type Carrera GT | 1000 | 8400 | 8400 | 3,2 · 1,87 · 1,36 · 1,07 · 0,9 · 0,75 / 4,44 *(source unique)* | 79 · 135 · 186 · 236 · 281 · 337 |
| V12 type Aventador SVJ | 1000 | 8500 (puissance max) | 8700 | 3,909 · 2,438 · 1,810 · 1,458 · 1,185 · 0,967 · 0,844 / 2,867 | 104 · 167 · 225 · 279 · 343 · (420) · (482) |

Les derniers rapports sont des surmultipliées (vitesse maxi atteinte avant le rupteur, limitée par l'aéro) : normal.
Sources : km77.com, lambocars.com, motormatchup.com, Wikipedia (Porsche Carrera GT), thedrive.com, carthrottle.com.

### 6.5 Points de passage réels par rapport (v0.3.2)
Chaque véhicule déclare son passage pied au plancher réel (`shift.wotRpm`, avec option `perGear` pour un régime
différent par rapport). Mode Sport = ce régime exact ; Normal = 96 % ; Confort = 76 %.
Le régime après passage découle des vrais rapports (`régime × rapport suivant / rapport actuel`).

| Véhicule | Passage plancher | Régime après passage (1→2, 2→3, 3→4…) |
|---|---|---|
| V8 type Mustang GT | 7300 (zone rouge 7500) | 4847 · 5077 · 5702 · 5530 · 4745 |
| V10 type Carrera GT | 8300 (rupteur 8400) | 4850 · 6036 · 6530 · 6981 · 6917 |
| V12 type SVJ | 8500 (puissance max, rupteur 8700) | 5301 · 6311 · 6847 · 6908 · 6936 · 7419 |

Le tableau complet (vitesse de la vraie voiture et vitesse Tesla correspondante à chaque passage) est affiché
dans l'appli, section « Ma Tesla & calage ». Avec le calage, une Model Y (201 km/h max) parcourt les rapports
1 à 4 d'une SVJ, 1 à 4 d'une Carrera GT et 1 à 5 d'une Mustang.
