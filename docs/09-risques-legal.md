# 09 — Risques, sécurité & légal

## 1. Sécurité routière
- Toute configuration se fait **à l'arrêt** ; en roulant, seuls Démarrer/Couper et le volume.
- Le volume reste raisonnable : ne doit pas couvrir sirènes, klaxons, alertes de la voiture
  (les alertes Tesla passent par-dessus le média, mais on plafonne le gain master par défaut).
- Aucun son extérieur : on ne touche pas au système d'avertissement piéton (AVAS, obligatoire).

## 2. Légal
- Usage **personnel et privé** : pas de diffusion publique du site (URL non référencée, `robots.txt` Disallow, éventuellement mot de passe simple).
- **Droits sur les sons** : les enregistrements de moteurs sont des œuvres protégées par le droit
  du producteur (même si le bruit d'un moteur ne l'est pas, *l'enregistrement* l'est).
  Préférer : sons enregistrés par toi, banques de sons sous licence (achat unique, licence
  autorisant l'usage perso), ou sons libres (CC0 / CC-BY).
  Les sons sources ne sont **pas** commités publiquement (dépôt public = redistribution) →
  dossier `sounds-src/` ignoré par git ; si le dépôt final est public, les sons encodés aussi
  seront à héberger dans un dépôt/stockage privé.
- Noms/logos de marques automobiles : usage descriptif seulement (« V8 type muscle car »), pas de logos.

## 3. Risques techniques
| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Fréquence GPS < 1 Hz ou `speed` null dans le navigateur Tesla | Moyenne | Fort | Phase 0 d'abord ; repli dérivation positions ; Phase 2 télémétrie |
| Position GPS du navigateur lissée/retardée par la voiture | Moyenne | Fort | Mesure du retard en Phase 0 ; compensation par `lookahead` |
| Navigateur bloqué en roulant sur certains firmwares | Faible | Bloquant | Vérifier H7 dès la Phase 0 |
| Audio suspendu en arrière-plan (autre app plein écran) | Moyenne | Moyen | Tester ; garder le navigateur en demi-écran ; reprise auto `resume()` |
| CPU MCU2 insuffisant | Moyenne | Moyen | Fenêtre de sources actives réduite, UI minimale |
| Sons de qualité insuffisante (pas de boucles stables) | Moyenne | Fort | Spec doc 05 ; plan B « sweep » |
| Mise à jour Tesla qui change le navigateur | Faible | Moyen | Page diag réutilisable pour revalider |
| Coût caché (API Tesla) | — | — | Hors MVP ; à chiffrer avant Phase 2 |
