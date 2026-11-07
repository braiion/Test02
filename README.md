# EngineSync — sons moteur synchronisés pour Tesla (projet perso)

> Nom de code provisoire. Ce dépôt est **temporaire** : il sert uniquement d'hébergement
> pendant la phase de conception et n'a aucun lien avec un projet existant.

## L'idée en une phrase
Un site web perso, ouvert dans le navigateur de la Tesla, qui joue un son de moteur thermique
(V8, V10, 4-cylindres turbo…) **réactif à la conduite réelle**, avec une latence perçue la plus faible
possible, **gratuit** et sans abonnement.

## Pourquoi
Les sites existants :
- sont **payants / abonnements chers** ;
- ont une **synchronisation décalée** (le son suit la vitesse avec 1 à 3 s de retard) ;
- n'offrent aucun réglage fin du décalage.

## Documentation (à lire dans l'ordre)
| # | Document | Contenu |
|---|----------|---------|
| 01 | [PRD](docs/01-PRD.md) | Vision, objectifs, périmètre MVP, exigences, métriques |
| 02 | [Architecture technique](docs/02-architecture.md) | Stack, modules, hébergement, contraintes navigateur Tesla |
| 03 | [Synchronisation & latence](docs/03-synchronisation-latence.md) | **Le cœur du projet** : d'où vient le décalage et comment on l'élimine |
| 04 | [Moteur audio](docs/04-moteur-audio.md) | Modèle moteur virtuel, boîte de vitesses, crossfade des samples |
| 05 | [Spécification des sons](docs/05-specification-sons.md) | **Ce que tu dois me fournir** : formats, nommage, liste par véhicule |
| 06 | [UX / UI](docs/06-ux-ui.md) | Écrans, interactions, contraintes écran voiture |
| 07 | [Roadmap & plan MVP](docs/07-roadmap-mvp.md) | Phases, tâches, critères de sortie |
| 08 | [Tests & validation](docs/08-tests-validation.md) | Protocole de test sur route, mesures de latence |
| 09 | [Risques, sécurité & légal](docs/09-risques-legal.md) | Sécurité routière, limites Tesla, droits sur les sons |
| 10 | [Décisions (ADR)](docs/10-decisions.md) | Journal des choix techniques |

## État
- [x] Phase C — Conception (ce dossier)
- [ ] Phase 0 — Page de diagnostic à lancer dans la voiture (mesures réelles)
- [ ] Phase 1 — MVP (2–3 véhicules)
- [ ] Phase 2 — Améliorations / télémétrie Tesla (optionnel)
