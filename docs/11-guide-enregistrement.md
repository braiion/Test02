# 11 — Guide d'enregistrement des sons moteur

> Objectif : rapporter **des prises brutes propres**. Le découpage en boucles, la normalisation
> et l'encodage, c'est moi qui m'en occupe. Ta mission : un son **net, sans saturation, sans vent**,
> avec le **régime connu** à chaque instant.

## 0. Résumé en 10 lignes
1. Enregistreur en **32 bits flottants** (plus de risque de saturation) ou 24 bits / 48 kHz.
2. **2 micros minimum** : un à l'**échappement**, un côté **admission/moteur**. Bonnettes anti-vent obligatoires.
3. Un **boîtier OBD + appli** qui enregistre le régime (tr/min) en même temps (fortement conseillé).
4. Un **clap** au début de chaque prise (synchronise audio et OBD).
5. À l'arrêt : démarrage à froid, ralenti, coups de gaz, **paliers de régime stabilisés**, arrêt moteur.
6. En roulant (**circuit / route fermée uniquement**) : **montées en régime lentes pied au plancher**
   sur un rapport haut (3e/4e), puis **décélérations pied levé** sur le même rapport.
7. Chaque prise répétée **3 fois**.
8. Pas de musique, pas de voix pendant les prises, pas de vent, pas de pluie.
9. Remplir la **fiche de prises** (§8) au fur et à mesure.
10. Me livrer : les WAV bruts + les CSV OBD + la fiche + les photos de placement des micros.

---

## 1. Matériel

### 1.1 Enregistreur (le plus important)
| Option | Exemples | Pourquoi |
|---|---|---|
| ⭐ Recommandé | Enregistreur **32 bits flottants** avec 2 entrées micro (gamme Zoom « essential » ou série F, Tascam Portacapture, etc.) | En 32 bits flottants, **impossible de saturer** : un échappement peut dépasser 130 dB, c'est LA cause n°1 de prises ratées |
| Correct | Enregistreur 24 bits classique 2–4 pistes (Zoom H5/H6, Tascam DR-40X…) | Il faudra bien régler le gain (§3) |
| Dépannage | Smartphone | Uniquement avec une appli qui **désactive le contrôle automatique de gain et la réduction de bruit** (mode « brut / mesure »), format WAV. Sinon le son est compressé et inutilisable pour les boucles |

### 1.2 Micros
| Position | Type conseillé | Point clé |
|---|---|---|
| Échappement | Micro **dynamique** (type SM57) ou micro-cravate **haute pression** (SPL max ≥ 130 dB, vérifie la fiche technique) | Résiste aux très fortes pressions |
| Admission / compartiment moteur | Micro-cravate | Apporte le « mécanique » et l'aspiration (très présent sur un V10/V12 atmo) |
| Option : habitacle | Micro de l'enregistreur / cravate | Utile pour référence, **pas** pour les boucles (bruits de roulement) |

Accessoires indispensables : **bonnettes poilues** (« dead cat ») sur chaque micro en roulant,
**gaffer tape**, colliers, rallonges XLR/jack, piles/batteries de rechange, cartes SD (≥ 32 Go).

### 1.3 OBD (régime moteur)
- Un boîtier **OBD-II Bluetooth** (type ELM327 de bonne qualité ou OBDLink) + une appli qui
  **enregistre en CSV** le régime avec horodatage (Car Scanner, Torque Pro, OBD Fusion…).
- Toutes ces voitures ont une prise OBD-II (V8 récent, Carrera GT, Aventador).
- Taux d'échantillonnage : demande **uniquement le RPM** (et la vitesse si possible) → fréquence plus élevée.
- **Sans OBD** c'est quand même possible : je retrouve le régime en analysant la fréquence
  d'allumage dans le son (V8 : rpm/60 × 4, V10 : × 5, V12 : × 6). Mais l'OBD fiabilise tout.

## 2. Placement des micros

### Échappement (micro principal)
```
          vue de dessus
   ┌──────────────────┐
   │     VOITURE      │
   └──┬────────────┬──┘
      ◯            ◯   ← sorties
       \
        \  45°, 50 cm à 1 m
         🎤
```
- **Jamais dans l'axe du flux** (souffle = saturation + bruit de vent) : décalé à ~45°.
- **À l'arrêt** : sur pied, 50 cm à 1 m derrière/à côté de la sortie, à hauteur de la sortie.
- **En roulant** : fixé sous le pare-chocs arrière ou sur le support de plaque, **à 15–30 cm de la
  sortie, hors du flux, loin des parties chaudes** (une sortie d'échappement dépasse 500 °C).
  Bonnette + mousse, câble scotché tous les 20 cm, loin des roues et de la ligne d'échappement.
- Sur une voiture à 2 ou 4 sorties : vise la sortie côté opposé à la circulation d'air dominante ;
  si tu as 2 micros d'échappement, un de chaque côté = stéréo naturelle.

### Admission / moteur
- **Carrera GT et Aventador** : moteur central arrière → micro dans le compartiment moteur, côté
  prise d'air, **loin des collecteurs et des courroies**, fixé sur une partie froide (tôle de carrosserie).
- **V8 avant** : sous le capot, près du boîtier de filtre à air, loin du ventilateur et des collecteurs.
- Vérifie avec le propriétaire / mécano qu'aucun câble ne peut toucher une partie mobile ou chaude.

## 3. Réglages de l'enregistreur
| Réglage | Valeur |
|---|---|
| Format | **WAV**, **48 kHz**, **32 bits flottants** (sinon 24 bits) |
| Pistes | Une piste **par micro** (pas de mixage dans l'enregistreur) |
| Limiteur / compresseur / AGC | **Désactivés** |
| Filtre coupe-bas (low-cut) | **Désactivé** (on veut le grave) |
| Gain (si pas 32 bits flottants) | Fais un essai au rupteur : crêtes vers **−12 dBFS**. Ne touche plus le gain ensuite de toute la session (sinon les boucles ne seront pas cohérentes entre elles) |
| Pré-enregistrement | Activé si disponible (2 s) |

## 4. Avant chaque prise : le rituel
1. Lancer l'enregistrement audio **et** l'enregistrement OBD.
2. Annoncer à voix haute : « Prise 12, V12, rapport 3, montée pleine charge ».
3. **Clap** franc devant le micro échappement (ou coup de klaxon court) → repère de synchro.
4. 3 s de silence (ralenti), puis l'action.
5. 3 s de ralenti à la fin, puis stop.

## 5. Programme de la séance

### A. À l'arrêt (parking calme, extérieur, loin des murs)
| # | Prise | Détail | Sert à |
|---|---|---|---|
| A1 | Démarrage à froid | Moteur froid si possible (son de démarrage plus spectaculaire) | `startup` |
| A2 | Ralenti | 60 s, moteur chaud, sans toucher | `idle` |
| A3 | Paliers stabilisés | Tenir **chaque régime 8–10 s** : 1500, 2000, 2500, 3000… aussi haut que la voiture le permet à l'arrêt | boucles **hors charge** (offLoad) |
| A4 | Coups de gaz | 5 coups secs vers 4000–6000 puis lâcher | pétarades, `pops` |
| A5 | Rupteur | 1–2 s au rupteur si la voiture le permet à l'arrêt (beaucoup limitent le régime au point mort) | `limiter` |
| A6 | Arrêt moteur | Coupure depuis le ralenti | `shutdown` |

⚠️ À l'arrêt, ne tiens pas longtemps les hauts régimes (chauffe, usure). Laisse refroidir entre les paliers hauts.

### B. En roulant (circuit, piste privée, route fermée — jamais sur route ouverte)
| # | Prise | Détail | Sert à |
|---|---|---|---|
| B1 | **Montée pleine charge lente** | Rapport **haut** (3e ou 4e) depuis ~1500 tr/min jusqu'au rupteur, pied **à fond**. Plus le rapport est haut, plus la montée est lente = meilleures boucles. **×3** | boucles **en charge** (onLoad) — **la prise la plus importante** |
| B2 | **Décélération pied levé** | Même rapport, du haut régime jusqu'à ~1500, pied totalement levé. **×3** | boucles **hors charge**, pétarades |
| B3 | Charge partielle stabilisée (option) | Tenir 2000 / 3000 / 4000 tr/min ~6 s à mi-pédale | réalisme en croisière |
| B4 | Passages de rapports (option) | Accélération 1re→4e pied à fond | son `shift`, référence de rendu |
| B5 | Lâchers agressifs (option) | Lâcher brutal à haut régime | `pops` supplémentaires |

Avec un **pilote au volant et toi passager** qui gère l'enregistreur et la fiche.

**Astuce boîte auto (SVJ, V8 auto)** : passe en **mode manuel** et bloque le rapport, sinon la boîte
rétrograde/monte toute seule et la montée en régime est trop rapide.

## 6. Spécificités par véhicule
| | V8 américain | V10 type Carrera GT | V12 type Aventador SVJ |
|---|---|---|---|
| Plage à couvrir | ~750 → 6500–7500 | ~1000 → 8400 | ~1000 → 8700 |
| Fréquence d'allumage à 3000 tr/min | 200 Hz | 250 Hz | 300 Hz |
| Caractère | Grave, « gargouillis » au ralenti (vilebrequin cross-plane) | Très aigu, hurlement mécanique, montée très rapide (volant moteur léger) | Rugissement aigu, pétarades fortes au lâcher, coups de boîte ISR très marqués |
| Prise la plus délicate | Ralenti (le gargouillis est le signe distinctif) | B1 : le moteur prend des tours extrêmement vite → **rapport le plus haut possible** | Échappement très puissant → micro hors flux + 32 bits flottants |
| Micro admission | Utile | **Essentiel** (le son mécanique du V10 fait 50 % du caractère) | Très utile |

## 7. Conditions & pièges
- ❌ Vent (même faible, en roulant tout est « vent ») → bonnettes, micro protégé derrière le pare-chocs.
- ❌ Parking souterrain / près de murs → réverbération impossible à retirer.
- ❌ Voix, musique, autres voitures pendant la prise.
- ❌ Modifier le gain en cours de séance.
- ❌ Micro qui frotte / câble qui vibre (bruits de manipulation).
- ✅ Écouter **au casque** une prise test complète avant de faire toute la séance.
- ✅ Photographier le placement des micros (je saurai interpréter le son).
- ✅ Demander l'autorisation écrite (un message suffit) au propriétaire du véhicule et à l'organisateur de piste.

## 8. Fiche de prises (à recopier / imprimer)
| Prise | Véhicule | Micro(s) | Situation (A1…B5) | Rapport | Régime début → fin | Remarques (vent, raté…) | OK ? |
|---|---|---|---|---|---|---|---|
| 01 | | | | | | | |
| 02 | | | | | | | |

## 9. Livraison
```
enregistrements/<vehicule>/
  audio/        ← WAV bruts tels que sortis de l'enregistreur (une piste par micro)
  obd/          ← CSV de l'appli OBD
  fiche.csv     ← ou photo de la fiche papier
  photos/       ← placements micros
  infos.txt     ← modèle exact, année, échappement d'origine ou modifié, boîte
```
Je fais ensuite : synchro audio/OBD → découpage des montées B1/B2 en tranches de régime →
création des boucles onLoad/offLoad tous les 250–500 tr/min → normalisation → encodage.

## 10. Plan minimal si tu n'as qu'une courte occasion avec une voiture
Dans l'ordre de priorité : **A2 (ralenti)** → **B1 ×3** → **B2 ×3** → A1 → A6 → A4.
Avec seulement A2 + B1 + B2, on a déjà un véhicule complet et crédible.
