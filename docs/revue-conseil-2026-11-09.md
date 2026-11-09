# Revue « conseil » de Krazy Sea : 9 novembre 2026

Compte rendu complet d'une revue par six profils de joueurs, faite avant les changements du même jour. Il sert de référence
pour ne pas refaire les simulations : les chiffres ci-dessous suffisent pour décider. La section « Suivi » à la fin dit ce
qui a été corrigé, ce qui a été écarté, et ce qui reste ouvert.

## Méthode

- **Six profils** : expert UX/UI, game designer, joueur débutant, joueur expérimenté (roguelikes de deck-building),
  testeur QA, chercheur de méta (min-max). Chacun a joué de vraies expéditions.
- **Sans navigateur.** Les parties ont été jouées dans Node 24 en important `js/engine.js`, qui n'a pas d'affichage.
  Tout ce qui est visuel (débordements, tailles, contrastes) vient de la lecture de `js/ui.js` et `style.css`, pas d'un rendu réel.
  Les contrastes ont été calculés à partir des couleurs CSS.
- **Volumes joués** :
  - méta : 11 250 expéditions complètes ;
  - QA : 1 200 expéditions fuzzées (environ 210 000 actions), dont environ 250 avec un aller-retour JSON à chaque action ;
  - QA : 62 tests unitaires d'effets ;
  - environ 30 expéditions jouées en prenant les décisions une à une (débutant, game designer, expérimenté).
- **Le bot de simulation** : à chaque marée, il choisit le meilleur placement par `scoreTide` (choix glouton, puis échanges
  et déplacements). Ses politiques de draft, de route et d'achat sont paramétrables. Il gagne 45 % des expéditions avec
  l'Exploratrice en P0, contre environ 19 % pour l'ancien bot de référence : **ses taux sont optimistes**. Il ne cherche pas
  activement les combos ; les combos cassés ont été trouvés à la main et par calcul de plafond.
- **Scripts** : ils sont dans le dossier temporaire de la session, qui peut avoir disparu. Pour les reconstruire :
  un harnais qui suit l'enchaînement des appels de `ui.js` (`draftChoose`, `enterNode`, `place`, `launchTide`, `nextTide`,
  `rewardChoose`, `shopBuy`, `restChoose`, `eventChoose`, `applyPick`…) suffit. Le moteur est déterministe à graine fixée.

## Chiffres de référence (avant les changements)

### Taux de victoire du bot méta (politique de base, 300 expéditions par case)

| Plongeur | P0 | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| Exploratrice | 45 % | 32 % | 21 % | 21 % | 18 % |
| Biologiste | 35 % | 24 % | 17 % | 15 % | 12 % |
| Chasseuse | 56 % | 43 % | 31 % | 29 % | 25 % |
| Naturaliste | 53 % | 40 % | 33 % | 28 % | 31 % |

Taux de réussite par type de plongée, de la zone 0 à la zone 2 :

| Type | Zone 0 | Zone 1 | Zone 2 |
|---|---|---|---|
| Plongées normales | 98,7 % | 96,1 % | 94,3 % |
| Plongées périlleuses | 77 % | 72 % | 67 % |
| Gardiens | 79 % | 68 % | 55 % |

Médiane d'une plongée normale : 1,25 à 1,29 fois l'objectif.

### Effet de chaque condition sur le score (mesure contrefactuelle)

Avant chaque plongée périlleuse ou chaque gardien, la même plongée a été rejouée depuis le même état : une fois sans
condition, puis une fois avec chacune des 7 conditions, toutes les marées jouées. Le tableau donne la moyenne géométrique
du score avec la condition divisé par le score sans condition, sur 2 375 plongées (moteur avec les plafonds de multiplicateurs
du même jour, 4 plongeurs en P0 et P2).

| Condition | Zone 0 | Zone 1 | Zone 2 | Ensemble |
|---|---|---|---|---|
| Kraken | ×0,59 | ×0,86 | ×0,85 | ×0,73 |
| Tempête | ×1,01 | ×1,00 | ×1,00 | ×1,00 |
| Léviathan | (absent en zone 0) | ×0,63 | ×0,62 | ×0,63 |
| Courant glacé | ×0,79 | ×0,81 | ×0,81 | ×0,80 |
| Banc fantôme | ×0,66 | ×0,64 | ×0,60 | ×0,64 |
| Haute pression | ×0,89 | ×0,92 | ×0,93 | ×0,91 |
| Siphon | (absent en zone 0) | ×0,73 | ×0,74 | ×0,73 |

Le Kraken est très dur en zone 0 parce qu'on n'y a que 2 coraux. La Tempête n'a aucun effet mesurable : le bot pose toute
sa main, donc perdre la main restante ne coûte rien. Les joueurs humains l'ont vécue de la même façon : le joueur
expérimenté mesure +6 %, c'est un Remous gratuit.

Avant correction, la réussite d'un gardien selon sa condition (une seule condition) allait de 54 % (Léviathan) à 90 % (Tempête).

### Impact des cartes (A/B du bot méta)

Mesure : différence de taux de victoire quand la carte est prise ou quand elle est proposée mais refusée, la moitié des
choix étant tirés au hasard.

| Catégorie | Trop forts | Trop faibles ou nuisibles |
|---|---|---|
| Artefacts | Sablier +25 pts, Prisme +14, Filet +11, Perle noire +10 | Trident −19, Bouteille −11, Lampe, Longue-vue, Masque |
| Créatures | Concombre +20, Poisson-lune +17, Pieuvre mimétique +12,9, Orque +11, Calmar +10,6 | Rémora −12,6, Poisson-clown −10,9, Sardine −10, Baudroie −9,8, Murène −7, Tortue −7, Physalie −5, Poisson-pilote −5, Hippocampe −4,3 |
| Coraux | Corne-de-cerf +12, Cerveau +9,6 | Anémone −9,9, Herbier −6,4 |

- La Boussole est neutre en A/B mais très corrélée à la victoire : 61 % avec, 19 % sans.
- Le joueur expérimenté a fait une autre mesure : le gain de score estimé au moment où il ajoutait la carte. Il trouve
  des cartes mortes : Seiche −11,6 %, Poisson-globe −9 %, Phoque −9 %, Hippocampe −6 %, Tortue −6 %. La Pieuvre mimétique
  y donne +41 %.

### Archétypes (mêmes graines, famille forcée)

- Poissons : 17,5 % de victoire.
- Crustacés et Échinodermes : 42 à 43 %.
- Le Biologiste (Poissons) est le plongeur le plus faible à toutes les Profondeurs.
- L'Hameçon (+1 Éclat aux Poissons) est le pire artefact en fin de partie : 26 % de victoire avec, 34 % sans.
- Le nombre de Langoustes dans le banc fait monter la victoire : 0 → 27 %, 1 → 39 %, 2 → 48 %, 3 → 58 %, 4 → 73 %.
- Pour les Pyrosomes : 0 → 26 %, 3 → 60 %.
- Interdire Langouste, Larve, Pyrosome et Éphyrule fait passer la victoire de 40,7 % à 30,7 %.

### Nurserie, perles, routes

- **Victoire selon le choix habituel à la nurserie** :
  - Mutation : 55 % ;
  - Amélioration ★ : 52,5 % ;
  - Fortifier : 46 % ;
  - Fusion puis Fortifier : 45 %.
- **Perles** :
  - les gagnants terminent avec 69 perles non dépensées en moyenne (72 à 110 dans les parties du joueur expérimenté) ;
  - une politique qui dépense tout ne gagne pas plus (43 %, contre 41 à 45 %) ;
  - Bourse de nacre et Carte au trésor n'ont pas d'effet mesurable.
- **Comptoirs** :
  - 1,36 par zone en moyenne, uniquement en rangées 3 et 4 ;
  - 96 % des zones ont un chemin sans aucun comptoir (sur 300 cartes générées).
- **Routes** :
  - éviter les plongées périlleuses coûte : 34 % de victoire, contre 40 % en les cherchant ;
  - un parcours de plongées pures fait aussi bien qu'un parcours d'épaves (40 %).
- **Défaites (pilote automatique du game designer, 40 expéditions)** :
  - sur 35 défaites, 32 viennent d'un gardien et 3 du manque d'oxygène ;
  - les deux défaites du game designer sont arrivées avec 3/3 🫧.
- **Remous** : il en reste 4,7 en moyenne en fin de plongée.
- **Remplissage** : avec 4 coraux et une main de 7, environ 58 % des emplacements sont remplis, contre 91 % avec 2 coraux.

### Profondeurs

- P3 (−1 oxygène) ne change presque rien : Exploratrice 21,0 % en P2, 21,3 % en P3.
- La Naturaliste gagne plus en P4 qu'en P3 (31 % contre 28 %, dans le bruit statistique).
- P4 ne fait que monter les prix de 25 %, et les perles débordent de toute façon.
- Débloquer la Profondeur suivante demande seulement d'atteindre les Abysses (`afterAction` dans `ui.js`), pas de les terminer.

## Constats, par ordre d'importance

### Bloquants

1. **Les ×2 de la Langouste et du Pyrosome se multiplient entre eux** (`scoreTide`).
   - 4 Langoustes sur un Corail de feu en Harmonie, à la marée 4 : ×64, soit 9 216 points pour un seul corail.
   - Avec Écaille de sirène, Conque et Nasse : ×96, soit 41 472 points.
   - À comparer : un récif ordinaire de 2 coraux marque 268 points, et le gardien des Abysses en P0 demande environ 11 500
     sur toute la plongée.
   - Meilleure marée observée : 70 378 points, pour une médiane de 4 442.
   - Ce qui l'aggrave : la Larve et l'Éphyrule, deux communes, deviennent ces rares en 3 marées seulement.
2. **L'Orque vide le banc.**
   - Rien n'empêchait le banc de descendre sous 6 créatures, alors que le comptoir et les épaves ont ce plancher.
   - Exemple : 30 repas dans une partie, banc passé de 12 à 3 créatures, Orque à +309 Éclat avec Écho.
   - Elle dévorait le voisin à l'Éclat le plus faible, donc les créatures qui donnent du Mult (Méduse, Plancton, Pyrosome, Physalie).
3. **L'Oursin croît de façon quadratique.**
   - Il est Sédentaire et donne +1 Mult par Échinoderme du récif entier, donc N Oursins rapportent environ N² de Mult.
   - Les offres orientées le reproposent en boucle.
   - Exemple : un corail à 40 × 108 avec Herbier, Harmonie et Écaille.
4. **Éponge + Pieuvre mimétique ou Caméléon.**
   - Une seule créature « toutes familles » donnait +8 Mult, alors qu'une vraie Mosaïque de 4 familles donne +4.
   - Combinée à l'Harmonie, qui ignore ces créatures, on atteignait ×64 à ×76 Mult, et une plongée se gagnait en une marée.
5. **Une partie en cours pouvait être effacée sans avertissement.**
   - « Nouvelle expédition » et « Plongée du jour » partageaient le même emplacement de sauvegarde et appelaient `clearSave()`
     sans confirmation.
   - L'essai classé du jour pouvait être perdu : il restait affiché « (en cours) » pour toujours, et tout nouvel essai était
     hors classement.

### Majeurs : game design

6. **L'oxygène ne crée pas de tension.**
   - Les plongées normales sont réussies à 94–99 %.
   - Battre un gardien remet l'oxygène au plein, donc dépenser une bulle juste avant (galion, grotte) ne coûte rien.
   - La route, les plongées périlleuses et le « +1 🫧 » de la nurserie perdent leur enjeu.
7. **Les parties sont tout ou rien.**
   - Avec un moteur (Oursin, Orque, Langouste, Poisson-lune Fidèle), chaque plongée se gagne en 1 ou 2 marées, même en P4.
   - Sans moteur, on perd sur le premier Kraken.
   - Il n'y a presque jamais de victoire de justesse.
8. **Les conditions sont très inégales, et le repère du gardien les ignorait.**
   - Le panneau affichait en vert « il faudra ~1250 par marée » sans tenir compte de la condition.
   - Le joueur débutant a perdu à 3 348 sur 5 000 contre Courant glacé après un repère vert, et s'est senti trompé.
9. **Le passage du tutoriel à la vraie partie est brutal.**
   - Avec les objectifs ×0,5, on n'apprend jamais à se servir du Remous, ni à regrouper Éclat et Mult sur un même corail.
   - Ensuite, on passe de 1 782 à 4 400 en une zone.
10. **L'archétype Poisson est un piège**, et le Biologiste est le plus faible des plongeurs (voir les chiffres plus haut).
11. **Les perles s'accumulent, faute de débouchés** (voir les chiffres plus haut).
12. **Les Profondeurs 3 et 4 n'ajoutent presque rien**, et la progression se débloque sans finir les Abysses.
13. **Une main de 7 ne remplit pas 4 coraux.** Le 3e et le 4e corail restent souvent vides, et prendre un corail en récompense
    devient anecdotique.
14. **Trop de Remous.** Le Masque (atout de départ de l'Exploratrice), le Phoque, le Corail bulle et le palier Nuage d'encre
    ne servent presque à rien.
15. **Autres constats, plus légers** :
    - les gardiens sont moins exigeants que les plongées périlleuses de la rangée 4 : 1 800 contre 2 400, 5 000 contre 5 200,
      environ 11 500 contre 12 900 ;
    - « Planter une bouture » (8 perles pour un corail au hasard) produit le plus souvent un remplacement sans gain ;
    - refuser le corail d'un gardien avec un récif plein donne +4 Mult au total, ce qui vaut souvent mieux que le corail ;
    - l'épave « Laisser faire le courant » donne +8 perles pour presque rien.

### Bugs avérés (QA)

- **Calmar** : voir la section qui lui est consacrée plus bas.
- **Plongée du jour perdue** : voir le bloquant 5.
- **Homard « Au Fond : Éclat ×2 »** : seul l'Éclat de base est doublé. Homard au Fond avec une Crevette voisine : attendu 16, obtenu 13.
- **Courant glacé « Aucun Remous »** : un Phoque posé donne quand même +1 Remous (`place`).
- **Requin** : une créature réduite au silence ne progresse plus.
  - Un Œuf de requin voisin d'un Requin n'éclot pas, le Poisson-lune ne grandit pas, et la mutation Nacrée ne rapporte rien.
  - Cause : le `continue` sur `silenced` dans `launchTide` saute aussi `evolve` et `nacre`.
- **Fidèle sur une Éphémère ou une Sédentaire** : la mutation est perdue ou ne fait rien, sans avertissement (`nextTide`).
- **Sirène « Dupliquez une créature »** : la copie perd sa mutation et le +1 Mult permanent de fusion.
- **Profondeur 4 « Prix +25 % »** : Relâcher et Renouveler ne sont pas majorés.
- **Trèfle + Remonter** : une fois 75 % de l'objectif atteint, abandonner compte comme une victoire et rapporte en plus les
  perles des marées non jouées.
- **Repère du gardien** : `bestTide` n'est pas remis à zéro si on abandonne avant la première marée.
- **Lampe frontale** : avec moins de 3 cartes dans la pioche, elle n'anticipe pas le remélange de la défausse.
- **Nurserie et épaves** (Grotte, Source, Sirène) : pas d'« Annuler », et le jeu bloque si le banc n'a aucune créature
  éligible. Reproduit seulement avec un kit artificiel.
- **Anguille + Écho** : ils ne se cumulent pas (×2 et non ×4). C'est cohérent avec `Math.max`, mais pas documenté.
- **Ce qui est sain** :
  - déterminisme, aller-retour JSON, invariants (ids, piles, perles, oxygène), carte toujours franchissable ;
  - les 19 artefacts conformes à leur texte, sauf la limite du Trèfle ;
  - les 7 conditions conformes, sauf le Phoque sous Courant glacé ;
  - 6 mutations sur 7 conformes, et 23 créatures vérifiées.
- **Volume** : 1 200 parties fuzzées sans aucune exception, NaN ni blocage.

### UX/UI

- **Un clic choisit sans confirmation.**
  - Créature, corail ou carte du draft : cliquer la carte la prend, alors que les artefacts et mutations ont un bouton « Prendre ».
  - Sur tactile, toucher une carte pour lire sa bulle la choisit, et la forme éclose n'est jamais visible avant le choix.
- **Pas d'« Annuler » ni d'Échap** à la nurserie et dans les choix de mutation, alors que le README annonce « Échap annule ».
- **Contenu coupé entre 761 et environ 950 px de large** (d'après le code).
  - Au comptoir, la rangée artefacts + mutation fait environ 924 px, avec `.offer` en `nowrap` et `overflow:hidden`.
  - Le bouton d'achat du dernier article devient inaccessible, sur iPad portrait par exemple.
- **Clavier** :
  - le focus est perdu après chaque pose, car la signature de focus change ;
  - les fenêtres n'ont ni `role="dialog"` ni piège à focus : derrière une bulle du tutoriel, Tab et Entrée font sauter des étapes ;
  - les pastilles `data-tip` ne sont pas focalisables ;
  - aucun raccourci pour lancer la marée ou passer à la suivante.
- **Textes trop petits** : pastilles de bonus et badges à 10 px, tags de famille et de rareté à 0,6em, libellés `.coll` à 10 px.
- **Contrastes faibles** :

  | Élément | Ratio |
  |---|---|
  | Libellés des cases Surface/Fond | 2,2:1 |
  | Étoiles ★ `#d49b00` | 2,2:1 |
  | `.bc-pace.low` | 2,4:1 |
  | Badge négatif blanc sur `#ff6b6b` | 2,8:1 |
  | Texte grisé sur le haut du fond Lagon | 3,35:1 |

- **Échec peu signalé** : après la dernière marée ratée, la barre n'affiche que « Fin de la plongée ». « Remonter » sert à la
  fois pour la victoire et pour l'abandon.
- **Textes faux ou incohérents** :
  - la Découverte du Remous dit « renvoie dans la pioche » alors que le moteur défausse ;
  - la Découverte des écosystèmes affiche « 4/7 » de façon ambiguë alors que le premier palier est déjà actif ;
  - six Découvertes disent « Survolez », même sur tactile, alors que leur voile bloque le pointeur ;
  - « Couronne complète » est classée sous « Positions », pas sous « Bonus de couronne » ;
  - l'icône 🐟 en tête de plongée ne correspond pas au 🤿 de la carte.
- **Boutons désactivés sans explication** : Lancer la marée, Relâcher (banc ≤ 6), choix d'épave, Remous et Remonter pendant
  le tutoriel. Les `data-tip` ne s'affichent pas sur un bouton désactivé.
- **Finitions** :
  - toasts doublés avec le Corail lumineux ;
  - `prefers-reduced-motion` ne couvre que le tutoriel, et « Instantanée » n'arrête pas les animations en boucle ;
  - Options et Règles défilent probablement sur un écran 1366×768 ;
  - la récompense de gardien se fait en 3 étapes sans « 1/3 » ;
  - les artefacts et conditions sont rognés dans la barre du haut ;
  - une même épave peut revenir 3 fois dans une expédition (`pickEvent` tire sans mémoire) ;
  - la carte SVG en `role="img"` masque les étapes aux lecteurs d'écran, il n'y a pas d'`aria-live`, et le bouton « ? »
    n'a pas d'`aria-label`.
- **Confort** : environ 17 clics par marée et 550 à 870 par expédition. Suggestions : raccourcis Espace (lancer) et Entrée
  (suivante), « tout poser au mieux », double-clic pour poser au meilleur emplacement.

### Exploits relevés

- **Plongée du jour prévisible** : la graine est `seedFrom('krazy-' + jour)`, donc connue d'avance. On peut répéter l'essai
  dans une fenêtre privée avant l'essai classé, et « Effacer mes données » rend aussi un nouvel essai classé. C'est acceptable
  pour un classement purement local.
- **Pas d'exploit à corriger** côté sauvegarde : la sauvegarde à chaque rendu et le RNG déterministe empêchent le
  save-scumming, et « Remonter » ne donne aucun avantage, sauf avec le Trèfle (voir les bugs).

### Ce qui plaît (à préserver)

- La boucle « poser, voir le chiffre monter » : formule Éclat × Mult lisible et score prévu en direct sur le bouton.
- Le tutoriel : poses imposées, repères qui s'allument, chiffres exacts.
- Le draft et les offres orientées, avec des indications qui guident sans imposer.
- La carte ne propose jamais une route qui en domine une autre.
- Les gardiens annoncés à l'avance. Le Léviathan est un bon contre aux builds sur un seul corail.
- Les décisions de long terme : mutations, fusion, éclosion.
- Les Options : interrupteurs accessibles et contour de focus visible partout.
- Le rythme : environ 20 étapes par expédition, sans temps mort.

## Le Calmar : pas un bug de puissance, une amélioration sans effet

- **Ce qui n'est pas en cause** : sa puissance de copie. Le texte, « Copie l'Éclat de la créature opposée », est respecté.
- **Ce qui est en cause** : tout ce qui augmente son propre Éclat est ignoré.
  - Son Éclat est calculé uniquement à partir de la créature opposée (`x.opp.pts + x.aura`), sans `x.base`.
  - Or `x.base` contient l'Éclat de base, l'amélioration ★, la mutation Géante (+6) et l'Éclat additionné par la fusion.
- **Conséquences pour le joueur** :
  - la nurserie propose « Faire grandir » le Calmar et affiche « +2 », sans aucun effet ;
  - Géante sur un Calmar est une mutation gâchée ;
  - fusionner deux Calmars n'apporte que le +1 Mult de la fusion.
- **Exemple** : Calmar ★ (bonus 4) en Surface, Espadon seul au Fond. Le joueur s'attend à 22 et obtient 18. Avec Géante,
  il s'attend à 24 et obtient 18.
- **Décision** : l'auteur ne souhaite pas renforcer le Calmar. Rien n'a été changé.
- **Piste si on veut éviter le piège** sans le renforcer : ne pas proposer le Calmar à « Faire grandir », ni la mutation
  Géante sur lui, ou préciser sur sa carte que son propre Éclat ne compte pas.

## Suivi

### Fait le 9 novembre 2026

1. **Multiplicateurs plafonnés** (`engine.js › scoreTide`, `data.js`).
   - Sur un même corail, seul le plus fort ×Mult de créature compte (Langouste, Pyrosome). Les autres n'affichent plus de
     badge ×2.
   - Les ×2 du Corail de feu et des couronnes s'y ajoutent toujours. Le plafond pratique devient ×8 (×12 avec l'Écaille),
     contre ×64 avant.
   - Les textes de la Langouste et du Pyrosome le disent.
   - L'Éponge compte une créature « toutes familles » comme une famille de plus, et non comme +8.
   - L'Oursin compte les Échinodermes de son corail, et non du récif.
   - La Larve et l'Éphyrule éclosent toujours en 3 marées : à revoir seulement si les simulations le demandent.
2. **Orque** (`data.js`, avec `BASE.minBag = 6`).
   - Elle ne dévore plus si le banc tomberait sous 6 créatures (en comptant les autres proies de la même marée).
   - Elle choisit un Parasite voisin s'il y en a un, et épargne les voisins qui donnent du Mult ou un ×Mult.
   - Son texte le dit.
3. **Sauvegarde** (`ui.js`).
   - La Plongée du jour a son propre emplacement (`krazy-sea-daily-run-v1`). Une ancienne sauvegarde du jour rangée dans
     l'emplacement normal y est déplacée au chargement.
   - Commencer une expédition, relancer le tutoriel ou une Plongée du jour qui écraserait une partie en cours demande
     confirmation (fenêtre `overwrite`).
   - Le bouton devient « Reprendre la plongée du jour » quand une plongée du jour d'aujourd'hui attend.
   - Un essai classé dont la sauvegarde a disparu s'affiche « abandonné » et non plus « en cours ».
4. **Conditions recalibrées** (`data.js › CONDITIONS[k].x`, `engine.js › condX`, `targetFor`).
   - L'objectif des plongées périlleuses et des gardiens est multiplié par l'effet mesuré de chaque condition.
   - Le Kraken vaut ×0,6 avec 2 coraux et ×0,85 au-delà.
   - `eliteX` passe de 1,2 à 1,54, et `bossX` de [0,75 ; 0,8 ; 0,74] à [1 ; 1,03 ; 1,12], pour garder la même difficulté moyenne par zone.
   - La condition ajoutée par la Profondeur 5 n'est pas compensée.
   - Le repère du gardien estime la meilleure marée freinée par les conditions (sauf le Siphon, déjà compté dans le nombre de
     marées). La carte affiche ce que coûte chaque condition.
   - Résultat, sur 1 600 expéditions (4 plongeurs en P0 et P2) :

     | | Avant | Après |
     |---|---|---|
     | Gardiens, toutes conditions (zones 0 / 1 / 2) | 80 / 69 / 52 % | 81 / 70 / 52 % |
     | Élites (zones 0 / 1 / 2) | 78 / 70 / 63 % | 78 / 71 / 60 % |
     | Gardien selon sa condition (une seule) | 52 à 92 % | 71 à 80 % |
     | Expéditions gagnées | 30,4 % | 32,5 % |

   - Le fuzzer QA (300 expéditions) ne trouve aucune exception, aucun blocage et aucun écart de déterminisme.

5. **Enjeu de l'oxygène et des perles** (validé par l'auteur, fait sans nouvelle simulation).
   - **A.** Vaincre un gardien rend +1 🫧 au lieu de remplir l'oxygène.
   - **B.** Rater un gardien coûte `BASE.bossRetryCost` (2 🫧) et le fait rejouer une fois (`canRetryBoss`, `dive.retry`),
     à condition qu'il reste au moins 1 🫧 ensuite. Sinon, l'expédition prend fin. La fenêtre « Remonter » l'annonce.
   - **C.** À la nurserie, un premier choix est offert, puis un second s'achète (`BASE.restSecond` : 10 / 15 / 20 perles
     selon la zone, majorées en P4). « Reprendre la route » permet de partir après le premier choix. Les choix de la
     nurserie peuvent maintenant être annulés.
   - **D.** Au comptoir, « Fortifier un corail » (+1 Mult) coûte 8 perles, puis 4 de plus à chaque achat
     (`BASE.shopFortify`, `shopFortifyStep`, `run.fortBought`).
   - **À faire** : resimuler pour recalibrer les gardiens, puisque B les rend moins mortels et que A, C et D changent
     l'économie. Le fuzzer QA (300 expéditions) est propre.

### Écarté

- **Calmar** : laissé tel quel. L'auteur juge que c'est au joueur de comprendre qu'améliorer son propre Éclat ne sert à
  rien, puisqu'il copie celui d'en face. Ne pas le « corriger ».

### Ouvert

- **La Tempête n'a aucun effet mesurable**. Avec `x = 1`, l'objectif n'est pas réduit, mais la condition reste sans mordant.
  Piste : qu'elle défausse aussi une créature du récif, ou qu'elle retire une créature de la main avant la pioche.
- **Tout le reste des constats ci-dessus** : bugs QA, UX/UI, Poissons, Profondeurs 3 et 4, Remous, main de 7 avec 4 coraux,
  tutoriel, cartes faibles.
