# 03 — Synchronisation & latence (le cœur du projet)

## 1. Pourquoi les sites existants sont décalés
Le navigateur Tesla ne donne **pas** accès à la pédale ni au CAN. Les solutions existantes
utilisent l'une de ces sources, toutes lentes :

| Source | Fréquence typique | Retard typique | Problème |
|---|---|---|---|
| Position GPS, vitesse **calculée** par différence de positions | ~1 Hz | 1–2 s | Différencier deux positions = retard d'½ à 1 intervalle + bruit → lissage fort → encore plus de retard |
| API Tesla (Fleet API, polling cloud) | 0,1–1 Hz | 2–10 s | Aller-retour voiture → cloud Tesla → serveur → navigateur |
| GPS + lissage naïf (moyenne mobile) | ~1 Hz | 1,5–3 s | Une moyenne mobile sur N points ajoute N/2 intervalles de retard |

**Budget de latence d'une approche naïve :**
```
intervalle GPS (≈1000 ms, retard moyen ≈500 ms)
+ traitement/filtrage GPS interne voiture (≈100–300 ms, inconnu → mesuré en Phase 0)
+ lissage moyenne mobile (≈500–1500 ms)
+ rampe audio linéaire (≈200–500 ms)
+ latence sortie audio (≈20–100 ms)
= 1,3 à 2,9 s  ← ce que tu ressens sur les sites payants
```

## 2. Notre stratégie (5 leviers)

### L1 — Utiliser la vitesse Doppler, pas la différence de positions
`coords.speed` (quand il est fourni) est mesuré directement par la puce GNSS via l'effet Doppler :
il est **instantané et précis (~0,1 m/s)**, sans retard de différenciation. Vérifié en Phase 0 (H2).
Repli si `null` : vitesse = distance haversine / Δt entre deux points, avec un filtre plus lent.

### L2 — Estimer l'accélération et **prédire**
Un filtre **α-β (ou Kalman 1D à 2 états : vitesse, accélération)** estime en continu `v` et `a`.
Entre deux points GPS, on **extrapole** à 60 Hz :

```
v_pred(t) = v_k + a_k · (t − t_k + lookahead)
```
- `t_k` = horodatage du dernier point GPS (`position.timestamp`)
- `lookahead` = compensation des retards connus (traitement GPS voiture + sortie audio + rampe audio),
  **réglable par l'utilisateur** (curseur F8, défaut ≈ 400 ms, calibré en Phase 0).
- Le terme `a_k` est borné (|a| ≤ 10 m/s²) et décroît vers 0 si aucun nouveau point n'arrive
  (évite un emballement si le GPS se tait, ex. tunnel).

Résultat : quand tu accélères, la vitesse prédite monte **dès le premier point GPS** qui montre
une hausse, et continue de monter entre les points au lieu d'attendre.

### L3 — Détecter la **charge** sur l'accélération, pas sur la vitesse
Le cerveau perçoit d'abord le **changement de caractère** du son (rugissement vs décélération)
avant la hauteur. On bascule entre samples « en charge » / « hors charge » dès que l'accélération
estimée franchit un seuil (hystérésis) :
- `a > +0,4 m/s²` → charge (onLoad), gain proportionnel à `a` (pseudo-pédale)
- `a < −0,3 m/s²` → hors charge (offLoad) + pétarades éventuelles
- entre les deux → croisière (mix léger onLoad)

Le crossfade charge/hors charge est **rapide (≈80 ms)** : c'est ce qui donne l'impression de
réactivité immédiate.

### L4 — Modèle moteur à inertie (masquage perceptif)
Un vrai moteur ne change pas de régime instantanément. On simule une inertie
(`rpm` suit `rpm_cible` avec une constante de temps ≈ 120 ms en montée, ≈ 250 ms en descente).
Les petits sauts de l'estimation deviennent des variations **naturelles**, au lieu de « marches ».
Les changements de rapport (chute de régime brutale) sont des **événements voulus** et masquent
aussi les corrections d'estimation.

### L5 — Rampe audio native et courte
- `AudioParam.setTargetAtTime(value, now, τ)` avec `τ ≈ 30–50 ms` (exécuté dans le thread audio).
- `AudioContext({ latencyHint: "interactive" })` pour minimiser le buffer de sortie.
- Mesure de `audioContext.outputLatency` / `baseLatency` intégrée au `lookahead` automatiquement.

## 3. Budget cible
```
retard capteur effectif (après prédiction)   ≈ 0–150 ms  (résidu d'erreur de prédiction)
détection de charge (seuil sur a)            ≈ 1 point GPS au pire → atténué par L2
rampe audio                                  ≈ 30–50 ms
sortie audio                                 ≈ 20–60 ms
-------------------------------------------------------------
latence perçue cible                         ≤ 300 ms (stretch ≤ 150 ms)
```
⚠️ Limite physique honnête : avec 1 point GPS/seconde, le **tout début** d'un coup d'accélérateur
ne peut être détecté qu'au point GPS suivant (0 à 1000 ms, moyenne 500 ms). La prédiction
supprime le retard *une fois la tendance détectée*, pas avant. Si la Phase 0 montre une
fréquence > 1 Hz (certaines voitures fournissent 5–10 Hz), on gagne directement.
C'est pour ça que la Phase 0 est déterminante et que la Phase 2 (pédale réelle) existe.

## 4. Gestion des cas limites
| Cas | Comportement |
|---|---|
| Arrêt (v < 0,5 m/s pendant 1 s) | Ralenti, rapport 1, pas de prédiction |
| Perte GPS (tunnel, parking) > 2 s | `a → 0` progressivement, vitesse figée puis décroissance douce ; overlay « GPS perdu » |
| Point aberrant (saut > 15 km/h en 1 s non physique, `accuracy` > 50 m) | Rejeté |
| Point GPS en retard / dupliqué (timestamp identique) | Ignoré |
| Marche arrière | Vitesse GPS positive quand même → ralenti/rapport 1 bas régime (acceptable MVP) |
| Régénération forte (one-pedal) | `a < 0` → hors charge + pétarades : c'est justement l'effet recherché |

## 5. Calibration (dans la voiture)
1. Mode « Calibration » : je fais 5 accélérations franches depuis ~30 km/h.
2. L'overlay affiche en direct la vitesse brute vs prédite.
3. J'ajuste le curseur `lookahead` jusqu'à ce que le son « colle ». Valeur sauvegardée.
4. Option avancée : réglage de la réactivité (constantes α/β, seuils de charge).

## 6. Phase 2 — Sources plus rapides (hors MVP)
| Option | Gain | Coût / complexité |
|---|---|---|
| **Tesla Fleet Telemetry** (streaming voiture → mon serveur → WebSocket → navigateur) | Vraie **position de pédale**, vitesse, rapport (P/R/N/D) | Compte développeur Tesla, clé virtuelle, domaine, petit serveur ; tarification Fleet API à vérifier (crédit mensuel gratuit possible) ; latence réseau 0,3–1 s → la pédale réelle compense quand même mieux le *début* d'accélération |
| Dongle CAN (port diagnostic) + téléphone en relais Wi-Fi local | Pédale à 50–100 Hz, latence < 50 ms | Matériel, câblage, bricolage ; le navigateur ne peut pas parler Bluetooth → relais WebSocket via le téléphone |
| `DeviceMotionEvent` (accéléromètre) | Détection immédiate de l'accélération | Très probablement non exposé par le navigateur Tesla (testé H4) |

Décision : **MVP = GPS + prédiction** ; on ne rajoute une option Phase 2 que si les mesures
Phase 0/1 le justifient (voir ADR-003).

## 7. Accéléromètre & « pédale » (ajout v0.2)

### 7.1 Pourquoi la pédale des autres applis a ≥ 1 s de retard
Le navigateur Tesla **n'a aucun accès** à la pédale ni au bus CAN. Les applis qui affichent la pédale
la récupèrent via le **cloud Tesla** (Fleet API / Fleet Telemetry, champ `PedalPosition`) :
```
voiture ──4G──► serveurs Tesla ──► serveur de l'appli ──► navigateur de la voiture
 (envoi périodique, ≥ 0,5–1 s)        (traitement)        (WebSocket / polling)
= 0,8 à 2 s de retard, structurel
```
Ce n'est donc pas la « stack » du site ni le navigateur : c'est le **chemin des données**. Aucune
optimisation de code ne peut descendre sous ce délai par ce chemin.

### 7.2 Notre réponse : mesurer l'effet de la pédale, pas la pédale
Sur une Tesla, le couple arrive < 100 ms après l'appui → **l'accélération longitudinale est une image
quasi instantanée de la pédale** (et du freinage / de la régénération). Un accéléromètre la mesure à
60–100 Hz avec quelques ms de retard.

| Source accéléro | Disponibilité | Latence | Statut |
|---|---|---|---|
| Écran Tesla (`DeviceMotionEvent`) | Peu probable (testé par `diag/`) | ~20 ms | Utilisée **automatiquement** si présente |
| **Téléphone fixé dans la voiture → Tesla** (WebRTC pair à pair) | Toujours | ~20–60 ms via partage de connexion, ~80–200 ms via 4G des deux côtés | **Implémentée** (page `capteur.html`, QR code) |
| Téléphone seul (site ouvert sur le téléphone, son en Bluetooth vers la voiture) | Toujours | capteur ~20 ms + Bluetooth ~150–250 ms | Possible tel quel (même site), à tester |

### 7.3 Chaîne de traitement
1. **Orientation inconnue** du téléphone : gravité estimée (passe-bas 1,5 s) → plan horizontal → projection.
2. **Axe avant** : appris automatiquement en corrélant l'accélération horizontale avec l'accélération GPS
   (quelques accélérations/décélérations suffisent), ou instantanément avec **Calibrer** pendant une accélération franche.
3. **Lissage 40 ms** (filtre les vibrations, garde la réactivité).
4. **Fusion** (filtre complémentaire, `src/estimation/fusion.ts`) : on intègre l'accélération à 60 Hz ;
   chaque point GPS recale la vitesse (en tenant compte de son retard ~250 ms) et estime le **biais**
   de l'accéléromètre (téléphone incliné, pente) ; à l'arrêt, le biais est remis à zéro.
5. La **charge moteur** (en charge / hors charge / pétarades) vient directement de l'accélération mesurée
   → réaction au coup de pédale en < 100 ms ; le **régime** vient de la vitesse fusionnée.
6. Si l'accéléromètre se tait > 0,5 s → retour automatique au mode GPS seul (avec anticipation).

### 7.4 Mesures (simulation, tests automatisés)
Scénario : coup d'accélérateur 4 m/s² à 30 km/h, GPS 1 Hz retardé de 300 ms.
- **GPS seul** : détection de la charge **1000 ms** après l'appui.
- **GPS + accéléromètre** : détection **dès la première mesure** (latence réelle attendue = latence capteur + liaison, soit ~20–60 ms en partage de connexion).
- Vitesse fusionnée juste à < 3,6 km/h près malgré un biais de 0,4 m/s².

### 7.5 Limites honnêtes
- Ce n'est pas la position exacte de la pédale : pédale enfoncée à vitesse maxi limitée ou en côte raide = accélération faible → son moins « chargé ». En pratique, c'est ce que l'oreille attend.
- Le téléphone doit être **fixe** (support) ; un téléphone qui glisse = faux coups d'accélérateur.
- WebRTC dans le navigateur Tesla est à vérifier (`diag/` le teste). Le serveur public PeerJS sert uniquement à la mise en relation (aucune donnée sensible, aucun compte).
