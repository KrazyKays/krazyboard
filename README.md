# 🪸 Récif Mêlé

Jeu de cartes **solo roguelite** jouable dans le navigateur, inspiré des mécaniques de *Forêt Mixte*
(cartes à poser autour d'un « arbre », cartes à deux moitiés, clairière partagée, fin de partie déclenchée
par des cartes cachées dans la pioche) mais transposé **sous la mer** : les arbres deviennent des coraux,
la clairière devient le Courant, les hivers deviennent des Marées.

100 % statique (HTML / CSS / JavaScript modules, aucune dépendance, aucune compilation) : parfait pour GitHub Pages.

## Jouer

- En local : `python3 -m http.server` à la racine puis ouvrir <http://localhost:8000>
  (les modules ES ne se chargent pas en `file://`).
- En ligne : voir « Déploiement » ci-dessous.

## Règles en bref

- **Un tour = une action** : *piocher 2 cartes* (depuis la pioche et/ou le Courant) **ou** *jouer une carte*
  en défaussant autant de cartes que son coût dans le Courant.
- **Coraux** : ils forment votre récif. Chacun offre 4 emplacements : Surface ⬆, Fond ⬇, deux Flancs ⬅➡.
- **Cartes créatures** : deux créatures par carte, vous n'en jouez qu'une. Certaines sont empilables.
- **Symbiose ✨** : la couleur de coin d'une carte créature = une famille de corail. Posée sur ce corail → piochez 1 carte.
- **Épave ⚓** : certaines créatures y coulent des cartes, 1 pt chacune.
- **Courant** : une carte de la pioche le rejoint à chaque fin de tour ; à 10 cartes il déborde et se vide.
- **Marées 🌊** : cachées dans le dernier tiers de la pioche ; à la dernière, la plongée s'arrête et le récif est compté.

## Côté roguelite

- **6 plongées** à objectif croissant (28 → 76 pts). Un échec met fin à l'expédition.
- À partir de la 2ᵉ plongée, des **conditions** aléatoires compliquent la partie (Courant fort, Eaux troubles, Marée haute…).
- Après chaque réussite : des **perles** (bonus si vous dépassez l'objectif), **une carte au choix** parmi 3,
  puis le **Comptoir** : acheter des cartes (dont des rares ★), des **trésors** aux effets passifs, ou retirer une carte.
- **Méta-progression** : de nouveaux plongeurs de départ se débloquent en allant plus loin.
- L'expédition en cours est sauvegardée automatiquement (localStorage).

## Structure

```
index.html        page unique
style.css         styles
js/data.js        coraux, créatures, trésors, conditions, plongées (facile à équilibrer)
js/engine.js      règles du jeu, indépendantes de l'affichage
js/ui.js          rendu et interactions
```

## Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` publie le site à chaque push sur `main`.
Dans **Settings → Pages**, choisir **Source : GitHub Actions**.
(Alternative : *Deploy from a branch* sur la racine de `main` fonctionne aussi, le site étant statique.)
