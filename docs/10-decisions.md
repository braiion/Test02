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
