# 01 — PRD (Product Requirements Document)

| Champ | Valeur |
|---|---|
| Produit | EngineSync (nom provisoire) |
| Propriétaire | Moi (usage strictement personnel) |
| Statut | Brouillon v1 — en attente de validation |
| Date | 2026-11-07 |

## 1. Contexte & problème
Une Tesla est silencieuse. Des sites web permettent de jouer un son de moteur thermique
via le navigateur de la voiture, mais :

1. **Prix** : abonnement mensuel ou achat par véhicule, jugé trop cher pour l'usage.
2. **Décalage** : le son réagit avec retard (typiquement 1–3 s). On accélère, le son
   monte « après coup » → l'illusion est cassée, c'est même désagréable.
3. **Pas de réglage** : impossible de compenser soi-même le décalage ou d'ajuster la réactivité.

## 2. Vision
> « Quand j'appuie, ça rugit **maintenant**. Quand je lève le pied, ça décélère **maintenant**. »

Un site perso, gratuit, hébergé gratuitement, qui fait **mieux que les payants sur la
synchronisation** grâce à : (a) une source de données mesurée et optimisée, (b) de la
**prédiction** pour compenser le retard des capteurs, (c) un modèle moteur avec inertie qui
masque les à-coups, (d) un **réglage d'anticipation** calibrable dans la voiture.

## 3. Utilisateur cible
Un seul : moi, conducteur de Tesla, qui lance le site avant de partir et n'y touche plus
(ou presque) pendant la conduite.

## 4. Objectifs & non-objectifs

### Objectifs (MVP)
- O1 — Jouer un son moteur réaliste et continu, sans coupure ni « clic » de boucle.
- O2 — Latence perçue **≤ 300 ms** entre une variation d'accélération réelle et la réaction du son
  (objectif stretch : ≤ 150 ms). Les sites existants sont à 1000–3000 ms.
- O3 — 2 à 3 véhicules sélectionnables.
- O4 — Fonctionne sur le navigateur Tesla, voiture en mouvement, en 1 tap après chargement.
- O5 — Coût de fonctionnement **0 €**.

### Non-objectifs (MVP)
- Pas de comptes utilisateurs, pas de paiement, pas de multi-utilisateurs.
- Pas de son extérieur (haut-parleur piéton / Boombox) — non accessible depuis le navigateur.
- Pas d'intégration API Tesla dans le MVP (envisagée en Phase 2, voir doc 03).
- Pas d'app native.

## 5. Périmètre fonctionnel MVP

| ID | Exigence | Priorité |
|----|----------|----------|
| F1 | Écran d'accueil : choix du véhicule (2–3 cartes) | Must |
| F2 | Bouton « Démarrer le moteur » (geste utilisateur obligatoire pour activer l'audio) + son de démarrage | Must |
| F3 | Ralenti (idle) à l'arrêt | Must |
| F4 | Son piloté en temps réel par la vitesse et l'accélération (GPS du véhicule) | Must |
| F5 | Boîte de vitesses virtuelle (montée/descente de rapports automatique, régime simulé) | Must |
| F6 | Son « en charge » (accélération) vs « hors charge » (lâcher de pédale / décélération) | Must |
| F7 | Réglage du volume moteur | Must |
| F8 | Réglage **anticipation / compensation de latence** (curseur en ms) | Must |
| F9 | Bouton « Couper le moteur » + son d'arrêt | Should |
| F10 | Pétarades / crépitements au lâcher de pédale (si sons fournis) | Should |
| F11 | Mode **Démo / Simulation** (curseur de pédale virtuel) pour tester à l'arrêt ou sur PC | Must |
| F12 | Overlay de debug (vitesse brute, vitesse filtrée, régime, rapport, fréquence GPS, latence audio) | Must |
| F13 | Réglage de la réactivité (doux ↔ nerveux) | Should |
| F14 | Mémorisation des réglages (localStorage) | Should |
| F15 | Préchargement complet des sons avant démarrage, fonctionnement sans réseau ensuite | Should |
| F16 | Limiteur de régime (rupteur) au rupteur max | Could |
| F17 | **Accéléromètre** : accélération / décélération / « pédale » ressenties en temps réel (< 100 ms), fusionnées avec le GPS | **Must** |
| F18 | **Téléphone capteur** : l'accéléromètre du téléphone envoyé en direct (WebRTC) à la page Tesla, appairage par QR code | **Must** |
| F19 | Accéléromètre de l'appareil lui-même utilisé automatiquement s'il est exposé (écran Tesla ou téléphone) | Must |
| F20 | Calibration de l'orientation : automatique (apprentissage via GPS) + bouton « Calibrer » | Must |
| F21 | **Pédale relative** : la charge = accélération mesurée / accélération max que la Tesla peut fournir à cette vitesse (pied au plancher reste « pleine charge » à haute vitesse) | **Must** |
| F22 | **Calage des performances** : chaque véhicule a ses données réelles (0–100, Vmax, motricité) ; pied au plancher, le régime et les rapports suivent la progression de la vraie voiture, pas celle de la Tesla | **Must** |
| F23 | **Modes Confort / Normal / Sport** : lois de passage, rétrogradages au freinage, coup de gaz au rétrogradage, sensibilité pédale, vivacité du compte-tours, pétarades | **Must** |
| F24 | Données de la Tesla hôte modifiables (0–100, Vmax) | Should |

## 6. Exigences non fonctionnelles
| ID | Exigence |
|----|----------|
| NF1 | Latence perçue ≤ 300 ms (cf. O2), mesurée selon le protocole doc 08 |
| NF2 | Aucune coupure audio sur 30 min de conduite |
| NF3 | Chargement initial < 10 s en 4G (poids total des sons d'un véhicule ≤ 10 Mo) |
| NF4 | Interface utilisable sans regarder (gros boutons ≥ 80 px, contrastés) |
| NF5 | Site statique HTTPS (obligatoire pour la géolocalisation) |
| NF6 | Cible : navigateur Tesla (Chromium) **MCU3** du Model Y Juniper. MCU2 non visé (pas de véhicule de test) |
| NF7 | Usage CPU raisonnable : pas de traitement audio lourd côté JS, tout dans le graphe Web Audio |

## 7. Métriques de succès
- Latence mesurée (doc 08) : médiane ≤ 300 ms.
- « Test du ressenti » : sur 10 accélérations franches, je juge le son synchro ≥ 8 fois.
- 0 crash / coupure sur 3 trajets de 20 min.
- 0 € dépensé.

## 8. Hypothèses à valider (Phase 0)
| ID | Hypothèse | Comment on valide |
|----|-----------|-------------------|
| H1 | Le navigateur Tesla expose `navigator.geolocation` avec la position de la voiture | Page diagnostic |
| H2 | `coords.speed` est renseigné (vitesse Doppler GPS, pas `null`) | Page diagnostic |
| H3 | Fréquence de mise à jour GPS ≥ 1 Hz | Page diagnostic (histogramme des intervalles) |
| H4 | `DeviceMotionEvent` (accéléromètre) est-il disponible ? (probablement non) | Page diagnostic |
| H5 | L'audio Web Audio continue de jouer voiture en mouvement | Test sur route |
| H6 | Latence de sortie audio (`outputLatency`) raisonnable (< 100 ms) | Page diagnostic |
| H7 | Le navigateur reste utilisable en roulant sur ma version de firmware | Test sur route |

Si H2/H3 échouent → plan B décrit dans le doc 03 (dérivation de la vitesse depuis les positions,
ou télémétrie Tesla).

## 9. Questions ouvertes (à me répondre)
1. ~~Modèle exact, année, ordinateur de bord~~ → **Répondu** : Tesla **Model Y 2026 « Juniper » Grande Autonomie**,
   ~350 ch, 0–100 km/h ≈ 5 s → ordinateur **MCU3 (AMD Ryzen)**, écran central 15,4″ + écran arrière.
   Reste à relever : **version du firmware** (Contrôles → Logiciel).
2. ~~Véhicules MVP~~ → **Répondu** : **V8 américain**, **V10 type Carrera GT**, **V12 type Aventador SVJ** (profils dans `public/vehicles/`).
3. ~~Origine des sons~~ → **Répondu** : **mes propres enregistrements** → guide dédié : [doc 11](11-guide-enregistrement.md).
4. Hébergement → **reporté** (Netlify Drop pour la page diag en attendant).
