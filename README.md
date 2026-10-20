# LotoMaths V1.0

Laboratoire d'analyse mathématique des tirages du Loto français (régime 5 numéros /49 + Chance 1–10, depuis le 2008-10-06). **Il ne prédit rien** : le Loto est aléatoire.

## Principe technique
HTML/CSS/JavaScript (modules ES), **sans étape de compilation ni dépendance** : fonctionne tel quel sur GitHub Pages (chemins relatifs). Graphiques en SVG maison.

## Structure
`js/maths.js` (combinatoire BigInt, probabilités, khi-deux, Wilson, z, Bonferroni, Benjamini-Hochberg) · `js/stats.js` · `js/data.js` (import/validation) · `js/rng.js` (mulberry32, tirage sans remise) · `js/generator.js` · `js/charts.js` · `js/ui.js` · `js/app.js` (pages) · `tests/` · `data/tirages.json`.

## Commandes
`npm test` (Node ≥ 20, tests natifs) · `npm run check` · test local : `python3 -m http.server`.

## Données
`data/tirages.json` est **vide** : aucune donnée officielle n'est fournie. Format : `[{"date":"AAAA-MM-JJ","numeros":[n1..n5],"numeroChance":c}]`. Pour charger l'historique : importer un CSV/JSON officiel (page « Importation »), télécharger le JSON validé, puis le committer dans `data/tirages.json`. Vérifier les conditions de réutilisation des données de la FDJ. L'import manuel n'est conservé qu'en mémoire (session).

## Déploiement GitHub Pages
Dépôt GitHub → Settings → Pages → Source : **GitHub Actions**. Pousser sur `main` : `.github/workflows/pages.yml` lance les tests puis publie.

## Limites
Régime pré-2008 (6/49) non géré · grille des gains non intégrée (non vérifiable hors ligne) · pas de Web Worker (simulations par lots avec progression/annulation) · mode « associations historiques », matrice des paires cliquable, export PNG/PDF et mise à jour automatique des données non implémentés · p-valeurs des paires par approximation normale.
