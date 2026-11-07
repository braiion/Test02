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
| 11 | [Guide d'enregistrement](docs/11-guide-enregistrement.md) | **Comment enregistrer tes voitures** : matériel, micros, séance, livraison |

## État
- [x] Phase C — Conception (ce dossier)
- [x] Phase 0 — Page de diagnostic (`diag/`) — **à lancer dans la voiture**
- [ ] Phase 1 — MVP : moteur audio + modèle + GPS + mode Démo **faits** (sons de synthèse provisoires) ; reste : vrais enregistrements, outil de découpage, tests sur route
- [ ] Phase 2 — Améliorations / télémétrie Tesla (optionnel)

## Lancer l'application

### Sur ordinateur (pour tester)
```bash
npm install
npm run dev        # puis ouvrir l'adresse affichée
npm test           # tests de la logique
```
Mode **Démo** : flèche ↑ = accélérer (Maj+↑ = mi-gaz), espace = freiner.

### Dans la Tesla — option A : GitHub Pages (dépôt public)
1. Dépôt GitHub → *Settings* → *General* → tout en bas *Danger Zone* → *Change visibility* → **Public**.
2. *Settings* → *Pages* → *Build and deployment* → *Source* : **GitHub Actions**.
3. Onglet *Actions* : le workflow « Déploiement GitHub Pages » se lance à chaque envoi (relance-le à la main via *Run workflow* la première fois).
4. Adresse du site : **https://braiion.github.io/Test02/** — diagnostic : **https://braiion.github.io/Test02/diag/**

Le dépôt ne contient **aucun secret** (pas de `.env`, pas de clé, pas de variable d'environnement) ; `.gitignore`
bloque `.env`, clés, et les dossiers de sons bruts (`sounds-src/`, `enregistrements/`).

### Dans la Tesla — option B : Netlify (dépôt privé)
Le site doit être en ligne en **HTTPS**. Le dépôt étant privé, on utilise **Netlify** (gratuit) :
1. Sur netlify.com → *Sign up* avec ton compte GitHub.
2. *Add new site* → *Import an existing project* → *GitHub* → autoriser l'accès au dépôt `braiion/Test02`.
3. Branche à publier : `claude/jolly-allen-9xs1kb`. Les réglages de build sont lus automatiquement depuis `netlify.toml`
   (commande `npm run build`, dossier `dist`). → *Deploy*.
4. Netlify donne une adresse `https://xxxx.netlify.app` (renommable dans *Site configuration → Change site name*).
5. Dans la Tesla : navigateur → cette adresse → **ajouter aux favoris**.
6. Chaque nouvel envoi sur la branche met le site à jour automatiquement (≈ 1 min).

La page de diagnostic est à `https://xxxx.netlify.app/diag/`.

### Utilisation en voiture
1. Choisir un véhicule (le tap autorise l'audio).
2. Choisir **GPS (route)** → **DÉMARRER** → autoriser la localisation la première fois.
3. Régler le volume (le volume de la voiture reste le maître) et l'**anticipation** si le son paraît en retard
   (augmenter) ou en avance (diminuer).
