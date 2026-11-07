# 06 — UX / UI

## 1. Contraintes
- Écran tactile paysage (Model 3/Y : 15″, ~1920×1200 ; S/X : variable), navigateur souvent en
  demi-écran à côté de la carte → l'interface doit fonctionner **de 900 px à 1920 px** de large.
- Utilisé par le **conducteur** : tout ce qui sert en roulant doit être atteignable en 1 tap,
  cibles ≥ 80 px, aucune lecture nécessaire. Les réglages fins se font **à l'arrêt**.
- Thème sombre par défaut (conduite de nuit), contraste élevé.

## 2. Écrans

### E1 — Garage (accueil)
```
┌──────────────────────────────────────────────┐
│  EngineSync                        ⚙️  🛠️     │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  V8      │ │  V12     │ │  I4 T    │      │
│  │ Muscle   │ │ Supercar │ │ Turbo    │      │
│  └──────────┘ └──────────┘ └──────────┘      │
│                                              │
│        [ Chargement des sons… 78 % ]         │
└──────────────────────────────────────────────┘
```
- Tap sur une carte → préchargement du véhicule (barre de progression) → E2.

### E2 — Cockpit
```
┌──────────────────────────────────────────────┐
│ ← Garage          V8 Muscle         GPS ●    │
│                                              │
│        ╭─────────╮        3e                 │
│        │  4 200  │      tr/min               │
│        ╰─────────╯       72 km/h             │
│                                              │
│   [  ▶ DÉMARRER  ]   (devient ■ COUPER)      │
│                                              │
│   Volume  ━━━━━━━●━━━     Anticipation 400ms │
│                           ━━━━●━━━━━━        │
│   [Démo]                          [Debug]    │
└──────────────────────────────────────────────┘
```
- Compte-tours animé (60 fps, CSS transform, léger).
- Indicateur GPS : vert (OK, fréquence ≥ 1 Hz), orange (dégradé), rouge (perdu).
- Mode **Démo** : remplace la source GPS par un grand curseur de pédale + bouton frein.

### E3 — Réglages (à l'arrêt)
- Volume, anticipation (ms), réactivité (doux / normal / nerveux), seuil de charge,
  intensité pétarades (0–100 %), grave (low-shelf), unités (km/h).
- Bouton « Réinitialiser ».

### E4 — Overlay debug (activable)
Texte monospace en surimpression : `v_brute`, `v_prédite`, `a`, `load`, `rpm`, `gear`,
Hz GPS (moyenne glissante), âge du dernier point (ms), `accuracy`, `outputLatency`,
nombre de sources audio actives, FPS.

## 3. Flux
1. Ouvrir l'URL (favori dans le navigateur Tesla).
2. Choisir véhicule → chargement.
3. **DÉMARRER** (geste requis pour l'audio + demande d'autorisation géoloc la 1re fois).
4. Conduire. Ajuster volume si besoin.
5. COUPER ou fermer.

## 4. Accessibilité / sécurité
- Aucune animation clignotante, aucune alerte sonore intrusive.
- Pas de pop-up pendant que `v > 5 km/h`.
- Le volume moteur ne dépasse jamais le volume système (le volume voiture reste le maître).
