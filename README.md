# <img src="favicon.svg" width="32" alt=""> Krazy Sea

**Roguelike solo** jouable dans le navigateur : composez des **couronnes de créatures** autour de vos coraux,
déclenchez des combos à chaque marée, choisissez votre route à travers trois zones et affrontez les gardiens
des profondeurs.

100 % statique (HTML / CSS / JavaScript modules, aucune dépendance, aucune compilation) : parfait pour GitHub Pages.

## Jouer

- En local : `python3 -m http.server` à la racine puis ouvrir <http://localhost:8000>
  (les modules ES ne se chargent pas en `file://`).
- En ligne : voir « Déploiement » ci-dessous.

Un **tutoriel** interactif est proposé sur l'écran titre. Il se limite au cœur du jeu, sur la première marée d'une expédition au départ fixé :
l'objectif, la main, poser une créature, Éclat × Mult, les voisins et lancer la marée (7 étapes). Le joueur peut ensuite finir cette expédition,
qui compte comme une vraie et garde sa propre sauvegarde.

Le reste du jeu arrive par les **Découvertes** 💡 : chaque règle avancée (couronnes, ponts, Remous, carte, gardien, écosystèmes, comptoir,
épaves, nurserie, artefacts, mutations…) est présentée la première fois qu'elle apparaît à l'écran, toujours dans le même ordre et au plus une
par marée ou par écran. Elles se désactivent depuis la bulle ou l'écran titre ; relancer le tutoriel les reprend depuis le début.
Un joueur qui avait déjà des expéditions avant leur arrivée les trouve désactivées.
Sur ordinateur, tout le jeu tient dans la fenêtre, sans défilement.

Le bouton **Effacer mes données** de l'écran titre supprime, après confirmation, la sauvegarde et la progression stockées dans ce navigateur.

## Lire une carte

- **Type** : le bandeau, la forme et le fond distinguent les 🐾 créatures (carte ivoire), les 🪸 coraux (carte saumon en arche),
  les 🏺 artefacts (plaque dorée) et les 🧬 mutations (cartouche violet en pointillés).
- **Survol** : les popups définissent les mots-clés cités (Sédentaire, Éphémère, Voisin…) et montrent les cartes liées :
  forme éclose d'un Œuf de requin, Anémone du Poisson-clown, artefact d'un plongeur, carte gagnée dans une épave.

## Le cœur du jeu : la couronne

Chaque **corail** est le centre d'une couronne de 4 emplacements : Surface ⬆, Fond ⬇ et deux Flancs ⬅ ➡.
À chaque **marée**, vous piochez des créatures dans votre **banc** et vous les placez autour de vos coraux.
Quand vous lancez la marée, chaque corail marque :

> **Éclat** (somme des créatures posées) × **Mult** (celui du corail, plus les bonus)

Toute la profondeur tactique vient des **associations** :

- **Voisins** : chaque emplacement touche ses deux voisins, et la case d'en face est son **opposée**
  (la Crevette nettoyeuse donne +3 à ses voisins, la Physalie leur retire de l'Éclat, le Calmar copie la créature opposée…).
- **Ponts** 🔗 : le Flanc ➡ d'un corail touche le Flanc ⬅ du corail suivant. Le lien s'illumine quand les deux créatures sont posées.
- **Position** : certaines créatures brillent en Surface ou au Fond (Raie manta, Homard, Étoile de mer).
- **Couronnes** : 💠 complète (+1 Mult) · 🎯 **Harmonie**, une seule famille (Mult ×2) · 🌈 **Mosaïque**, que des familles différentes (Mult ×1,5).
- **Coraux** : chacun a son propre penchant (l'Anémone renforce les Poissons, la Gorgone aime être bien remplie,
  le Corail noir n'a que 3 emplacements mais un Mult de 5…).

Une plongée = atteindre un **objectif** en 4 marées, avec quelques **Remous** 🌀 (défausser pour repiocher).
Les créatures non posées restent en main, et les **Sédentaires** restent sur le récif d'une marée à l'autre.
Tout se joue au clic ou en **glisser-déposer** (souris et tactile) : poser une créature, la déplacer ou l'échanger sur le récif,
la reprendre en main ou choisir l'ordre de sa main.

Chaque bonus actif s'affiche près de son corail avec sa valeur (`💠 Couronne complète +1M`, `🎯 Harmonie ×2M`…) ;
une pastille pâle signale qu'il ne manque plus qu'une créature pour compléter la couronne.

## Construire son banc

Aucune expédition ne commence pareil : **2 coraux** et **9 créatures communes** sont tirés au hasard, puis vous faites
**3 choix de 1 créature parmi 3** pour donner une direction à votre récif. Chaque offre indique ce qu'elle apporte.

- **Récif limité** 🪸 : 4 coraux au maximum. En prendre un cinquième oblige à en retirer un parmi les 5.
- **Écosystèmes** 🌿 : le nombre de créatures d'une même famille dans le banc débloque un bonus à deux paliers.
- **Mutations** 🧬 : un modificateur posé sur une créature précise (Écho, Fidèle, Caméléon, Géante…). Nurserie, comptoir,
  épaves et gardiens en proposent, et certaines récompenses sont déjà mutées.
- **Fusion** ★ : deux créatures identiques n'en font plus qu'une (Éclat additionné, +1 Mult permanent).
- **Offres orientées** : les récompenses et le comptoir penchent vers votre récif et votre banc, la dernière offre restant libre pour bifurquer.
- **Mots-clés** : **Éphémère** (une fois par plongée), **Fidèle** (revient en main), **Éclosion** (devient une autre créature pour toujours).
- **Banc épais ou banc affûté** : le Krill et les Anchois aiment les grands bancs ou les copies, l'Hippocampe veut un banc fin, la Murène se nourrit de la défausse.
- **Parasites** ☣️ : le prix de certaines épaves. Ils encombrent le banc jusqu'à ce que vous les relâchiez ou qu'un Orque ou un Labre s'en charge.

## Le côté roguelike

- **Carte à embranchements** pour chacune des 3 zones (Lagon → Tombant → Abysses) : 🐟 plongées, 💀 plongées
  périlleuses (avec condition, rapportent un artefact), ❓ épaves (événements à choix), ⚓ comptoir, 🌱 nurserie.
  Aucun nœud n'offre tout ce qu'offre son voisin avec des choix en plus : chaque route en ferme d'autres.
- **Gardiens** 👑 annoncés dès l'entrée dans la zone (Kraken, Tempête, Léviathan, Courant glacé…) : on construit
  son récif en conséquence. Le vaincre fait pousser un **nouveau corail**.
- **Oxygène** 🫧 : une plongée ratée coûte 1 bulle ; à zéro, l'expédition s'arrête. Rater un gardien y met fin aussitôt.
- **Économie** : des perles pour chaque victoire, et un bonus pour chaque marée non utilisée.
- **Changements permanents** : créatures qui grandissent (Poisson-lune, Bernard-l'ermite), prédateurs qui dévorent
  leurs voisins pour toujours (Orque), améliorations ★ à la nurserie, coraux fortifiés, banc à affiner au comptoir.
- **19 artefacts** qui changent les règles (Boussole, Écaille de sirène, Sablier, Bourse de nacre…).
- **Méta-progression** : 4 plongeurs (un artefact et un penchant qui oriente les tirages), 5 niveaux de **Profondeur** (difficulté),
  un **bestiaire** à compléter et une **plongée du jour** (même graine pour tout le monde).
- Les expéditions sont **déterministes** à partir de leur graine et sauvegardées automatiquement (localStorage, effaçable depuis l'écran titre).

## Structure

```
index.html        page unique
style.css         styles
js/data.js        créatures, coraux, mutations, écosystèmes, artefacts, conditions, plongeurs, objectifs (tout l'équilibrage)
js/engine.js      règles du jeu, carte, plongées, score, boutique, événements (sans affichage)
js/ui.js          rendu et interactions
```

Ajouter `?debug` à l'URL expose `S`, `E` et `render` dans la console.

## Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` publie le site à chaque push sur `main`.
Dans **Settings → Pages**, choisir **Source : GitHub Actions**.
(Alternative : *Deploy from a branch* sur la racine de `main` fonctionne aussi, le site étant statique.)
