# NGA Spoiler Guard

Extension de navigateur qui masque/bloque les contenus F1 publiés après une
séance (essais, qualifications, course) que tu n'as pas encore regardée, sur
[motorsport.nextgen-auto.com](https://motorsport.nextgen-auto.com/fr/).

## Navigateur

**À utiliser en priorité avec Google Chrome.** L'extension est écrite en
Manifest V3 et a été développée/testée sur Chrome — c'est le navigateur de
référence pour ce projet. Elle devrait fonctionner sur d'autres navigateurs à
base Chromium (Edge, Brave...) puisqu'ils partagent le même moteur
d'extensions, mais ils n'ont pas été testés : en cas de comportement différent,
privilégie Chrome pour valider.

## Installation en local (extension non empaquetée)

1. Ouvre `chrome://extensions` dans Chrome.
2. Active le **mode développeur** (interrupteur en haut à droite).
3. Clique sur **"Charger l'extension non empaquetée"**.
4. Sélectionne le dossier racine de ce projet (celui qui contient
   `manifest.json`).
5. L'extension "NGA Spoiler Guard" apparaît dans la liste et dans la barre
   d'outils.

Après toute modification du code, reviens sur `chrome://extensions` et clique
sur l'icône de rechargement de l'extension, puis recharge la page du site
(F5) pour que les changements soient pris en compte.

## Utilisation

1. Va sur `https://motorsport.nextgen-auto.com/fr/` (ou toute page du site).
2. Si aucun réglage n'a encore été choisi, un écran plein page s'affiche et
   demande, pour le week-end en cours : *"Je n'ai pas encore vu : Essais
   Libres 1 / ... / Qualifications / Course"* — choisis la première séance
   que tu n'as pas encore regardée, ou "Tout afficher" pour désactiver le
   filtre.
3. Une fois le choix fait :
   - Les news publiées **avant** le début de cette séance restent visibles
     normalement.
   - Les news publiées **à partir du début de cette séance** sont masquées
     (motif hachuré) dans les listes, et bloquées en plein écran si tu ouvres
     directement leur page.
   - Ce réglage est **global** : si tu as plusieurs GP de retard, la coupure
     s'applique en continu depuis cette date-là, sur toutes les pages, pas
     seulement autour d'un week-end précis.
4. Tu peux revoir ou changer ce réglage à tout moment via le popup de
   l'extension (clic sur son icône dans la barre d'outils) — le changement
   s'applique immédiatement, sans recharger l'onglet déjà ouvert. La popup
   propose aussi un sélecteur pour choisir **n'importe quel week-end déjà
   disputé** (pas seulement celui en cours) comme référence de coupure —
   utile si tu es en retard de plusieurs Grands Prix.

## Mettre à jour le calendrier

Le calendrier est codé en dur dans [`data/calendar.json`](data/calendar.json),
un tableau chronologique d'un objet par week-end. Avant chaque nouveau Grand
Prix, **ajoute une entrée à la fin du tableau** (ne remplace pas le contenu
existant, l'historique sert à la sélection d'un week-end antérieur) avec les
horaires officiels (tous en UTC, suffixe `Z`) :

```json
{
  "id": "2026-nom-du-gp",
  "name": "Grand Prix de ... 2026",
  "circuit": "...",
  "season": 2026,
  "sessions": [
    { "key": "fp1", "label": "Essais Libres 1", "start_utc": "..." },
    { "key": "fp2", "label": "Essais Libres 2", "start_utc": "..." },
    { "key": "fp3", "label": "Essais Libres 3", "start_utc": "..." },
    { "key": "quali", "label": "Qualifications", "start_utc": "..." },
    { "key": "race", "label": "Course", "start_utc": "..." }
  ]
}
```

Pour un week-end sprint, remplace `fp2`/`fp3` par `sprint_quali`/`sprint`
(voir les entrées Chine/Miami/Canada/Grande-Bretagne dans le fichier comme
exemple) — le code ne dépend jamais des clés, seulement de `label`/`start_utc`.

Le "week-end en cours" utilisé par défaut (écran de choix sur le site, entrée
pré-sélectionnée dans la popup) est calculé automatiquement : c'est le
dernier de la liste dont la première séance a déjà démarré. Pas besoin de
champ séparé pour l'indiquer.

## Limites connues

- **Hors contrôle** : les pages `/formule-1/classements/`, `/formule-1/resultats/`
  et `/formule-1/calendriers/` ne sont pas filtrées (ce sont des tableaux, pas
  des actus datées) — à consulter avec prudence pendant un week-end en cours.
- **Contenus sans date visible** (tuiles "à la une", widgets "Photos"/"Vidéos"
  de la page d'accueil, liens "à lire aussi" dans un article) : l'extension
  retrouve leur vraie date soit via une mémoire apprise en parcourant le site
  (par identifiant d'article), soit en allant consulter la page de listing
  correspondante (`/formule-1/photos/`, `/formule-1/videos/`). Si aucune des
  deux ne donne de réponse, le contenu est masqué par précaution plutôt que
  risqué.
- Le tableau "programme du week-end" (horaires Essais/Qualifs/Course) n'est
  jamais masqué : ce ne sont que des horaires, pas des résultats.

## Canari de structure (CI)

L'extension dépend d'une structure DOM précise du site (motif d'URL des
articles, position des dates dans les cartes de liste, balises `og:type` /
`og:article:published_time`...). Si nextgen-auto change sa mise en page, ces
sélecteurs peuvent cesser de fonctionner silencieusement. [`scripts/canary.js`](scripts/canary.js)
sert de garde-fou indépendant : il va chercher la page d'accueil (et un
article) en live, réutilise le vrai code de parsing (`src/frenchDate.js`,
`src/zonedTime.js`, `src/weekend.js`, via `jsdom`) et vérifie :

- qu'un nombre minimum de liens d'article est trouvé sur la home
  (constante `MIN_CARDS`, actuellement `5`) ;
- qu'une proportion minimum de ces cartes a une date lisible (constante
  `MIN_DATED_RATIO`, actuellement `0.5`) ;
- que les métadonnées `og:type` / `og:article:published_time` sont présentes
  et valides sur une page article.

**Ces deux seuils sont des valeurs de départ arbitraires, à ajuster** une
fois qu'on aura du recul sur le trafic réel du site (jours creux, périodes
sans actu F1...), pour limiter les faux positifs sans devenir aveugle à une
vraie régression de structure.

Exécution locale :

```
npm install
npm run canary
```

Le workflow [`.github/workflows/canary.yml`](.github/workflows/canary.yml)
l'exécute automatiquement chaque lundi (et à la demande depuis l'onglet
*Actions* de GitHub) ; en cas d'échec, une issue GitHub taguée `canary` est
créée (ou mise à jour si elle existe déjà) pour signaler qu'un changement de
structure du site est probable.

## Documentation du code

Le code (`src/`, `popup/`) est commenté au format [JSDoc](https://jsdoc.app/)
(un court bloc au-dessus de chaque fichier et de chaque fonction exportée).
Pour générer une documentation HTML consultable dans un navigateur :

```
npm install
npm run docs
```

Ouvre ensuite `docs/index.html`. Le dossier `docs/` est régénéré à chaque
exécution (ignoré par Git, voir `.gitignore`).

## Debug

La console du site (F12 → Console) affiche des logs préfixés `[NGA]` qui
détaillent les décisions prises (cartes trouvées, dates résolues, éléments
masqués...), utile pour diagnostiquer un comportement inattendu.
