# 10 — Journal des décisions (ADR)

## ADR-001 — 100 % client, site statique
**Décision** : aucun serveur dans le MVP. **Pourquoi** : 0 €, pas de latence réseau dans la boucle
temps réel, maintenance nulle. **Conséquence** : seule source de données = API navigateur (GPS).

## ADR-002 — Web Audio + boucles multi-régimes (pas de synthèse procédurale)
**Décision** : crossfade de samples réels à régime constant. **Pourquoi** : réalisme bien supérieur
à une synthèse procédurale pour un coût CPU faible (MCU2). **Alternative écartée** : synthèse
additive/granulaire en AudioWorklet — trop coûteuse et moins réaliste.

## ADR-003 — GPS + prédiction pour le MVP, télémétrie Tesla en option
**Décision** : MVP basé sur `coords.speed` + filtre α-β/Kalman + extrapolation + `lookahead`
réglable. **Pourquoi** : gratuit, sans compte développeur, sans serveur. **Réévaluation** : si la
latence médiane mesurée > 400 ms après calibration, on étudie Fleet Telemetry (pédale réelle).

## ADR-004 — Opus pour les sons livrés, WAV en source
**Décision** : sources WAV 48 kHz/24 bits, livraison Opus. **Pourquoi** : pas de padding MP3
(clics de boucle), ~10× plus léger, supporté par Chromium. **Repli** : FLAC si souci de décodage.

## ADR-005 — TypeScript + Vite, sans framework lourd
**Décision** : vanilla TS (+ Preact éventuel). **Pourquoi** : légèreté sur le navigateur embarqué.

## ADR-006 — Phase 0 de diagnostic avant tout développement capteurs
**Décision** : mesurer le comportement réel du navigateur Tesla avant de coder l'estimation.
**Pourquoi** : toute la qualité de synchro dépend de chiffres inconnus (fréquence GPS, retard interne).

## ADR-008 — Accéléromètre (téléphone) comme « capteur de pédale »
**Décision** : la réactivité vient d'un accéléromètre à 60 Hz (Tesla si exposé, sinon téléphone relié en
WebRTC pair à pair), fusionné avec le GPS. **Pourquoi** : la pédale réelle n'est accessible que via le cloud
Tesla (≥ 1 s, c'est le défaut des applis existantes) ; l'accélération mesurée est une image quasi instantanée
de la pédale sur une voiture électrique. **Alternatives écartées** : Fleet API/Telemetry (latence, coût, serveur),
dongle CAN (matériel, bricolage) — gardées en option lointaine.

## ADR-007 — Sources = prises brutes enregistrées en montée de régime + OBD
**Décision** : je fabrique les boucles à partir de montées/descentes en régime (B1/B2 du doc 11) synchronisées avec un log OBD du régime. **Pourquoi** : enregistrer des paliers stables en charge exige un banc de puissance ; une montée lente sur rapport haut est faisable sur piste. **Conséquence** : l'outil `tools/build-sounds` doit inclure le découpage par régime (OBD ou suivi de la fréquence d'allumage).
