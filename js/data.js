// ─────────────────────────────────────────────────────────────
//  Krazy Sea — données du jeu (coraux, créatures, trésors…)
// ─────────────────────────────────────────────────────────────

// Familles de coraux. Chaque carte créature porte aussi la couleur
// d'une famille : la poser sur un corail de la même famille déclenche
// une « Symbiose » (piochez 1 carte).
export const CORALS = {
  cerveau: {
    name: 'Corail cerveau', color: '#9b5de5', cost: 1,
    text: "1 pt par Corail cerveau du récif (max 5).",
    score: (ctx) => Math.min(5, ctx.countCoral('cerveau')),
  },
  corne: {
    name: 'Corne-de-cerf', color: '#f9c74f', cost: 0,
    text: "Effet : piochez 1 carte. 1 pt.",
    effects: [{ type: 'draw', n: 1 }],
    score: () => 1,
  },
  gorgone: {
    name: 'Gorgone', color: '#f15b5b', cost: 1,
    text: "1 pt par créature posée sur cette Gorgone.",
    score: (ctx, self) => ctx.creaturesOn(self.coral),
  },
  anemone: {
    name: 'Anémone', color: '#f8961e', cost: 1,
    text: "2 pts. Les Poissons-clowns l'adorent.",
    score: () => 2,
  },
  table: {
    name: 'Corail table', color: '#4cc9f0', cost: 2,
    text: "5 pts.",
    score: () => 5,
  },
  eponge: {
    name: 'Éponge', color: '#90be6d', cost: 1,
    text: "2 pts par famille de corail différente du récif.",
    score: (ctx) => 2 * ctx.coralFamilies(),
  },
  noir: {
    name: 'Corail noir', color: '#3a3a4a', cost: 2, rare: true,
    text: "1 pt par corail du récif. Aucune Symbiose possible.",
    score: (ctx) => ctx.corals.length,
  },
};

export const FAMILIES = ['cerveau', 'corne', 'gorgone', 'anemone', 'table', 'eponge'];

export const POS_LABEL = { top: 'Surface', bottom: 'Fond', flank: 'Flanc' };
export const POS_ICON = { top: '⬆', bottom: '⬇', flank: '⬌' };

// Créatures (moitiés de cartes).
// pos : 'top' (Surface), 'bottom' (Fond) ou 'flank' (gauche/droite).
export const SPECIES = {
  // ── Flancs ──
  clown: { name: 'Poisson-clown', emoji: '🐠', pos: 'flank', tags: ['Poisson'], cost: 1,
    text: "5 pts s'il est sur une Anémone, sinon 1 pt.",
    score: (ctx, s) => (s.coral.type === 'anemone' ? 5 : 1) },
  globe: { name: 'Poisson-globe', emoji: '🐡', pos: 'flank', tags: ['Poisson'], cost: 1,
    text: "1 pt par créature sur son corail (lui compris).",
    score: (ctx, s) => ctx.creaturesOn(s.coral) },
  sardine: { name: 'Sardines', emoji: '🐟', pos: 'flank', tags: ['Poisson'], cost: 0, stack: true,
    text: "Empilable. 1 pt par Sardines du récif (max 6).",
    score: (ctx) => Math.min(6, ctx.countSp('sardine')) },
  murene: { name: 'Murène', emoji: '🐍', pos: 'flank', tags: ['Poisson'], cost: 2,
    text: "2 pts par Crustacé du récif.",
    score: (ctx) => 2 * ctx.countTag('Crustacé') },
  poulpe: { name: 'Poulpe', emoji: '🐙', pos: 'flank', tags: ['Mollusque'], cost: 1,
    text: "Effet : piochez 2 cartes.",
    effects: [{ type: 'draw', n: 2 }], score: () => 0 },
  calmar: { name: 'Calmar', emoji: '🦑', pos: 'flank', tags: ['Mollusque'], cost: 1,
    text: "Effet : action supplémentaire. 1 pt.",
    effects: [{ type: 'extra' }], score: () => 1 },
  crevette: { name: 'Crevette', emoji: '🦐', pos: 'flank', tags: ['Crustacé'], cost: 0, stack: true,
    text: "Empilable. 1 pt + 1 pt par Poisson sur son corail.",
    score: (ctx, s) => 1 + ctx.tagOn(s.coral, 'Poisson') },
  nudi: { name: 'Nudibranche', emoji: '🐌', pos: 'flank', tags: ['Mollusque'], cost: 1,
    text: "2 pts par Mollusque du récif.",
    score: (ctx) => 2 * ctx.countTag('Mollusque') },
  lune: { name: 'Poisson-lune', emoji: '🌕', pos: 'flank', tags: ['Poisson'], cost: 2, rare: true,
    text: "1 pt par carte en main en fin de plongée.",
    score: (ctx) => ctx.hand.length },
  espadon: { name: 'Espadon', emoji: '🗡️', pos: 'flank', tags: ['Poisson'], cost: 1, rare: true,
    text: "Effet : piochez 1 carte + action supplémentaire.",
    effects: [{ type: 'draw', n: 1 }, { type: 'extra' }], score: () => 0 },
  anguille: { name: 'Anguille électrique', emoji: '⚡', pos: 'flank', tags: ['Poisson'], cost: 1, rare: true,
    text: "1 pt par créature de Flanc du récif.",
    score: (ctx) => ctx.countPos('flank') },

  // ── Surface ──
  tortue: { name: 'Tortue', emoji: '🐢', pos: 'top', tags: ['Reptile'], cost: 2,
    text: "6 pts.", score: () => 6 },
  meduse: { name: 'Méduse', emoji: '🪼', pos: 'top', tags: ['Cnidaire'], cost: 0,
    text: "Effet : prenez 1 carte du Courant. 1 pt.",
    effects: [{ type: 'takeCourant', n: 1 }], score: () => 1 },
  dauphin: { name: 'Dauphin', emoji: '🐬', pos: 'top', tags: ['Mammifère'], cost: 2,
    text: "1 pt par Poisson du récif.",
    score: (ctx) => ctx.countTag('Poisson') },
  baleine: { name: 'Baleine', emoji: '🐋', pos: 'top', tags: ['Mammifère'], cost: 3,
    text: "11 pts.", score: () => 11 },
  requin: { name: 'Requin', emoji: '🦈', pos: 'top', tags: ['Poisson'], cost: 2,
    text: "8 pts si le récif compte 4 Poissons ou plus, sinon 2.",
    score: (ctx) => (ctx.countTag('Poisson') >= 4 ? 8 : 2) },
  phoque: { name: 'Phoque', emoji: '🦭', pos: 'top', tags: ['Mammifère'], cost: 1,
    text: "Effet : piochez 1 carte. 2 pts par Mammifère du récif.",
    effects: [{ type: 'draw', n: 1 }], score: (ctx) => 2 * ctx.countTag('Mammifère') },
  manchot: { name: 'Manchot', emoji: '🐧', pos: 'top', tags: ['Oiseau'], cost: 1,
    text: "Effet : prenez 2 cartes du Courant. 1 pt.",
    effects: [{ type: 'takeCourant', n: 2 }], score: () => 1 },
  manta: { name: 'Raie manta', emoji: '🪁', pos: 'top', tags: ['Poisson'], cost: 1, rare: true,
    text: "2 pts par créature de Surface du récif.",
    score: (ctx) => 2 * ctx.countPos('top') },
  orque: { name: 'Orque', emoji: '🐳', pos: 'top', tags: ['Mammifère'], cost: 2, rare: true,
    text: "3 pts par Mammifère du récif.",
    score: (ctx) => 3 * ctx.countTag('Mammifère') },
  fou: { name: 'Fou de Bassan', emoji: '🐦', pos: 'top', tags: ['Oiseau'], cost: 1, rare: true,
    text: "Effet : action supplémentaire. 2 pts.",
    effects: [{ type: 'extra' }], score: () => 2 },

  // ── Fond ──
  crabe: { name: 'Crabe', emoji: '🦀', pos: 'bottom', tags: ['Crustacé'], cost: 1,
    text: "1 pt par Crustacé du récif.",
    score: (ctx) => ctx.countTag('Crustacé') },
  homard: { name: 'Homard', emoji: '🦞', pos: 'bottom', tags: ['Crustacé'], cost: 2,
    text: "5 pts.", score: () => 5 },
  etoile: { name: 'Étoile de mer', emoji: '⭐', pos: 'bottom', tags: ['Échinoderme'], cost: 1,
    text: "5 pts si son corail est complet (4 côtés occupés), sinon 1.",
    score: (ctx, s) => (ctx.isFull(s.coral) ? 5 : 1) },
  oursin: { name: 'Oursin', emoji: '🌰', pos: 'bottom', tags: ['Échinoderme'], cost: 0,
    text: "2 pts par Corail cerveau du récif.",
    score: (ctx) => 2 * ctx.countCoral('cerveau') },
  huitre: { name: 'Huître', emoji: '🦪', pos: 'bottom', tags: ['Mollusque'], cost: 1,
    text: "Effet : mettez jusqu'à 2 cartes de votre main dans l'Épave. 1 pt.",
    effects: [{ type: 'epaveHand', n: 2 }], score: () => 1 },
  bernard: { name: "Bernard-l'ermite", emoji: '🐚', pos: 'bottom', tags: ['Crustacé'], cost: 1,
    text: "1 pt par carte dans l'Épave (max 10).",
    score: (ctx) => Math.min(10, ctx.epave.length) },
  holo: { name: 'Holothurie', emoji: '🥒', pos: 'bottom', tags: ['Échinoderme'], cost: 0,
    text: "Effet : mettez jusqu'à 2 cartes du Courant dans l'Épave.",
    effects: [{ type: 'epaveCourant', n: 2 }], score: () => 0 },
  tresor: { name: 'Coffre englouti', emoji: '💰', pos: 'bottom', tags: ['Objet'], cost: 2, rare: true,
    text: "Effet : mettez jusqu'à 4 cartes de votre main dans l'Épave.",
    effects: [{ type: 'epaveHand', n: 4 }], score: () => 0 },
  langouste: { name: 'Langouste royale', emoji: '👑', pos: 'bottom', tags: ['Crustacé'], cost: 3, rare: true,
    text: "3 pts par Crustacé du récif.",
    score: (ctx) => 3 * ctx.countTag('Crustacé') },
};

// Gabarits de cartes. `c` = corail, `s` = carte à deux créatures.
const C = (coral) => ({ kind: 'coral', coral });
const S = (a, b) => ({ kind: 'species', halves: [a, b] });

export const STARTER = [
  ...rep(C('cerveau'), 3), ...rep(C('corne'), 3), ...rep(C('gorgone'), 3),
  ...rep(C('anemone'), 2), ...rep(C('table'), 2), ...rep(C('eponge'), 2),
  // Surface / Fond
  ...rep(S('tortue', 'crabe'), 2), ...rep(S('meduse', 'etoile'), 2),
  S('dauphin', 'homard'), S('baleine', 'oursin'), S('requin', 'huitre'),
  ...rep(S('phoque', 'bernard'), 2), S('manchot', 'holo'), S('meduse', 'crabe'),
  S('tortue', 'oursin'),
  // Flanc / Flanc
  ...rep(S('clown', 'poulpe'), 2), ...rep(S('sardine', 'murene'), 2),
  ...rep(S('globe', 'calmar'), 2), ...rep(S('crevette', 'nudi'), 2),
  ...rep(S('sardine', 'crevette'), 2), S('clown', 'globe'), S('poulpe', 'nudi'),
];

// Cartes pouvant apparaître en récompense / boutique.
export const POOL_COMMON = [
  C('cerveau'), C('corne'), C('gorgone'), C('anemone'), C('table'), C('eponge'),
  S('tortue', 'crabe'), S('meduse', 'etoile'), S('dauphin', 'homard'),
  S('baleine', 'oursin'), S('requin', 'huitre'), S('phoque', 'bernard'),
  S('manchot', 'holo'), S('clown', 'poulpe'), S('sardine', 'murene'),
  S('globe', 'calmar'), S('crevette', 'nudi'), S('sardine', 'crevette'),
];
export const POOL_RARE = [
  C('noir'),
  S('manta', 'tresor'), S('orque', 'langouste'), S('fou', 'etoile'),
  S('baleine', 'langouste'), S('manta', 'holo'), S('orque', 'huitre'),
  S('lune', 'espadon'), S('anguille', 'poulpe'), S('espadon', 'clown'),
  S('anguille', 'sardine'), S('lune', 'nudi'), S('fou', 'bernard'),
];

// Trésors : bonus passifs pour toute l'expédition.
export const TREASURES = {
  filet:     { name: 'Filet de pêche', emoji: '🥅', price: 6, text: "Commencez chaque plongée avec 2 cartes de plus en main." },
  hamecon:   { name: 'Hameçon doré', emoji: '🪝', price: 8, text: "Chaque Poisson rapporte +1 pt." },
  nasse:     { name: 'Nasse', emoji: '🧺', price: 8, text: "Chaque Crustacé et Mollusque rapporte +1 pt." },
  conque:    { name: 'Conque', emoji: '📯', price: 8, text: "Chaque corail rapporte +1 pt." },
  perle:     { name: 'Perle noire', emoji: '⚫', price: 7, text: "+6 pts à la fin de chaque plongée." },
  ancre:     { name: 'Ancre rouillée', emoji: '⚓', price: 10, text: "Une Marée de plus est nécessaire pour terminer la plongée." },
  algues:    { name: 'Forêt d’algues', emoji: '🌿', price: 5, text: "Le Courant déborde avec 3 cartes de plus." },
  hippocampe:{ name: 'Hippocampe d’or', emoji: '🏅', price: 7, text: "Chaque Symbiose fait piocher 2 cartes au lieu d'1." },
  carte:     { name: 'Carte au trésor', emoji: '🗺️', price: 7, text: "Chaque carte de l'Épave rapporte 2 pts au lieu d'1." },
  bouteille: { name: 'Bouteille d’air', emoji: '🫧', price: 6, text: "Chaque plongée commence avec un Corail cerveau déjà en place." },
  sac:       { name: 'Sac étanche', emoji: '🎒', price: 4, text: "Taille de main maximale +3." },
  longuevue: { name: 'Longue-vue', emoji: '🔭', price: 10, text: "L'action Piocher permet de prendre 3 cartes au lieu de 2." },
  couronne:  { name: 'Couronne de corail', emoji: '🔱', price: 9, text: "Les coraux coûtent 1 carte de moins." },
};

// Conditions de plongée (malus).
export const MODIFIERS = {
  courant:  { name: 'Courant fort', emoji: '🌪️', text: "Le Courant déborde avec 3 cartes de moins.", apply: (d) => { d.courantMax -= 3; } },
  troubles: { name: 'Eaux troubles', emoji: '🌫️', text: "Taille de main maximale −3.", apply: (d) => { d.handMax -= 3; } },
  haute:    { name: 'Marée haute', emoji: '🌊', text: "2 cartes rejoignent le Courant à chaque fin de tour.", apply: (d) => { d.reveal = 2; } },
  fragile:  { name: 'Récif fragile', emoji: '💔', text: "Les coraux coûtent 1 carte de plus.", apply: (d) => { d.coralCostMod += 1; } },
  froid:    { name: 'Eaux froides', emoji: '🧊', text: "Les créatures de Surface coûtent 1 carte de plus.", apply: (d) => { d.topCostMod += 1; } },
  precoce:  { name: 'Marées précoces', emoji: '⏳', text: "Les Marées sont cachées dans la deuxième moitié de la pioche.", apply: (d) => { d.tideZone = 0.5; } },
};

// Les six plongées de l'expédition.
export const DIVES = [
  { name: 'Lagon turquoise', target: 28, mods: 0 },
  { name: 'Tombant aux gorgones', target: 36, mods: 1 },
  { name: 'Jardin de corail', target: 45, mods: 1 },
  { name: 'Passe des requins', target: 54, mods: 1 },
  { name: 'Grotte bleue', target: 64, mods: 2 },
  { name: 'Le Grand Récif', target: 76, mods: 2, boss: true },
];

// Plongeurs de départ (méta-progression).
export const DIVERS = {
  exploratrice: { name: "L'Exploratrice", emoji: '🧭', text: "Commence avec le Filet de pêche.",
    treasures: ['filet'], extra: [], unlock: null },
  biologiste: { name: 'Le Biologiste', emoji: '🔬', text: "Commence avec l'Hameçon doré et 2 Sardines/Crevette en plus.",
    treasures: ['hamecon'], extra: [S('sardine', 'crevette'), S('sardine', 'crevette')],
    unlock: { bestDive: 3, text: 'Atteindre la plongée 3' } },
  chasseur: { name: "La Chasseuse d'épaves", emoji: '🏴‍☠️', text: "Commence avec la Carte au trésor et 2 Coffres engloutis.",
    treasures: ['carte'], extra: [S('manta', 'tresor'), S('fou', 'tresor')],
    unlock: { bestDive: 5, text: 'Atteindre la plongée 5' } },
};

function rep(x, n) { return Array.from({ length: n }, () => ({ ...x })); }
