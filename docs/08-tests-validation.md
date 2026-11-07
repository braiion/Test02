# 08 — Tests & validation

## 1. Tests automatisés (Vitest)
| Module | Cas |
|---|---|
| StateEstimator | Converge sur vitesse constante ; suit une rampe d'accélération ; rejette les points aberrants ; gère timestamps dupliqués |
| Predictor | Extrapolation correcte ; décroissance de `a` sur perte GPS ; bornes |
| VehicleModel | Vitesse → rpm/rapport ; pas de pompage ; rupteur ; montée tardive à pleine charge |
| Crossfade | Somme des puissances = 1 ; sélection des bonnes boucles encadrantes ; bornes de pitch |
| Manifest | Validation du `vehicle.json` (régimes triés, fichiers existants) |

## 2. Rejeu de traces réelles
Les traces JSON enregistrées en Phase 0 sont rejouées en accéléré dans le pipeline :
on trace `v_brute`, `v_prédite` et `v_brute` décalée dans le temps → on mesure l'**erreur de
prédiction** et le **retard résiduel** (corrélation croisée). Sert à régler α/β et `lookahead`
sans reprendre la voiture.

## 3. Mesure de latence sur route (protocole)
Objectif : mesurer le retard entre l'accélération réelle et la réaction du son.

**Méthode simple (téléphone)** :
1. Téléphone filmant à 60 fps (ou 240 fps) le pied/la pédale **et** enregistrant l'habitacle (son).
   Passager uniquement, ou caméra fixée — jamais le conducteur.
2. Depuis ~30 km/h stabilisés, accélération franche.
3. Au visionnage image par image : `latence = t(changement de son) − t(début d'enfoncement de pédale)`.
4. Répéter 10 fois ; noter médiane et max. Faire de même au lâcher de pédale.

**Méthode instrumentée (option)** : l'overlay debug log l'instant où `load` franchit le seuil ;
l'accéléromètre du téléphone (app type « sensor logger ») donne l'instant réel de l'accélération ;
on aligne les deux horloges via un bip de synchro joué par le site.

## 4. Tests d'endurance & compatibilité
- 30 min de conduite continue : pas de coupure, pas de dérive mémoire (overlay : sources actives stables).
- Navigateur en plein écran et demi-écran.
- Perte réseau en route : l'audio continue (sons en cache).
- Passage tunnel : comportement doc 03 §4.
- MCU2 si disponible (sinon on surveille FPS de l'overlay).

## 5. Critères d'acceptation MVP
- [ ] Latence médiane ≤ 300 ms (accélération) et ≤ 300 ms (lâcher)
- [ ] 8/10 accélérations jugées « synchro »
- [ ] 0 clic audible de boucle, 0 coupure sur 3 trajets de 20 min
- [ ] 2–3 véhicules fonctionnels
- [ ] Chargement < 10 s en 4G
