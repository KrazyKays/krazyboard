// ─────────────────────────────────────────────────────────────
//  Krazy Sea — données du jeu
//  Tout l'équilibrage se fait ici : créatures, coraux, artefacts,
//  conditions, événements, plongeurs et Profondeurs.
// ─────────────────────────────────────────────────────────────

// Les 4 emplacements autour d'un corail.
//   N = Surface ⬆   S = Fond ⬇   W / E = Flancs ⬅ ➡
export const SLOTS = ['N', 'E', 'S', 'W'];
export const SLOT_LABEL = { N: 'Surface', S: 'Fond', E: 'Flanc', W: 'Flanc' };
export const SLOT_ICON = { N: '⬆', S: '⬇', E: '➡', W: '⬅' };
// Voisins dans la couronne (les deux cases qui touchent) et case opposée.
export const RING = { N: ['W', 'E'], E: ['N', 'S'], S: ['E', 'W'], W: ['S', 'N'] };
export const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

export const FAMILIES = {
  poisson:   { name: 'Poisson',     icon: '🐟', color: '#4cc9f0' },
  crustace:  { name: 'Crustacé',    icon: '🦀', color: '#f15b5b' },
  mollusque: { name: 'Mollusque',   icon: '🐚', color: '#c77dff' },
  cnidaire:  { name: 'Cnidaire',    icon: '🪼', color: '#ff8fd8' },
  mammifere: { name: 'Mammifère',   icon: '🐬', color: '#8ecae6' },
  echino:    { name: 'Échinoderme', icon: '⭐', color: '#ffb703' },
  reptile:   { name: 'Reptile',     icon: '🐢', color: '#90be6d' },
  oiseau:    { name: 'Oiseau',      icon: '🐧', color: '#e9ecef' },
  nuisible:  { name: 'Nuisible',    icon: '☣️', color: '#7a7f6a' },
};

export const RARITY = {
  c: { name: 'Commune', price: 4 },
  u: { name: 'Peu commune', price: 6 },
  r: { name: 'Rare', price: 9 },
  x: { name: 'Parasite', price: 0 }, // jamais proposé en récompense
};

// ── Créatures ────────────────────────────────────────────────
// Crochets de score (voir engine.js › scoreTide) :
//   pre(x, B)    → avant le calcul : auras, silences, relances sur les voisins
//   eclat(x, B)  → points d'Éclat supplémentaires
//   mult(x, B)   → Mult ajouté au corail
//   xmult(x, B)  → multiplicateur du Mult du corail
//   after(x, B, out) → après la marée : croissance, perles, prédation…
//   place        → effet immédiat à la pose ({ draw }, { remous })
//   sed          → Sédentaire : reste en place toute la plongée
//   copy         → copie l'Éclat de la créature opposée
//   allFam       → compte comme toutes les familles
//   ephem        → Éphémère : une fois jouée, sortie de la plongée en cours
//   loyal        → Fidèle : revient en main après la marée
//   evolve       → Éclosion : { into, after } devient définitivement `into` après `after` marées jouées
//   parasite     → encombre le banc, n'est jamais proposé en récompense
//   needsParasite → proposé seulement si le banc contient un Parasite
const fam = (x, f) => x.allFam || x.def.fam === f;
const nbFam = (x, f) => x.nbs.filter((n) => fam(n, f)).length;

export const CREATURES = {
  // ── Poissons ──
  sardine: { name: 'Sardines', emoji: '🐟', fam: 'poisson', pts: 2, rar: 'c',
    text: '+2 Éclat par Sardines voisines.',
    eclat: (x) => 2 * x.nbs.filter((n) => n.t === 'sardine').length },
  clown: { name: 'Poisson-clown', emoji: '🐠', fam: 'poisson', pts: 3, rar: 'c',
    text: '+6 Éclat sur une Anémone.',
    eclat: (x) => (x.coral.t === 'anemone' ? 6 : 0) },
  globe: { name: 'Poisson-globe', emoji: '🐡', fam: 'poisson', pts: 1, rar: 'c',
    text: '+1 Mult par voisin.',
    mult: (x) => x.nbs.length },
  espadon: { name: 'Espadon', emoji: '🗡️', fam: 'poisson', pts: 6, rar: 'u',
    text: 'Solitaire : Éclat ×3 s’il n’a aucun voisin.',
    eclat: (x) => (x.nbs.length === 0 ? 12 : 0) },
  lune: { name: 'Poisson-lune', emoji: '🌕', fam: 'poisson', pts: 1, rar: 'u',
    text: 'Grandit : +2 Éclat permanent après chaque marée où il joue.',
    after: (x) => { x.inst.bonus += 2; } },
  lanterne: { name: 'Baudroie', emoji: '🏮', fam: 'poisson', pts: 2, rar: 'r',
    text: '+1 Mult par créature restée en main.',
    mult: (x, B) => B.handLeft },
  manta: { name: 'Raie manta', emoji: '🪁', fam: 'poisson', pts: 3, rar: 'r',
    text: 'En Surface ⬆ : +4 Mult.',
    mult: (x) => (x.slot === 'N' ? 4 : 0) },

  // ── Crustacés ──
  crabe: { name: 'Crabe', emoji: '🦀', fam: 'crustace', pts: 3, rar: 'c',
    text: '+1 Éclat par Crustacé posé dans le récif.',
    eclat: (x, B) => B.countFam('crustace') },
  crevette: { name: 'Crevette nettoyeuse', emoji: '🦐', fam: 'crustace', pts: 1, rar: 'c',
    text: 'Donne +3 Éclat à chacun de ses voisins.',
    pre: (x) => { for (const n of x.nbs) n.aura += 3; } },
  homard: { name: 'Homard', emoji: '🦞', fam: 'crustace', pts: 5, rar: 'u',
    text: 'Au Fond ⬇ : Éclat ×2.',
    eclat: (x) => (x.slot === 'S' ? x.base : 0) },
  bernard: { name: "Bernard-l'ermite", emoji: '🐚', fam: 'crustace', pts: 2, rar: 'u',
    text: 'Grandit : +2 Éclat permanent après chaque marée où sa couronne est complète.',
    after: (x, B) => { if (B.full(x.ci)) x.inst.bonus += 2; } },
  langouste: { name: 'Langouste royale', emoji: '👑', fam: 'crustace', pts: 4, rar: 'r',
    text: 'Mult du corail ×2 s’il porte au moins 3 Crustacés.',
    xmult: (x, B) => (B.on(x.ci).filter((n) => fam(n, 'crustace')).length >= 3 ? 2 : 1) },

  // ── Mollusques ──
  poulpe: { name: 'Poulpe', emoji: '🐙', fam: 'mollusque', pts: 2, rar: 'c',
    text: 'Pose : piochez 1 créature.', place: { draw: 1 } },
  nudi: { name: 'Nudibranche', emoji: '🐌', fam: 'mollusque', pts: 2, rar: 'c',
    text: '+3 Mult si ses voisins (2 min.) sont tous de familles différentes.',
    mult: (x) => {
      if (x.nbs.length < 2 || x.nbs.some((n) => n.allFam)) return x.nbs.length >= 2 ? 3 : 0;
      return new Set(x.nbs.map((n) => n.def.fam)).size === x.nbs.length ? 3 : 0;
    } },
  huitre: { name: 'Huître perlière', emoji: '🦪', fam: 'mollusque', pts: 1, rar: 'u',
    text: 'Après la marée : +2 perles.',
    after: (x, B, out) => { out.pearls += 2; } },
  calmar: { name: 'Calmar', emoji: '🦑', fam: 'mollusque', pts: 0, rar: 'u', copy: true,
    text: 'Copie l’Éclat de la créature opposée.' },
  mimetique: { name: 'Pieuvre mimétique', emoji: '🎭', fam: 'mollusque', pts: 2, rar: 'r', allFam: true,
    text: 'Compte comme toutes les familles. +2 Éclat par famille voisine distincte.',
    eclat: (x) => 2 * new Set(x.nbs.map((n) => n.def.fam)).size },

  // ── Cnidaires ──
  meduse: { name: 'Méduse', emoji: '🪼', fam: 'cnidaire', pts: 1, rar: 'c',
    text: '+2 Mult.', mult: () => 2 },
  physalie: { name: 'Physalie', emoji: '🎐', fam: 'cnidaire', pts: 0, rar: 'u',
    text: '+5 Mult, mais −2 Éclat à chacun de ses voisins.',
    mult: () => 5, pre: (x) => { for (const n of x.nbs) n.aura -= 2; } },
  pyrosome: { name: 'Pyrosome', emoji: '🕯️', fam: 'cnidaire', pts: 1, rar: 'r',
    text: 'Mult du corail ×2 si sa couronne est complète.',
    xmult: (x, B) => (B.full(x.ci) ? 2 : 1) },

  // ── Mammifères ──
  phoque: { name: 'Phoque', emoji: '🦭', fam: 'mammifere', pts: 3, rar: 'c',
    text: 'Pose : +1 Remous.', place: { remous: 1 } },
  loutre: { name: 'Loutre de mer', emoji: '🦦', fam: 'mammifere', pts: 2, rar: 'c',
    text: '+4 Éclat par Mollusque ou Échinoderme voisin.',
    eclat: (x) => 4 * (nbFam(x, 'mollusque') + nbFam(x, 'echino')) },
  dauphin: { name: 'Dauphin', emoji: '🐬', fam: 'mammifere', pts: 4, rar: 'u',
    text: '+3 Éclat par Poisson sur son corail.',
    eclat: (x, B) => 3 * B.on(x.ci).filter((n) => fam(n, 'poisson')).length },
  baleine: { name: 'Baleine', emoji: '🐋', fam: 'mammifere', pts: 10, rar: 'r',
    text: 'Chant : +1 Mult à tous les coraux.' },
  orque: { name: 'Orque', emoji: '🐳', fam: 'mammifere', pts: 6, rar: 'r',
    text: 'Prédateur : après la marée, dévore son voisin le plus faible (retiré du banc pour toujours) et gagne +4 Éclat permanent.',
    after: (x, B, out) => {
      const prey = x.nbs.filter((n) => n.t !== 'orque' && !out.devoured.has(n.id))
        .sort((a, b) => a.pts - b.pts)[0];
      if (prey) { out.devoured.add(prey.id); x.inst.bonus += 4; out.notes.push(`🐳 L’Orque dévore ${prey.def.name} !`); }
    } },

  // ── Autres ──
  requin: { name: 'Requin', emoji: '🦈', fam: 'poisson', pts: 4, rar: 'u',
    text: 'Prédateur : +6 Éclat par Poisson voisin, qui ne marque plus rien.',
    pre: (x) => { for (const n of x.nbs) if (fam(n, 'poisson') && n.t !== 'requin') { n.silenced = true; x.aura += 6; } } },
  anguille: { name: 'Anguille électrique', emoji: '⚡', fam: 'poisson', pts: 1, rar: 'r',
    text: 'Ses voisins marquent deux fois leur Éclat.',
    pre: (x) => { for (const n of x.nbs) n.times = Math.max(n.times, 2); } },
  tortue: { name: 'Tortue', emoji: '🐢', fam: 'reptile', pts: 3, rar: 'c', sed: true,
    text: 'Sédentaire : reste en place toute la plongée.' },
  etoile: { name: 'Étoile de mer', emoji: '⭐', fam: 'echino', pts: 2, rar: 'c',
    text: 'Au Fond ⬇ : +5 Éclat.',
    eclat: (x) => (x.slot === 'S' ? 5 : 0) },
  oursin: { name: 'Oursin', emoji: '🌰', fam: 'echino', pts: 1, rar: 'u', sed: true,
    text: 'Sédentaire. +1 Mult par Échinoderme posé dans le récif.',
    mult: (x, B) => B.countFam('echino') },
  manchot: { name: 'Manchot', emoji: '🐧', fam: 'oiseau', pts: 1, rar: 'u',
    text: 'Pose : piochez 2 créatures.', place: { draw: 2 } },

  // ── Taille du banc : banc épais ou banc affûté ──
  anchois: { name: 'Anchois', emoji: '🥫', fam: 'poisson', pts: 2, rar: 'c',
    text: '+2 Éclat par Anchois dans votre banc.',
    eclat: (x, B) => 2 * B.bagT('anchois') },
  krill: { name: 'Krill', emoji: '🍤', fam: 'crustace', pts: 1, rar: 'c',
    text: '+1 Éclat par tranche de 4 créatures dans votre banc.',
    eclat: (x, B) => Math.floor(B.bagCount / 4) },
  hippocampe: { name: 'Hippocampe', emoji: '🐴', fam: 'poisson', pts: 2, rar: 'u',
    text: '+1 Mult par créature de moins que 15 dans votre banc (max +6).',
    mult: (x, B) => Math.max(0, Math.min(6, 15 - B.bagCount)) },
  siphonophore: { name: 'Siphonophore', emoji: '🧵', fam: 'cnidaire', pts: 1, rar: 'u',
    text: '+1 Mult par Cnidaire dans votre banc.',
    mult: (x, B) => B.bagFam('cnidaire') },
  ophiure: { name: 'Ophiure', emoji: '🦴', fam: 'echino', pts: 2, rar: 'c',
    text: '+2 Éclat par Échinoderme dans votre banc.',
    eclat: (x, B) => 2 * B.bagFam('echino') },

  // ── Cycle du banc : pioche, défausse, retour en main ──
  remora: { name: 'Rémora', emoji: '🧲', fam: 'poisson', pts: 3, rar: 'c', loyal: true,
    text: 'Fidèle : revient en main après la marée.' },
  pilote: { name: 'Poisson-pilote', emoji: '🚩', fam: 'poisson', pts: 2, rar: 'u',
    text: 'Pose : piochez la créature la plus forte de votre pioche.', place: { tutor: 1 } },
  murene: { name: 'Murène', emoji: '🪱', fam: 'poisson', pts: 2, rar: 'u',
    text: '+1 Éclat par créature dans la défausse.',
    eclat: (x, B) => B.discardN },
  seiche: { name: 'Seiche', emoji: '🌫️', fam: 'mollusque', pts: 2, rar: 'u',
    text: 'Pose : défaussez votre main et piochez-en une de plus.', place: { cycle: true } },

  // ── Éphémères : énormes, mais une seule fois par plongée ──
  plancton: { name: 'Plancton luisant', emoji: '✨', fam: 'cnidaire', pts: 0, rar: 'c', ephem: true,
    text: '+6 Mult. Éphémère : une seule fois par plongée.', mult: () => 6 },
  squille: { name: 'Squille', emoji: '🥊', fam: 'crustace', pts: 22, rar: 'u', ephem: true,
    text: 'Un coup de poing fulgurant. Éphémère : une seule fois par plongée.' },

  // ── Investissements : grandissent ou éclosent ──
  nautile: { name: 'Nautile', emoji: '🍥', fam: 'mollusque', pts: 1, rar: 'u',
    text: 'Grandit : +1 Mult permanent, une fois par plongée où il joue.',
    after: (x, B) => { if (x.inst.grew !== B.run.dives) { x.inst.grew = B.run.dives; x.inst.mbonus += 1; } } },
  concombre: { name: 'Concombre de mer', emoji: '🥒', fam: 'echino', pts: 1, rar: 'c', sed: true,
    text: 'Sédentaire. Grandit : +1 Éclat permanent après chaque marée.',
    after: (x) => { x.inst.bonus += 1; } },
  polype: { name: 'Polype', emoji: '🌱', fam: 'cnidaire', pts: 1, rar: 'c',
    text: '+1 Mult par Cnidaire posé dans le récif.',
    mult: (x, B) => B.countFam('cnidaire') },
  oeuf: { name: 'Œuf de requin', emoji: '🥚', fam: 'poisson', pts: 1, rar: 'c', evolve: { into: 'requin', after: 2 },
    text: 'Éclosion : devient un Requin après 2 marées jouées.' },
  larve: { name: 'Larve de langouste', emoji: '🧫', fam: 'crustace', pts: 1, rar: 'c', evolve: { into: 'langouste', after: 3 },
    text: 'Éclosion : devient une Langouste royale après 3 marées jouées.' },
  ephyrule: { name: 'Éphyrule', emoji: '🫐', fam: 'cnidaire', pts: 0, rar: 'c', evolve: { into: 'pyrosome', after: 3 },
    text: 'Éclosion : devient un Pyrosome après 3 marées jouées.' },
  labre: { name: 'Labre nettoyeur', emoji: '🧼', fam: 'poisson', pts: 2, rar: 'u', needsParasite: true,
    text: 'Après la marée : retire pour toujours un Parasite voisin, et +5 perles.',
    after: (x, B, out) => {
      const p = x.nbs.find((n) => n.def.parasite && !out.devoured.has(n.id));
      if (p) { out.devoured.add(p.id); out.pearls += 5; out.notes.push(`🧼 Le Labre nettoie : ${p.def.name} disparaît !`); }
    } },

  // ── Parasites : le prix de certaines épaves ──
  plastique: { name: 'Sac plastique', emoji: '🛍️', fam: 'nuisible', pts: 0, rar: 'x', parasite: true,
    text: 'Parasite : −2 Mult sur le corail où il est posé.', mult: () => -2 },
  filet_fantome: { name: 'Filet fantôme', emoji: '🕸️', fam: 'nuisible', pts: 0, rar: 'x', parasite: true, sed: true,
    text: 'Parasite. Sédentaire : −3 Éclat à ses voisins.',
    pre: (x) => { for (const n of x.nbs) n.aura -= 3; } },
};

// ── Mutations : un modificateur posé sur UNE créature de votre banc ──
export const MUTATIONS = {
  nacre:      { name: 'Nacrée', emoji: '🦪', text: '+1 perle à chaque marée où elle joue.' },
  fluo:       { name: 'Fluorescente', emoji: '🔆', text: '+2 Mult.' },
  echo:       { name: 'Écho', emoji: '🔁', text: 'Marque deux fois son Éclat.' },
  fidele:     { name: 'Fidèle', emoji: '🧲', text: 'Revient en main après la marée.' },
  veloce:     { name: 'Véloce', emoji: '💨', text: 'Pose : piochez 1 créature.' },
  polyvalent: { name: 'Caméléon', emoji: '🦎', text: 'Compte comme toutes les familles.' },
  geant:      { name: 'Géante', emoji: '💪', text: '+6 Éclat.' },
};

// ── Écosystèmes : le nombre de créatures d'une famille DANS VOTRE BANC
// débloque un bonus (chaque palier remplace le précédent).
export const ECOSYSTEMS = {
  poisson:   { name: 'Grand banc', tiers: [
    { n: 4, eclat: 2, text: 'Poissons : +2 Éclat.' },
    { n: 7, eclat: 5, text: 'Poissons : +5 Éclat.' }] },
  crustace:  { name: 'Carapaces', tiers: [
    { n: 4, eclat: 2, text: 'Crustacés : +2 Éclat.' },
    { n: 7, eclat: 2, mult: 1, text: 'Crustacés : +2 Éclat et +1 Mult.' }] },
  mollusque: { name: 'Nuage d’encre', tiers: [
    { n: 3, remous: 1, text: '+1 Remous à chaque plongée.' },
    { n: 5, remous: 1, hand: 1, text: '+1 Remous et +1 créature en main.' }] },
  cnidaire:  { name: 'Essaim', tiers: [
    { n: 3, mult: 1, text: 'Cnidaires : +1 Mult.' },
    { n: 5, mult: 2, text: 'Cnidaires : +2 Mult.' }] },
  mammifere: { name: 'Troupeau', tiers: [
    { n: 3, eclat: 3, text: 'Mammifères : +3 Éclat.' },
    { n: 5, eclat: 8, text: 'Mammifères : +8 Éclat.' }] },
  echino:    { name: 'Colonie', tiers: [
    { n: 3, eclat: 3, text: 'Échinodermes : +3 Éclat.' },
    { n: 5, eclat: 3, mult: 2, text: 'Échinodermes : +3 Éclat et +2 Mult.' }] },
};

// ── Coraux (le centre de chaque couronne) ───────────────────
// mult : Mult de base. bonus(c, xs) → { mult, eclat(x) } selon les créatures posées.
// likes : ce que ce corail met en valeur (famille, 'sed' ou 'pose') ; sert à orienter
// le tirage du banc de départ et les offres.
export const CORALS = {
  cerveau: { name: 'Corail cerveau', emoji: '🧠', color: '#c77dff', mult: 2, rar: 'c', likes: ['mollusque'],
    text: '+1 Mult par Mollusque posé dessus.',
    multB: (xs) => xs.filter((x) => x.allFam || x.def.fam === 'mollusque').length },
  anemone: { name: 'Anémone', emoji: '🌺', color: '#f8961e', mult: 1, rar: 'c', likes: ['poisson'],
    text: 'Les Poissons posés dessus ont +3 Éclat.',
    eclatB: (x) => (x.allFam || x.def.fam === 'poisson' ? 3 : 0) },
  corne: { name: 'Corne-de-cerf', emoji: '🦌', color: '#f9c74f', mult: 2, rar: 'c', likes: ['crustace'],
    text: 'Les Crustacés posés dessus ont +4 Éclat.',
    eclatB: (x) => (x.allFam || x.def.fam === 'crustace' ? 4 : 0) },
  gorgone: { name: 'Gorgone', emoji: '🪭', color: '#f15b5b', mult: 1, rar: 'c',
    text: '+1 Mult par créature posée dessus.',
    multB: (xs) => xs.length },
  table: { name: 'Corail table', emoji: '🍄', color: '#4cc9f0', mult: 3, rar: 'c',
    text: 'Solide : Mult de base élevé.' },
  eponge: { name: 'Éponge', emoji: '🧽', color: '#90be6d', mult: 1, rar: 'c',
    text: '+1 Mult par famille différente posée dessus.',
    multB: (xs) => (xs.some((x) => x.allFam) ? 8 : new Set(xs.map((x) => x.def.fam)).size) },
  herbier: { name: 'Herbier', emoji: '🌿', color: '#52b788', mult: 2, rar: 'u', likes: ['sed'],
    text: 'Les Sédentaires posés dessus ont +4 Éclat.',
    eclatB: (x) => (x.def.sed ? 4 : 0) },
  bulle: { name: 'Corail bulle', emoji: '🫧', color: '#a2d2ff', mult: 2, rar: 'u',
    text: '+1 Remous à chaque plongée.' },
  feu: { name: 'Corail de feu', emoji: '🔥', color: '#ff5400', mult: 2, rar: 'r',
    text: 'Mult ×2 si sa couronne est complète.',
    xmultB: (full) => (full ? 2 : 1) },
  noir: { name: 'Corail noir', emoji: '🖤', color: '#6c6c80', mult: 5, rar: 'r', blocked: ['N'],
    text: 'Mult 5, mais seulement 3 emplacements (pas de Surface).' },
  lumineux: { name: 'Corail lumineux', emoji: '💡', color: '#ffe66d', mult: 2, rar: 'r', likes: ['pose'],
    text: 'Les effets de Pose des créatures posées dessus se déclenchent deux fois.' },
};

// Bonus de couronne (sur chaque corail).
export const CROWNS = {
  full:   { name: 'Couronne complète', icon: '💠', text: (n = 1) => `Tous les emplacements occupés : +${n} Mult.` },
  banc:   { name: 'Banc', icon: '🎯', text: (n = 2) => `Couronne complète d’une seule famille : Mult ×${n}.` },
  mosaic: { name: 'Mosaïque', icon: '🌈', text: (n = 1.5) => `Couronne complète, toutes familles différentes : Mult ×${String(n).replace('.', ',')}.` },
};

// ── Artefacts (passifs pour toute l'expédition) ─────────────
export const ARTIFACTS = {
  boussole:  { name: 'Boussole', emoji: '🧭', price: 12, text: '+1 Marée à chaque plongée.' },
  filet:     { name: 'Filet', emoji: '🥅', price: 10, text: '+1 créature en main.' },
  masque:    { name: 'Masque de plongée', emoji: '🤿', price: 7, text: '+1 Remous à chaque plongée.' },
  hamecon:   { name: 'Hameçon doré', emoji: '🪝', price: 8, text: 'Les Poissons ont +1 Éclat.' },
  nasse:     { name: 'Nasse', emoji: '🧺', price: 8, text: 'Les Crustacés ont +3 Éclat.' },
  perle:     { name: 'Perle noire', emoji: '⚫', price: 10, text: '+1 Mult sur chaque corail.' },
  conque:    { name: 'Conque', emoji: '📯', price: 9, text: 'Une Couronne complète donne +3 Mult au lieu de +1.' },
  ecaille:   { name: 'Écaille de sirène', emoji: '🧜', price: 11, text: 'Un Banc donne Mult ×3 au lieu de ×2.' },
  prisme:    { name: 'Prisme', emoji: '🔮', price: 10, text: 'Une Mosaïque donne Mult ×2 au lieu de ×1,5.' },
  ancre:     { name: 'Ancre', emoji: '⚓', price: 9, text: 'La première marée de chaque plongée compte double.' },
  sablier:   { name: 'Sablier', emoji: '⏳', price: 9, text: 'La dernière marée possible compte double.' },
  tresor:    { name: 'Carte au trésor', emoji: '🗺️', price: 7, text: '+4 perles à chaque plongée réussie.' },
  bourse:    { name: 'Bourse de nacre', emoji: '👝', price: 8, text: 'Après chaque plongée réussie : +1 perle par tranche de 5 perles (max +5).' },
  bouteille: { name: 'Bouteille d’oxygène', emoji: '🧯', price: 8, text: '+1 🫧 Oxygène maximum (et vous le récupérez).' },
  algues:    { name: 'Forêt d’algues', emoji: '🎋', price: 8, text: 'Les Sédentaires ont +3 Éclat.' },
  trident:   { name: 'Trident', emoji: '🔱', price: 10, text: '+1 Mult par créature améliorée ★ posée sur le corail.' },
  longuevue: { name: 'Longue-vue', emoji: '🔭', price: 6, text: 'Les récompenses proposent 4 créatures au lieu de 3.' },
  lampe:     { name: 'Lampe frontale', emoji: '🔦', price: 5, text: 'Vous voyez les 3 prochaines créatures de votre banc.' },
  trefle:    { name: 'Coquillage porte-bonheur', emoji: '🍀', price: 9, text: 'Une fois : si vous ratez une plongée de moins de 25 %, elle est réussie quand même. Puis il se brise.' },
};

// ── Conditions (élites et gardiens) ─────────────────────────
export const CONDITIONS = {
  kraken:   { name: 'Le Kraken', emoji: '🦑', text: 'À chaque marée, 2 emplacements libres sont bloqués par des tentacules.' },
  tempete:  { name: 'La Tempête', emoji: '🌪️', text: 'Après chaque marée, votre main est emportée (défaussée).' },
  leviathan:{ name: 'Le Léviathan', emoji: '🐉', text: 'Le corail qui marque le plus ne compte pas.' },
  glace:    { name: 'Courant glacé', emoji: '🧊', text: 'Aucun Remous, et 1 créature de moins en main.' },
  fantome:  { name: 'Banc fantôme', emoji: '👻', text: 'Aucun bonus de Couronne (complète, Banc, Mosaïque).' },
  pression: { name: 'Haute pression', emoji: '🌑', text: 'Chaque corail a −1 Mult (minimum 1).' },
  siphon:   { name: 'Le Siphon', emoji: '🌀', text: 'Une marée de moins.' },
};

// ── Zones de l'expédition ───────────────────────────────────
export const ZONES = [
  { name: 'Le Lagon', depth: '0–30 m', bg: ['#0a5c7a', '#032a40'] },
  { name: 'Le Tombant', depth: '30–200 m', bg: ['#08385e', '#021628'] },
  { name: 'Les Abysses', depth: '200–4000 m', bg: ['#1a1240', '#05030f'] },
];
export const ROWS_PER_ZONE = 6;

export const NODE_TYPES = {
  dive:  { name: 'Plongée', icon: '🐟', text: 'Une plongée classique.' },
  elite: { name: 'Plongée périlleuse', icon: '💀', text: 'Objectif élevé et une condition — récompense : un artefact.' },
  event: { name: 'Épave', icon: '❓', text: 'Une rencontre inattendue.' },
  shop:  { name: 'Comptoir', icon: '⚓', text: 'Achetez créatures, artefacts et coraux.' },
  rest:  { name: 'Nurserie', icon: '🌱', text: 'Reprenez votre souffle ou faites grandir votre récif.' },
  boss:  { name: 'Gardien', icon: '👑', text: 'Le gardien de la zone. Un échec met fin à l’expédition.' },
};

// ── Plongeurs (méta-progression) ────────────────────────────
// Coraux et banc de départ sont tirés au hasard : le plongeur apporte un artefact,
// des perles et un penchant (`lean`) qui oriente le tirage et les offres.
export const DIVERS = {
  exploratrice: {
    name: "L'Exploratrice", emoji: '🧭', text: 'Sans penchant : tout est possible. Masque de plongée.',
    artifacts: ['masque'], pearls: 4, lean: [],
    unlock: null,
  },
  biologiste: {
    name: 'Le Biologiste', emoji: '🔬', text: 'Penche vers les Poissons. Hameçon doré.',
    artifacts: ['hamecon'], pearls: 2, lean: ['poisson'],
    unlock: { zone: 2, text: 'Atteindre le Tombant' },
  },
  chasseuse: {
    name: "La Chasseuse d'épaves", emoji: '🏴‍☠️', text: 'Penche vers les Crustacés et Mollusques. Carte au trésor.',
    artifacts: ['tresor'], pearls: 10, lean: ['crustace', 'mollusque'],
    unlock: { boss: 1, text: 'Vaincre un gardien' },
  },
  naturaliste: {
    name: 'La Naturaliste', emoji: '🌿', text: 'Penche vers les Sédentaires et Échinodermes. Forêt d’algues.',
    artifacts: ['algues'], pearls: 4, lean: ['sed', 'echino'],
    unlock: { zone: 3, text: 'Atteindre les Abysses' },
  },
};

// ── Profondeurs (difficulté cumulative, débloquée en gagnant) ─
export const DEPTHS = [
  { name: 'Surface', text: 'Difficulté normale.' },
  { name: 'Profondeur 1', text: 'Objectifs +15 %.' },
  { name: 'Profondeur 2', text: '−1 Remous à chaque plongée.' },
  { name: 'Profondeur 3', text: '−1 🫧 Oxygène maximum.' },
  { name: 'Profondeur 4', text: 'Prix du Comptoir +25 %.' },
  { name: 'Profondeur 5', text: 'Les gardiens ont une condition supplémentaire.' },
];

// Règles de base.
export const BASE = {
  hand: 7, tides: 4, remous: 3, oxygen: 3, maxCorals: 5,
  // Départ : `startCorals` coraux et `startBag` créatures communes au hasard,
  // puis `draftRounds` choix de 1 créature parmi 3.
  startCorals: 2, startBag: 9, draftRounds: 3,
  // Objectif d'une plongée : zoneTargets[zone] × rowGrowth^rangée
  // (recalibré par simulation avec les écosystèmes, mutations et fusions)
  // (gros palier à chaque zone, car le gardien offre un nouveau corail).
  zoneTargets: [600, 1800, 5400], rowGrowth: 1.13,
  eliteX: 1.35, bossX: 1.35,
};
