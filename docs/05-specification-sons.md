# 05 — Spécification des sons (ce que tu dois me fournir)

> TL;DR : par véhicule, **des boucles WAV à régime constant**, en charge et hors charge,
> tous les 500 à 1000 tr/min, + ralenti + démarrage/arrêt + pétarades. Je m'occupe de
> l'encodage final et de la normalisation.

## 1. Format source attendu
| Paramètre | Valeur demandée | Acceptable |
|---|---|---|
| Format | **WAV (PCM)** | FLAC, AIFF |
| Fréquence d'échantillonnage | **48 kHz** | 44,1 kHz |
| Profondeur | **24 bits** | 16 bits |
| Canaux | **Mono** (préféré pour l'habitacle) | Stéréo |
| Normalisation | Ne pas normaliser fichier par fichier ; garder le **même gain** pour tous les fichiers d'un véhicule | — |
| Crête | ≤ −1 dBFS, aucune saturation | — |
| ❌ Interdit | MP3 / AAC comme source (pertes + clics de boucle), sons avec musique, voix, vent, pneus, klaxons | — |

## 2. Contenu par véhicule

### 2.1 Boucles à régime constant (obligatoire)
| Élément | Détail |
|---|---|
| Régimes | De ~1000 tr/min jusqu'à la zone rouge, **un fichier tous les 500 tr/min** (idéal) ou 1000 tr/min (minimum) |
| Variante **onLoad** | Moteur en charge (accélération) — **obligatoire** |
| Variante **offLoad** | Moteur hors charge (lâcher de pédale / décélération) — **fortement recommandé** (sinon je dérive de onLoad avec filtre, moins réaliste) |
| Durée | **2 à 6 s** chacune |
| Stabilité | Régime **constant** sur tout le fichier (±50 tr/min max), pas de montée/descente |
| Bouclage | Idéalement déjà bouclable sans clic. Sinon fournis un fichier plus long (≥ 6 s) stable et je découpe la boucle |
| Exemple pour un V8 rouge à 6500 | onLoad : 1000, 1500, …, 6500 (12 fichiers) + offLoad idem (12) = 24 fichiers |

### 2.2 Sons ponctuels
| Fichier | Obligatoire ? | Durée | Remarque |
|---|---|---|---|
| `idle` | **Oui** | 3–8 s, bouclable | Ralenti stable |
| `startup` | Recommandé | 1–4 s | Démarrage, finit sur un ralenti proche de `idle` |
| `shutdown` | Optionnel | 1–3 s | Coupure moteur |
| `pop_01…pop_05` | Optionnel | 0,05–0,5 s chacun | Pétarades/crépitements isolés, **séparés**, silence autour coupé |
| `limiter` | Optionnel | 1–2 s | Rupteur |
| `shift` | Optionnel | 0,1–0,4 s | Bruit de passage de rapport |

### 2.3 Infos techniques du véhicule (un petit texte suffit)
- Nom affiché, type de moteur (ex. V8 5.0 atmo)
- Régime de ralenti, zone rouge, rupteur
- Nombre de rapports (et rapports de boîte/pont si tu les connais, sinon je mets des valeurs réalistes)
- Pour chaque fichier : le **régime exact** (dans le nom du fichier, cf. §3)

### 2.4 Plan B si tu n'as pas de boucles à régime constant
Si tu n'as qu'un **enregistrement de montée en régime** (« sweep » / accélération continue),
c'est exploitable mais moins bon : fournis une montée **lente et régulière** (≥ 10 s du ralenti à
la zone rouge, idéalement sur 3e/4e) + une descente en lâcher de pied. Je découperai des tranches.
Indique-moi les régimes de début et de fin. Qualité attendue : correcte, pas excellente.

## 3. Convention de nommage
```
sounds-src/<id-vehicule>/
  on_1000.wav   on_1500.wav   ...   on_6500.wav
  off_1000.wav  off_1500.wav  ...   off_6500.wav
  idle.wav
  startup.wav
  shutdown.wav
  pop_01.wav  pop_02.wav  ...
  limiter.wav
  shift.wav
  info.txt          ← infos §2.3
```
- `<id-vehicule>` : minuscules, tirets (`v8-muscle`, `v12-supercar`, `i4-turbo`).
- Le nombre dans le nom = régime en tr/min.

## 4. Ce que je fais ensuite (pipeline `tools/build-sounds.mjs`)
1. Vérification : fréquence, canaux, crêtes, durée, régimes manquants.
2. Mesure de la hauteur fondamentale de chaque boucle → contrôle de cohérence avec le régime annoncé.
3. Détection/optimisation des points de boucle (passage par zéro + crossfade interne 10–20 ms).
4. Normalisation **globale** du véhicule (LUFS), égalisation légère.
5. Encodage livré : **Opus 96–128 kbit/s** (WebM) → ~10× plus léger que le WAV ; poids cible ≤ 10 Mo/véhicule.
6. Génération automatique du `vehicle.json`.

## 5. Volume de données estimé
| | Fichiers | Poids WAV source | Poids livré (Opus) |
|---|---|---|---|
| Véhicule complet (500 tr/min, on+off) | ~30 | ~15–25 Mo | ~1,5–3 Mo |
| Véhicule minimal (1000 tr/min, onLoad seul) | ~8 | ~5 Mo | < 1 Mo |

## 6. Envoi
Une archive ZIP par véhicule (ou un dossier partagé). Le dossier `sounds-src/` ne sera **pas**
publié sur le site (seuls les fichiers encodés le sont) — voir doc 09 pour les droits.
