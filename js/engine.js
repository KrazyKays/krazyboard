// ─────────────────────────────────────────────────────────────
//  Krazy Sea — moteur de jeu (sans affichage, entièrement déterministe
//  à partir de la graine de l'expédition)
// ─────────────────────────────────────────────────────────────
import {
  SLOTS, RING, OPPOSITE, CREATURES, CORALS, ARTIFACTS, CONDITIONS, ZONES,
  ROWS_PER_ZONE, DIVERS, BASE, RARITY, MUTATIONS, ECOSYSTEMS, CROWNS,
} from './data.js';

// ── Aléatoire à graine (mulberry32), état stocké dans l'expédition ──
export function rnd(run) {
  let t = (run.rs = (run.rs + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (run, n) => Math.floor(rnd(run) * n);
const pick = (run, a) => a[ri(run, a.length)];
export function shuffle(run, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(run, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weighted(run, entries) { // [[valeur, poids], …]
  const tot = entries.reduce((s, e) => s + e[1], 0);
  let r = rnd(run) * tot;
  for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
  return entries[entries.length - 1][0];
}
export function seedFrom(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const has = (run, a) => run.artifacts.includes(a);
export const SAVE_VERSION = 3;
const nid = (run) => run.nextId++;
export const inst = (run, id) => run.bag.find((c) => c.id === id);
export const defOf = (run, id) => CREATURES[inst(run, id).t];

// ── Expédition ──────────────────────────────────────────────
// `kit` ({ corals, bag }) impose le départ et saute le draft (tutoriel).
export function newRun({ diverId = 'exploratrice', depth = 0, seed, daily = false, kit = null } = {}) {
  const diver = DIVERS[diverId];
  const s = seed ?? ((Math.random() * 2 ** 32) >>> 0);
  const run = {
    v: SAVE_VERSION, seed: s, rs: s, nextId: 1, diverId, depth, daily,
    bag: [], corals: [], artifacts: [...diver.artifacts],
    pearls: diver.pearls, oxygen: 0, oxygenMax: BASE.oxygen,
    zone: 0, map: null, pos: null, phase: 'map',
    removeCost: 5, bosses: 0, dives: 0, log: [], toast: null,
    dive: null, reward: null, shop: null, event: null, pending: null, end: null, draft: null,
  };
  if (depth >= 3) run.oxygenMax -= 1;
  if (has(run, 'bouteille')) run.oxygenMax += 1;
  run.oxygen = run.oxygenMax;
  for (const t of kit ? kit.corals : rollCorals(run)) addCoral(run, t);
  for (const t of kit ? kit.bag : rollBag(run)) addCreature(run, t);
  run.map = genMap(run);
  if (!kit) { run.phase = 'draft'; run.draft = { picks: [], options: [] }; run.draft.options = draftOptions(run); }
  return run;
}

// ── Départ aléatoire ────────────────────────────────────────
// Ce qu'un corail ou un plongeur « aime » : une famille, 'sed' ou 'pose'.
function matches(def, like) {
  if (like === 'sed') return !!def.sed;
  if (like === 'pose') return !!def.place;
  return def.fam === like || !!def.allFam;
}
const coralLikes = (run, def) => run.corals.some((c) => (CORALS[c.t].likes || []).some((l) => matches(def, l)));
const diverLikes = (run, def) => DIVERS[run.diverId].lean.some((l) => matches(def, l));
const offerable = (run, t) => !CREATURES[t].parasite
  && (!CREATURES[t].needsParasite || run.bag.some((c) => CREATURES[c.t].parasite));

function rollCorals(run) {
  const out = [];
  while (out.length < BASE.startCorals) {
    const r = weighted(run, [['c', 70], ['u', 24], ['r', 6]]);
    const pool = Object.keys(CORALS).filter((k) => CORALS[k].rar === r && !out.includes(k));
    if (pool.length) out.push(pick(run, pool));
  }
  return out;
}

// Banc de départ : des créatures communes, au moins 2 sources de Mult et 1 effet
// de pioche pour rester jouable, le reste penche vers les coraux et le plongeur.
function rollBag(run) {
  const commons = Object.keys(CREATURES).filter((k) => CREATURES[k].rar === 'c');
  const out = [];
  const allowed = (t) => {
    const def = CREATURES[t];
    const n = (f) => out.filter((k) => f(CREATURES[k])).length;
    if (out.filter((k) => k === t).length >= 3) return false;
    if (def.ephem && n((d) => d.ephem) >= 1) return false;
    if (def.evolve && n((d) => d.evolve) >= 1) return false;
    return true;
  };
  const draw = (filter) => {
    const pool = commons.filter((t) => filter(CREATURES[t]) && allowed(t));
    out.push(weighted(run, pool.map((t) => [t, 1 + (coralLikes(run, CREATURES[t]) ? 2 : 0) + (diverLikes(run, CREATURES[t]) ? 2 : 0)])));
  };
  draw((d) => d.mult && !d.ephem);
  draw((d) => d.mult && !d.ephem);
  draw((d) => d.place);
  while (out.length < BASE.startBag) draw(() => true);
  return out;
}

// Trois tours de draft : d'abord une orientation, puis de quoi la confirmer,
// enfin une pièce maîtresse. Une option reste toujours libre pour bifurquer.
export function draftOptions(run) {
  const round = run.draft.picks.length;
  const all = Object.keys(CREATURES).filter((k) => offerable(run, k));
  const top = dominantFam(run);
  const out = [];
  const take = (filter) => {
    let pool = all.filter((t) => !out.includes(t) && filter(CREATURES[t]));
    if (!pool.length) pool = all.filter((t) => !out.includes(t) && CREATURES[t].rar !== 'r');
    out.push(pick(run, pool));
  };
  const newFam = (d) => !out.some((t) => CREATURES[t].fam === d.fam);
  if (round === 0) {
    take((d) => d.rar === 'u' && (coralLikes(run, d) || diverLikes(run, d)));
    take((d) => d.rar === 'u' && newFam(d));
    take((d) => d.rar !== 'r' && newFam(d));
  } else if (round === 1) {
    take((d) => d.rar === 'u' && d.fam === top);
    take((d) => d.rar === 'u' && coralLikes(run, d));
    take((d) => d.rar !== 'r');
  } else {
    take((d) => d.rar === 'r' && (coralLikes(run, d) || d.fam === top));
    take((d) => d.rar === 'u' && d.fam === top);
    take((d) => d.rar !== 'c');
  }
  return shuffle(run, out);
}

export function draftChoose(run, t) {
  const dr = run.draft;
  if (run.phase !== 'draft' || !dr.options.includes(t)) return false;
  addCreature(run, t);
  dr.picks.push(t);
  if (dr.picks.length >= BASE.draftRounds) {
    run.draft = null;
    run.phase = 'map';
    run.toast = 'Votre banc est prêt : bonne plongée !';
  } else dr.options = draftOptions(run);
  return true;
}

// ── Écosystèmes : composition du banc ───────────────────────
export function bagFam(run, f) {
  return run.bag.filter((c) => {
    const def = CREATURES[c.t];
    return !def.parasite && (def.fam === f || def.allFam || c.mut === 'polyvalent');
  }).length;
}
export function ecoStatus(run) {
  return Object.entries(ECOSYSTEMS).map(([f, e]) => {
    const n = bagFam(run, f);
    return { f, eco: e, n, tier: e.tiers.filter((t) => n >= t.n).pop() || null, next: e.tiers.find((t) => n < t.n) || null };
  });
}
function dominantFam(run) {
  return Object.keys(ECOSYSTEMS).map((f) => [f, bagFam(run, f)]).sort((a, b) => b[1] - a[1])[0][0];
}
const ecoSum = (run, key) => ecoStatus(run).reduce((a, e) => a + ((e.tier && e.tier[key]) || 0), 0);

// Ce qu'une créature proposée apporterait : affiché sous la carte.
export function offerHints(run, t) {
  const def = CREATURES[t];
  const hints = [];
  for (const c of run.corals) {
    const k = CORALS[c.t];
    if ((k.likes || []).some((l) => matches(def, l)) && !hints.some((h) => h.text === k.name)) hints.push({ icon: k.emoji, text: k.name });
  }
  const st = ecoStatus(run).find((e) => e.f === def.fam);
  if (st && st.next) {
    hints.push(st.n + 1 >= st.next.n
      ? { icon: '🌿', text: `${st.eco.name} débloqué !`, strong: true }
      : { icon: '🌿', text: `${st.eco.name} ${st.n + 1}/${st.next.n}` });
  }
  return hints;
}

// Expédition du tutoriel : graine fixe et main préparée pour la démonstration.
export function tutorialRun() {
  const run = newRun({ seed: 2024, kit: {
    corals: ['cerveau', 'gorgone'],
    bag: ['sardine', 'sardine', 'sardine', 'crabe', 'crevette', 'meduse', 'meduse', 'poulpe', 'poulpe', 'tortue', 'globe', 'loutre'],
  } });
  const first = run.map.rows[0].find(Boolean);
  enterNode(run, first.row, first.lane);
  const d = run.dive;
  const pool = [...d.hand, ...d.draw];
  const take = (t) => pool.splice(pool.findIndex((id) => inst(run, id).t === t), 1)[0];
  d.hand = ['sardine', 'crevette', 'meduse', 'sardine', 'tortue', 'crabe', 'loutre'].map(take);
  d.draw = pool;
  return run;
}

export function addCreature(run, t, extra = {}) {
  const c = { id: nid(run), t, bonus: 0, mbonus: 0, star: 0, xp: 0, mut: null, ...extra };
  run.bag.push(c);
  return c;
}
export function addCoral(run, t) {
  const c = { id: nid(run), t, lvl: 0 };
  run.corals.push(c);
  return c;
}
export function addArtifact(run, a) {
  if (has(run, a)) return;
  run.artifacts.push(a);
  if (a === 'bouteille') { run.oxygenMax += 1; run.oxygen = Math.min(run.oxygenMax, run.oxygen + 1); }
}
export const price = (run, p) => (run.depth >= 4 ? Math.ceil(p * 1.25) : p);

// ── Carte de la zone ────────────────────────────────────────
// 6 rangées de 3 couloirs, puis le gardien. Chaque nœud mène aux nœuds
// des couloirs voisins de la rangée suivante.
const ROW_TYPES = [
  [['dive', 1]],
  [['dive', 3], ['event', 2]],
  [['dive', 3], ['event', 2], ['shop', 2], ['elite', 1]],
  [['dive', 2], ['elite', 2], ['shop', 2], ['event', 1]],
  [['dive', 3], ['elite', 2], ['event', 2]],
  [['rest', 1]],
];
const COND_KEYS = Object.keys(CONDITIONS);
// Le Léviathan et le Siphon sont trop punitifs avec seulement 2 coraux.
const condPool = (run) => COND_KEYS.filter((k) => run.zone > 0 || !['leviathan', 'siphon'].includes(k));

export function genMap(run) {
  const rows = [];
  for (let r = 0; r < ROWS_PER_ZONE; r++) {
    const lanes = rnd(run) < 0.45 ? [0, 1, 2] : shuffle(run, [0, 1, 2]).slice(0, 2).sort();
    const row = [null, null, null];
    for (const l of lanes) {
      // Pas deux Comptoirs ni deux élites sur la même rangée.
      const used = row.filter(Boolean).map((n) => n.type);
      const opts = ROW_TYPES[r].filter(([t]) => !(['shop', 'elite'].includes(t) && used.includes(t)));
      const type = weighted(run, opts.length ? opts : ROW_TYPES[r]);
      row[l] = { row: r, lane: l, type, done: false };
      if (type === 'elite') row[l].cond = [pick(run, condPool(run))];
    }
    rows.push(row);
  }
  // Au moins un Comptoir par zone.
  if (!rows[2].concat(rows[3]).some((n) => n && n.type === 'shop')) {
    const cand = rows[2].filter(Boolean);
    const n = pick(run, cand); n.type = 'shop'; delete n.cond;
  }
  // Liens
  for (let r = 0; r < ROWS_PER_ZONE - 1; r++) {
    for (const n of rows[r].filter(Boolean)) {
      n.links = rows[r + 1].filter((m) => m && Math.abs(m.lane - n.lane) <= 1).map((m) => m.lane);
    }
  }
  for (const n of rows[ROWS_PER_ZONE - 1].filter(Boolean)) n.links = [1];
  const conds = shuffle(run, condPool(run));
  const nb = (run.zone === 2 ? 2 : 1) + (run.depth >= 5 ? 1 : 0);
  const boss = { row: ROWS_PER_ZONE, lane: 1, type: 'boss', done: false, cond: conds.slice(0, nb), links: [] };
  rows.push([null, boss, null]);
  return { zone: run.zone, rows };
}

export function nodeAt(run, row, lane) { return run.map.rows[row]?.[lane] || null; }
export function availableNodes(run) {
  if (run.phase !== 'map') return [];
  if (!run.pos) return run.map.rows[0].filter(Boolean);
  const cur = nodeAt(run, run.pos.row, run.pos.lane);
  return cur.links.map((l) => nodeAt(run, cur.row + 1, l)).filter(Boolean);
}

export function enterNode(run, row, lane) {
  const node = nodeAt(run, row, lane);
  if (!node || !availableNodes(run).includes(node)) return false;
  run.pos = { row, lane };
  node.done = true;
  run.toast = null;
  if (node.type === 'dive' || node.type === 'elite' || node.type === 'boss') {
    run.dive = startDive(run, node);
    run.phase = 'dive';
  } else if (node.type === 'shop') {
    run.shop = makeShop(run);
    run.phase = 'shop';
  } else if (node.type === 'event') {
    run.event = { id: pickEvent(run), msg: null };
    run.phase = 'event';
  } else if (node.type === 'rest') {
    run.phase = 'rest';
  }
  return true;
}

// Retour sur la carte (ou zone suivante après un gardien).
export function backToMap(run) {
  run.dive = null; run.shop = null; run.event = null; run.reward = null; run.pending = null;
  const cur = run.pos && nodeAt(run, run.pos.row, run.pos.lane);
  if (cur && cur.type === 'boss') {
    if (run.zone >= ZONES.length - 1) { endRun(run, true); return; }
    run.zone++;
    run.pos = null;
    run.map = genMap(run);
    run.toast = `Vous descendez vers ${ZONES[run.zone].name}…`;
  }
  run.phase = 'map';
}

function endRun(run, win) {
  run.phase = 'end';
  run.end = { win, zone: run.zone, row: run.pos ? run.pos.row : 0 };
}

// ── Plongée ─────────────────────────────────────────────────
export function stepIndex(run, node) { return run.zone * (ROWS_PER_ZONE + 1) + node.row; }

export function targetFor(run, node) {
  let t = BASE.zoneTargets[run.zone] * BASE.rowGrowth ** node.row;
  if (node.type === 'elite') t *= BASE.eliteX;
  if (node.type === 'boss') t *= BASE.bossX;
  if (run.depth >= 1) t *= 1.15;
  const mag = 10 ** Math.max(1, Math.floor(Math.log10(t)) - 1);
  return Math.round(t / mag) * mag;
}

export function startDive(run, node) {
  const cond = node.cond ? [...node.cond] : [];
  const c = (k) => cond.includes(k);
  const d = {
    type: node.type, cond, target: targetFor(run, node),
    score: 0, tide: 1,
    tidesMax: BASE.tides + (has(run, 'boussole') ? 1 : 0) - (c('siphon') ? 1 : 0),
    remous: c('glace') ? 0 : Math.max(0, BASE.remous + (has(run, 'masque') ? 1 : 0) + ecoSum(run, 'remous')
      + run.corals.filter((k) => k.t === 'bulle').length - (run.depth >= 2 ? 1 : 0)),
    handSize: BASE.hand + (has(run, 'filet') ? 1 : 0) + ecoSum(run, 'hand') - (c('glace') ? 1 : 0),
    draw: shuffle(run, run.bag.map((x) => x.id)), discard: [], hand: [], exhausted: [],
    board: run.corals.map(() => ({ N: null, E: null, S: null, W: null })),
    blocked: [], phase: 'place', last: null, ended: null, history: [],
  };
  run.dive = d;
  drawTo(run, d.handSize);
  krakenBlock(run);
  return d;
}

export function hasCond(run, k) { return !!run.dive && run.dive.cond.includes(k); }

function drawOne(run) {
  const d = run.dive;
  if (!d.draw.length) {
    if (!d.discard.length) return null;
    d.draw = shuffle(run, d.discard);
    d.discard = [];
  }
  const id = d.draw.shift();
  d.hand.push(id);
  return id;
}
function drawTo(run, n) { while (run.dive.hand.length < n && drawOne(run) !== null); }
function drawN(run, n) { for (let i = 0; i < n; i++) if (drawOne(run) === null) break; }

export function isBlocked(run, ci, slot) {
  const k = CORALS[run.corals[ci].t];
  if (k.blocked && k.blocked.includes(slot)) return true;
  return run.dive.blocked.includes(`${ci}:${slot}`);
}
function openSlots(run, ci) { return SLOTS.filter((s) => !isBlocked(run, ci, s)); }

function krakenBlock(run) {
  const d = run.dive;
  d.blocked = [];
  if (!hasCond(run, 'kraken')) return;
  const free = [];
  d.board.forEach((b, ci) => SLOTS.forEach((s) => { if (!b[s] && !isBlocked(run, ci, s)) free.push(`${ci}:${s}`); }));
  d.blocked = shuffle(run, free).slice(0, 2);
}

export function canPlace(run, id, ci, slot) {
  const d = run.dive;
  return d.phase === 'place' && d.hand.includes(id) && !!d.board[ci] && !d.board[ci][slot] && !isBlocked(run, ci, slot);
}

// Pose une créature de la main. Retourne les effets déclenchés (pour l'affichage).
export function place(run, id, ci, slot) {
  if (!canPlace(run, id, ci, slot)) return null;
  const d = run.dive;
  const def = defOf(run, id);
  const fx = { ...def.place };
  if (inst(run, id).mut === 'veloce') fx.draw = (fx.draw || 0) + 1;
  const hasFx = Object.keys(fx).length > 0;
  d.hand.splice(d.hand.indexOf(id), 1);
  d.board[ci][slot] = { id, lock: hasFx };
  const notes = [];
  if (hasFx) {
    const times = run.corals[ci].t === 'lumineux' ? 2 : 1;
    for (let i = 0; i < times; i++) {
      if (fx.draw) { drawN(run, fx.draw); notes.push(`${def.emoji} +${fx.draw} créature${fx.draw > 1 ? 's' : ''}`); }
      if (fx.remous) { d.remous += fx.remous; notes.push(`${def.emoji} +1 Remous`); }
      if (fx.tutor) {
        const best = [...d.draw].sort((a, b) => (defOf(run, b).pts + inst(run, b).bonus) - (defOf(run, a).pts + inst(run, a).bonus))[0];
        if (best) { d.draw.splice(d.draw.indexOf(best), 1); d.hand.push(best); notes.push(`${def.emoji} ${defOf(run, best).name} rejoint la main`); }
      }
      if (fx.cycle) {
        const n = d.hand.length + 1;
        d.discard.push(...d.hand);
        d.hand = [];
        drawN(run, n);
        notes.push(`${def.emoji} Nouvelle main : ${d.hand.length} créature${d.hand.length > 1 ? 's' : ''}`);
      }
    }
  }
  return notes;
}

export function unplace(run, ci, slot) {
  const d = run.dive;
  const cell = d.phase === 'place' && d.board[ci] && d.board[ci][slot];
  if (!cell || cell.lock) return false;
  d.board[ci][slot] = null;
  d.hand.push(cell.id);
  return cell.id;
}

export function doRemous(run, ids) {
  const d = run.dive;
  if (d.phase !== 'place' || d.remous <= 0 || !ids.length) return false;
  if (!ids.every((id) => d.hand.includes(id))) return false;
  d.hand = d.hand.filter((id) => !ids.includes(id));
  d.discard.push(...ids);
  d.remous--;
  drawN(run, ids.length);
  return true;
}

export function boardCount(run) {
  return run.dive.board.reduce((a, b) => a + SLOTS.filter((s) => b[s]).length, 0);
}

// ── Calcul d'une marée ──────────────────────────────────────
// Pour chaque corail : Éclat (somme des créatures) × Mult (corail + créatures
// + couronne) × multiplicateurs.
export function scoreTide(run) {
  const d = run.dive;
  const xs = [];
  const at = {};
  d.board.forEach((b, ci) => {
    for (const slot of SLOTS) {
      const cell = b[slot];
      if (!cell) continue;
      const i = inst(run, cell.id);
      const def = CREATURES[i.t];
      const x = {
        id: cell.id, t: i.t, inst: i, def, ci, slot, coral: run.corals[ci],
        nbs: [], opp: null, aura: 0, times: i.mut === 'echo' ? 2 : 1, silenced: false,
        allFam: !!def.allFam || i.mut === 'polyvalent',
        base: def.pts + i.bonus + (i.mut === 'geant' ? 6 : 0), pts: 0, mult: 0, xm: 1,
      };
      xs.push(x); at[`${ci}:${slot}`] = x;
    }
  });
  for (const x of xs) {
    for (const s of RING[x.slot]) if (at[`${x.ci}:${s}`]) x.nbs.push(at[`${x.ci}:${s}`]);
    // Ponts entre coraux voisins : Flanc ➡ d'un corail ↔ Flanc ⬅ du suivant.
    if (x.slot === 'E' && at[`${x.ci + 1}:W`]) x.nbs.push(at[`${x.ci + 1}:W`]);
    if (x.slot === 'W' && at[`${x.ci - 1}:E`]) x.nbs.push(at[`${x.ci - 1}:E`]);
    x.opp = at[`${x.ci}:${OPPOSITE[x.slot]}`] || null;
  }
  const isFam = (x, f) => x.allFam || x.def.fam === f;
  const eco = ecoStatus(run);
  // Un Caméléon ou une Pieuvre mimétique profite du meilleur écosystème actif.
  const ecoFor = (x, key) => Math.max(0, ...eco.filter((e) => e.tier && isFam(x, e.f)).map((e) => e.tier[key] || 0));
  const B = {
    run, xs, handLeft: d.hand.length,
    bagCount: run.bag.length,
    bagT: (t) => run.bag.filter((c) => c.t === t).length,
    bagFam: (f) => bagFam(run, f),
    discardN: d.discard.length,
    countFam: (f) => xs.filter((x) => isFam(x, f)).length,
    on: (ci) => xs.filter((x) => x.ci === ci),
    full: (ci) => { const o = openSlots(run, ci); return o.length > 0 && o.every((s) => at[`${ci}:${s}`]); },
  };

  for (const x of xs) x.def.pre?.(x, B);
  for (const x of xs) {
    if (x.silenced || x.def.copy) continue;
    const k = CORALS[x.coral.t];
    let p = x.base + (x.def.eclat?.(x, B) || 0) + x.aura + (k.eclatB?.(x) || 0) + ecoFor(x, 'eclat');
    if (has(run, 'hamecon') && isFam(x, 'poisson')) p += 1;
    if (has(run, 'nasse') && isFam(x, 'crustace')) p += 3;
    if (has(run, 'algues') && x.def.sed) p += 3;
    p *= k.eclatX?.(x) || 1;
    x.pts = Math.max(0, p) * x.times;
  }
  for (const x of xs) {
    if (x.silenced || !x.def.copy) continue;
    x.pts = Math.max(0, (x.opp && !x.opp.def.copy ? x.opp.pts : 0) + x.aura) * x.times;
  }
  for (const x of xs) {
    if (x.silenced) continue;
    x.mult = (x.def.mult?.(x, B) || 0) + x.inst.mbonus + (x.inst.mut === 'fluo' ? 2 : 0) + ecoFor(x, 'mult');
    x.xm = x.def.xmult?.(x, B) || 1;
  }

  const whales = xs.filter((x) => x.t === 'baleine' && !x.silenced).length;
  const corals = run.corals.map((c, ci) => {
    const k = CORALS[c.t];
    const on = B.on(ci);
    const live = on.filter((x) => !x.silenced);
    // Buffs affichés à côté du corail. crown : bonus de couronne ; hint : à portée de main.
    const buffs = [];
    const addM = (icon, name, n, text) => { if (n) buffs.push({ icon, name, val: `${n > 0 ? '+' : '−'}${Math.abs(n)}M`, text, neg: n < 0 }); };
    const addX = (icon, name, n, text, crown = false) => buffs.push({ icon, name, val: `×${String(n).replace('.', ',')}M`, text, x: true, crown });
    const eclat = on.reduce((a, x) => a + x.pts, 0);
    const trident = has(run, 'trident') ? on.filter((x) => x.inst.star > 0).length : 0;
    const coralB = k.multB?.(on) || 0;
    let mult = k.mult + c.lvl + live.reduce((a, x) => a + x.mult, 0) + coralB
      + (has(run, 'perle') ? 1 : 0) + whales + trident;
    addM(k.emoji, k.name, coralB, k.text);
    if (has(run, 'perle')) addM(ARTIFACTS.perle.emoji, ARTIFACTS.perle.name, 1, ARTIFACTS.perle.text);
    addM('🐋', 'Chant de la baleine', whales, 'Chaque Baleine posée dans le récif donne +1 Mult à tous les coraux.');
    addM(ARTIFACTS.trident.emoji, ARTIFACTS.trident.name, trident, ARTIFACTS.trident.text);
    if (hasCond(run, 'pression') && mult > 1) { addM(CONDITIONS.pression.emoji, CONDITIONS.pression.name, -1, CONDITIONS.pression.text); mult -= 1; }
    const full = B.full(ci);
    let xm = 1;
    for (const x of live) if (x.xm > 1) { xm *= x.xm; addX(x.def.emoji, x.def.name, x.xm, x.def.text); }
    const kx = k.xmultB?.(full) || 1;
    if (kx > 1) { xm *= kx; addX(k.emoji, k.name, kx, k.text); }
    if (full && !hasCond(run, 'fantome')) {
      const fullM = has(run, 'conque') ? 3 : 1;
      mult += fullM;
      buffs.push({ icon: CROWNS.full.icon, name: CROWNS.full.name, val: `+${fullM}M`, text: CROWNS.full.text, crown: true });
      if (on.length >= 3) {
        const fams = on.filter((x) => !x.allFam).map((x) => x.def.fam);
        const uniq = new Set(fams).size;
        if (uniq <= 1) {
          const n = has(run, 'ecaille') ? 3 : 2;
          xm *= n; addX(CROWNS.banc.icon, CROWNS.banc.name, n, CROWNS.banc.text, true);
        } else if (uniq === fams.length) {
          const n = has(run, 'prisme') ? 2 : 1.5;
          xm *= n; addX(CROWNS.mosaic.icon, CROWNS.mosaic.name, n, CROWNS.mosaic.text, true);
        }
      }
    } else if (!full && !hasCond(run, 'fantome') && on.length > 0 && openSlots(run, ci).length - on.length === 1) {
      buffs.push({ icon: CROWNS.full.icon, name: CROWNS.full.name, val: `+${has(run, 'conque') ? 3 : 1}M`, text: `Plus qu’un emplacement à occuper. ${CROWNS.full.text}`, crown: true, hint: true });
    }
    mult = Math.max(1, mult);
    const multTot = Math.round(mult * xm * 100) / 100;
    return { ci, eclat, mult, xm, multTot, score: Math.floor(eclat * mult * xm), buffs, ignored: false, n: on.length };
  });
  if (hasCond(run, 'leviathan')) {
    const best = corals.reduce((b, c) => (c.score > (b?.score ?? -1) ? c : b), null);
    if (best && best.score > 0) best.ignored = true;
  }
  let total = corals.reduce((a, c) => a + (c.ignored ? 0 : c.score), 0);
  const factors = [];
  if (has(run, 'ancre') && d.tide === 1) { total *= 2; factors.push('⚓ Ancre ×2'); }
  if (has(run, 'sablier') && d.tide === d.tidesMax) { total *= 2; factors.push('⏳ Sablier ×2'); }
  const byKey = {};
  for (const x of xs) byKey[`${x.ci}:${x.slot}`] = { pts: x.pts, mult: x.mult, xm: x.xm, silenced: x.silenced, times: x.times };
  return { corals, total, factors, byKey, xs, B };
}

// Lance la marée : marque les points et applique les effets d'après-marée.
export function launchTide(run) {
  const d = run.dive;
  // Récif ET main vides (Éphémères épuisées) : la marée passe sans marquer.
  if (d.phase !== 'place' || (boardCount(run) === 0 && d.hand.length > 0)) return null;
  const res = scoreTide(run);
  const out = { pearls: 0, devoured: new Set(), notes: [] };
  for (const x of res.xs) {
    if (x.silenced) continue;
    x.def.after?.(x, res.B, out);
    if (x.inst.mut === 'nacre') out.pearls += 1;
    if (x.def.evolve && ++x.inst.xp >= x.def.evolve.after) {
      x.inst.t = x.def.evolve.into;
      x.inst.xp = 0;
      out.notes.push(`${x.def.emoji} ${x.def.name} éclôt : ${CREATURES[x.inst.t].emoji} ${CREATURES[x.inst.t].name} !`);
    }
  }
  run.pearls += out.pearls;
  if (out.pearls) out.notes.push(`🦪 +${out.pearls} perles`);
  d.score += res.total;
  d.devoured = [...out.devoured];
  d.last = { corals: res.corals, total: res.total, factors: res.factors, byKey: res.byKey, notes: out.notes, tide: d.tide };
  d.history.push(res.total);
  d.phase = 'scored';
  if (d.score >= d.target) d.ended = 'win';
  else if (d.tide >= d.tidesMax) d.ended = 'lose';
  return d.last;
}

// Après l'affichage du résultat : nettoie le récif et prépare la marée suivante.
export function nextTide(run) {
  const d = run.dive;
  if (d.phase !== 'scored') return;
  const dev = new Set(d.devoured || []);
  d.board.forEach((b) => {
    for (const s of SLOTS) {
      const cell = b[s];
      if (!cell) continue;
      if (dev.has(cell.id)) { b[s] = null; continue; }
      const i = inst(run, cell.id);
      const def = CREATURES[i.t];
      if (def.sed) { cell.lock = true; continue; }
      b[s] = null;
      if (def.ephem) d.exhausted.push(cell.id);
      else if (def.loyal || i.mut === 'fidele') d.hand.push(cell.id);
      else d.discard.push(cell.id);
    }
  });
  if (dev.size) run.bag = run.bag.filter((c) => !dev.has(c.id));
  d.devoured = [];
  if (d.ended) { finishDive(run); return; }
  d.tide++;
  if (hasCond(run, 'tempete')) { d.discard.push(...d.hand); d.hand = []; }
  drawTo(run, d.handSize);
  krakenBlock(run);
  d.last = null;
  d.phase = 'place';
}

// Abandonner les marées restantes n'est pas permis : on peut seulement les jouer.
function finishDive(run) {
  const d = run.dive;
  run.dives++;
  let win = d.ended === 'win';
  if (!win && has(run, 'trefle') && d.score >= d.target * 0.75) {
    win = true;
    run.artifacts = run.artifacts.filter((a) => a !== 'trefle');
    run.toast = '🍀 Le coquillage porte-bonheur se brise… mais la plongée est sauvée !';
  }
  if (!win) {
    if (d.type === 'boss') { endRun(run, false); return; }
    run.oxygen--;
    if (run.oxygen <= 0) { endRun(run, false); return; }
    run.toast = `💨 Plongée ratée : vous perdez 1 🫧 Oxygène (${run.oxygen}/${run.oxygenMax}).`;
    backToMap(run);
    return;
  }
  const unused = d.tidesMax - d.tide;
  let pearls = 3 + unused + (d.type === 'elite' ? 2 : 0) + (d.type === 'boss' ? 5 : 0);
  const lines = [['Plongée réussie', 3]];
  if (unused) lines.push([`Marées non utilisées ×${unused}`, unused]);
  if (d.type === 'elite') lines.push(['Plongée périlleuse', 2]);
  if (d.type === 'boss') lines.push(['Gardien vaincu', 5]);
  if (has(run, 'tresor')) { pearls += 4; lines.push(['🗺️ Carte au trésor', 4]); }
  if (has(run, 'bourse')) {
    const it = Math.min(5, Math.floor(run.pearls / 5));
    if (it) { pearls += it; lines.push(['👝 Bourse de nacre', it]); }
  }
  run.pearls += pearls;
  const offers = creatureOffers(run, has(run, 'longuevue') ? 4 : 3);
  const stages = [{ kind: 'creature', options: offers, muts: rollMuts(run, offers) }];
  if (d.type === 'elite') stages.push({ kind: 'artifact', options: artifactOffers(run, 3) });
  if (d.type === 'boss') {
    run.bosses++;
    run.oxygen = run.oxygenMax;
    if (run.zone < ZONES.length - 1) {
      stages.unshift(run.corals.length < BASE.maxCorals
        ? { kind: 'coral', options: coralOffers(run, 3) }
        : { kind: 'fortify-all' });
      stages.push({ kind: 'mutation', options: mutationOffers(run, 3) });
    }
  }
  run.reward = { pearls, lines, stages, score: d.score, target: d.target, type: d.type };
  if (d.type === 'boss' && run.zone >= ZONES.length - 1) { endRun(run, true); return; }
  run.phase = 'reward';
}

// ── Offres ──────────────────────────────────────────────────
function rarityWeights(run) {
  return [[['c', 60], ['u', 32], ['r', 8]], [['c', 45], ['u', 38], ['r', 17]], [['c', 32], ['u', 40], ['r', 28]]][run.zone];
}
// Plus une créature va dans le sens du récif et du banc, plus elle a de chances
// d'être proposée — mais la dernière offre reste libre pour laisser bifurquer.
function affinity(run, t) {
  const def = CREATURES[t];
  const share = bagFam(run, def.fam) / Math.max(1, run.bag.length);
  return 1 + 4 * share + (coralLikes(run, def) ? 1.5 : 0) + (diverLikes(run, def) ? 0.5 : 0);
}
export function creatureOffers(run, n) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 100) {
    const r = weighted(run, rarityWeights(run));
    const pool = Object.keys(CREATURES).filter((k) => CREATURES[k].rar === r && !out.includes(k) && offerable(run, k));
    if (pool.length) out.push(out.length === n - 1 ? pick(run, pool) : weighted(run, pool.map((t) => [t, affinity(run, t)])));
  }
  return out;
}
export function mutationOffers(run, n) { return shuffle(run, Object.keys(MUTATIONS)).slice(0, n); }
// Parfois, une créature proposée est déjà mutée (de plus en plus souvent en descendant).
function rollMuts(run, options) {
  const muts = {};
  for (const t of options) if (rnd(run) < 0.1 + run.zone * 0.05) muts[t] = pick(run, Object.keys(MUTATIONS));
  return muts;
}
export function artifactOffers(run, n) {
  return shuffle(run, Object.keys(ARTIFACTS).filter((a) => !has(run, a))).slice(0, n);
}
export function coralOffers(run, n) {
  const w = [['c', 50], ['u', 30], ['r', 20]];
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 100) {
    const r = weighted(run, w);
    const pool = Object.keys(CORALS).filter((k) => CORALS[k].rar === r && !out.includes(k));
    if (pool.length) out.push(pick(run, pool));
  }
  return out;
}

// Étapes de récompense : la première de la liste est l'étape en cours.
export function rewardChoose(run, value) {
  const st = run.reward.stages.shift();
  if (!st) return;
  if (st.kind === 'creature') {
    if (value) addCreature(run, value, st.muts && st.muts[value] ? { mut: st.muts[value] } : {}); else run.pearls += 3;
  } else if (st.kind === 'artifact') {
    if (value) addArtifact(run, value); else run.pearls += 4;
  } else if (st.kind === 'coral') {
    if (value) addCoral(run, value); else run.pearls += 5;
  } else if (st.kind === 'fortify-all') {
    for (const c of run.corals) c.lvl++;
  } else if (st.kind === 'mutation') {
    if (value) {
      run.pending = { purpose: 'mutate', mut: value, then: run.reward.stages.length ? null : 'map' };
      return;
    }
    run.pearls += 4;
  }
  if (!run.reward.stages.length) backToMap(run);
}

// ── Comptoir ────────────────────────────────────────────────
export function makeShop(run) {
  const cr = creatureOffers(run, 3).map((t) => ({ t, price: price(run, RARITY[CREATURES[t].rar].price) }));
  const ar = artifactOffers(run, 2).map((a) => ({ a, price: price(run, ARTIFACTS[a].price) }));
  const co = run.corals.length < BASE.maxCorals ? coralOffers(run, 1).map((t) => ({ t, price: price(run, 14) })) : [];
  const mu = mutationOffers(run, 1).map((m) => ({ m, price: price(run, 8) }));
  return { cr, ar, co, mu, reroll: 2 };
}
export function shopBuy(run, kind, i) {
  const s = run.shop;
  const item = s[kind][i];
  if (!item || run.pearls < item.price) return false;
  // Une mutation ne se paie qu'une fois sa créature choisie (on peut encore annuler).
  if (kind === 'mu') {
    run.pending = { purpose: 'mutate', mut: item.m, cost: item.price, shopI: i, then: null, cancel: true };
    return true;
  }
  run.pearls -= item.price;
  if (kind === 'cr') addCreature(run, item.t);
  if (kind === 'ar') addArtifact(run, item.a);
  if (kind === 'co') addCoral(run, item.t);
  s[kind][i] = null;
  return true;
}
export function shopReroll(run) {
  const s = run.shop;
  if (run.pearls < s.reroll) return false;
  run.pearls -= s.reroll;
  const next = makeShop(run);
  s.cr = next.cr;
  s.reroll++;
  return true;
}
export const healCost = (run) => price(run, 6);
export function shopHeal(run) {
  if (run.pearls < healCost(run) || run.oxygen >= run.oxygenMax) return false;
  run.pearls -= healCost(run);
  run.oxygen++;
  return true;
}

// ── Choix d'une créature / d'un corail (événements, nurserie, comptoir) ──
// purpose : remove | upgrade | duplicate | sell | fortify | mutate | merge
export function upgradeAmount(run, c) {
  return Math.max(2, Math.ceil((CREATURES[c.t].pts + c.bonus) * 0.5));
}
export const canMerge = (run) => run.bag.length > 6
  && run.bag.some((c) => !CREATURES[c.t].parasite && run.bag.some((o) => o !== c && o.t === c.t));
// Quelles créatures peut-on choisir pour cette action ?
export function pickable(run, c, purpose) {
  const def = CREATURES[c.t];
  if (purpose === 'remove') return true;
  if (def.parasite) return false;
  if (purpose === 'merge') return run.bag.some((o) => o !== c && o.t === c.t);
  return true;
}
export function chooseMutation(run, m) {
  const p = run.pending;
  if (!p || p.purpose !== 'mutchoice' || !p.options.includes(m)) return false;
  run.pending = { purpose: 'mutate', mut: m, then: p.then };
  return true;
}
export function applyPick(run, id) {
  const p = run.pending;
  if (!p) return false;
  if (p.purpose === 'fortify') {
    const c = run.corals.find((k) => k.id === id);
    if (!c) return false;
    c.lvl++;
    run.toast = `${CORALS[c.t].emoji} ${CORALS[c.t].name} : +1 Mult permanent.`;
  } else {
    const c = inst(run, id);
    if (!c) return false;
    const def = CREATURES[c.t];
    if (!pickable(run, c, p.purpose)) return false;
    if (p.purpose === 'remove' || p.purpose === 'sell') {
      if (run.bag.length <= 6) return false;
      if (p.cost) { if (run.pearls < p.cost) return false; run.pearls -= p.cost; run.removeCost += 2; }
      run.bag = run.bag.filter((k) => k.id !== id);
      if (p.purpose === 'sell') run.pearls += 7;
      run.toast = `${def.emoji} ${def.name} quitte votre banc.`;
    } else if (p.purpose === 'upgrade') {
      const n = upgradeAmount(run, c);
      c.bonus += n; c.star++;
      run.toast = `${def.emoji} ${def.name} ★ : +${n} Éclat permanent.`;
    } else if (p.purpose === 'duplicate') {
      addCreature(run, c.t, { bonus: c.bonus, star: c.star });
      run.toast = `${def.emoji} ${def.name} est dupliqué !`;
    } else if (p.purpose === 'mutate') {
      if (p.cost) {
        if (run.pearls < p.cost) return false;
        run.pearls -= p.cost;
      }
      if (p.shopI !== undefined && run.shop) run.shop.mu[p.shopI] = null;
      c.mut = p.mut;
      run.toast = `${def.emoji} ${def.name} devient ${MUTATIONS[p.mut].emoji} ${MUTATIONS[p.mut].name} : ${MUTATIONS[p.mut].text}`;
    } else if (p.purpose === 'merge') {
      if (run.bag.length <= 6) return false;
      const other = run.bag.filter((o) => o !== c && o.t === c.t).sort((a, b) => b.bonus - a.bonus)[0];
      c.bonus += other.bonus + def.pts;
      c.mbonus += other.mbonus + 1;
      c.star = Math.max(c.star, other.star) + 1;
      c.xp = Math.max(c.xp, other.xp);
      c.mut = c.mut || other.mut;
      run.bag = run.bag.filter((o) => o !== other);
      run.toast = `${def.emoji} ${def.name} : fusion ★ ! Éclat additionné et +1 Mult permanent.`;
    }
  }
  const then = p.then;
  run.pending = null;
  if (then === 'map') backToMap(run);
  return true;
}

// ── Nurserie ────────────────────────────────────────────────
export function restChoose(run, what) {
  if (what === 'heal') {
    if (run.oxygen >= run.oxygenMax) return false;
    run.oxygen = Math.min(run.oxygenMax, run.oxygen + 1);
    run.toast = '🫧 Vous reprenez votre souffle (+1 Oxygène).';
    backToMap(run);
  } else if (what === 'upgrade') {
    run.pending = { purpose: 'upgrade', then: 'map' };
  } else if (what === 'fortify') {
    run.pending = { purpose: 'fortify', then: 'map' };
  } else if (what === 'mutate') {
    run.pending = { purpose: 'mutchoice', options: mutationOffers(run, 3), then: 'map' };
  } else if (what === 'merge') {
    if (!canMerge(run)) return false;
    run.pending = { purpose: 'merge', then: 'map' };
  }
  return true;
}

// ── Épaves (événements) ─────────────────────────────────────
export const EVENTS = {
  galion: {
    title: 'Le galion englouti', emoji: '🏴‍☠️',
    text: 'La coque éventrée d’un galion repose sur le sable. Des reflets dorés brillent dans la cale… mais l’air de votre bouteille baisse vite.',
    choices: [
      { label: 'Fouiller la cale', text: '+12 perles, −1 🫧', ok: (r) => r.oxygen > 1,
        act: (r) => { r.pearls += 12; r.oxygen--; return 'Vous remontez les poches pleines… et le souffle court.'; } },
      { label: 'Prendre le coffret du capitaine', text: 'Un artefact au hasard, −1 🫧', ok: (r) => r.oxygen > 1 && artifactOffers(r, 1).length,
        act: (r) => { const a = artifactOffers(r, 1)[0]; addArtifact(r, a); r.oxygen--; return `Vous trouvez : ${ARTIFACTS[a].emoji} ${ARTIFACTS[a].name} !`; } },
      { label: 'Repartir', text: 'Rien ne se passe.', act: () => 'Mieux vaut ne pas tenter le diable.' },
    ],
  },
  sardines: {
    title: 'Le grand banc', emoji: '🐟',
    text: 'Un banc de sardines tourbillonne autour de vous, si dense qu’il masque la lumière.',
    choices: [
      { label: 'Nager avec le banc', text: '+2 Sardines', act: (r) => { addCreature(r, 'sardine'); addCreature(r, 'sardine'); return 'Deux petits groupes décident de vous suivre.'; } },
      { label: 'Disperser le banc', text: '+5 perles', act: (r) => { r.pearls += 5; return 'Au milieu du tourbillon, vous ramassez quelques perles.'; } },
    ],
  },
  sirene: {
    title: 'Le chant de la sirène', emoji: '🧜',
    text: 'Une silhouette vous fait signe depuis un rocher. Son chant semble pouvoir faire naître la vie… contre rétribution.',
    choices: [
      { label: 'Lui offrir 6 perles', text: 'Dupliquez une créature de votre banc', ok: (r) => r.pearls >= 6,
        act: (r) => { r.pearls -= 6; r.pending = { purpose: 'duplicate', then: 'map' }; return null; } },
      { label: 'Écouter son chant', text: '+1 🫧', ok: (r) => r.oxygen < r.oxygenMax,
        act: (r) => { r.oxygen++; return 'Vous vous sentez apaisé. (+1 Oxygène)'; } },
      { label: 'Passer votre chemin', text: '', act: () => 'Le chant s’éteint derrière vous.' },
    ],
  },
  chaud: {
    title: 'Le courant chaud', emoji: '♨️',
    text: 'Un courant tiède remonte des profondeurs, chargé de nutriments. Vos coraux frémissent.',
    choices: [
      { label: 'Y exposer un corail', text: '+1 Mult permanent à un corail de votre choix',
        act: (r) => { r.pending = { purpose: 'fortify', then: 'map' }; return null; } },
      { label: 'Se laisser porter', text: '+3 perles, +1 🫧 si besoin',
        act: (r) => { r.pearls += 3; r.oxygen = Math.min(r.oxygenMax, r.oxygen + 1); return 'Le courant vous dépose plus loin, reposé.'; } },
    ],
  },
  pecheurs: {
    title: 'Les pêcheurs', emoji: '🎣',
    text: 'Un filet descend de la surface. Les pêcheurs proposent un marché par signes.',
    choices: [
      { label: 'Leur céder une créature', text: '+7 perles', ok: (r) => r.bag.length > 6,
        act: (r) => { r.pending = { purpose: 'sell', then: 'map' }; return null; } },
      { label: 'Acheter leur prise (8 perles)', text: 'Une créature rare au hasard', ok: (r) => r.pearls >= 8,
        act: (r) => { r.pearls -= 8; const pool = Object.keys(CREATURES).filter((k) => CREATURES[k].rar === 'r'); const t = pick(r, pool); addCreature(r, t); return `Vous obtenez : ${CREATURES[t].emoji} ${CREATURES[t].name} !`; } },
      { label: 'Couper le filet', text: '', act: () => 'Le filet remonte, vide.' },
    ],
  },
  grotte: {
    title: 'La grotte phosphorescente', emoji: '🔮',
    text: 'Une grotte baigne dans une lueur bleutée. Les créatures qui y entrent en ressortent changées.',
    choices: [
      { label: 'Y guider une créature', text: 'Améliorez une créature ★',
        act: (r) => { r.pending = { purpose: 'upgrade', then: 'map' }; return null; } },
      { label: 'Explorer le fond', text: '50 % : un artefact. 50 % : −1 🫧', ok: (r) => artifactOffers(r, 1).length,
        act: (r) => {
          if (rnd(r) < 0.5) { const a = artifactOffers(r, 1)[0]; addArtifact(r, a); return `Trouvé : ${ARTIFACTS[a].emoji} ${ARTIFACTS[a].name} !`; }
          r.oxygen--; if (r.oxygen <= 0) { endRun(r, false); return 'Vous vous perdez dans le noir…'; }
          return 'Vous vous égarez et remontez à bout de souffle. (−1 Oxygène)';
        } },
    ],
  },
  mue: {
    title: 'La mue', emoji: '🦞',
    text: 'Une carapace vide flotte entre deux eaux. L’occasion de laisser derrière vous ce qui vous alourdit.',
    choices: [
      { label: 'Alléger votre banc', text: 'Retirez une créature gratuitement', ok: (r) => r.bag.length > 6,
        act: (r) => { r.pending = { purpose: 'remove', then: 'map' }; return null; } },
      { label: 'Garder la carapace', text: '+1 Bernard-l’ermite', act: (r) => { addCreature(r, 'bernard'); return 'Un Bernard-l’ermite s’y installe aussitôt.'; } },
    ],
  },
  epave: {
    title: 'L’épave du sous-marin', emoji: '⚙️',
    text: 'Un vieux sous-marin rouillé. Son sas est encore étanche : un abri parfait pour une nouvelle colonie.',
    choices: [
      { label: 'Planter une bouture', text: 'Un corail au hasard (si vous avez de la place), −8 perles', ok: (r) => r.pearls >= 8 && r.corals.length < BASE.maxCorals,
        act: (r) => { r.pearls -= 8; const t = coralOffers(r, 1)[0]; addCoral(r, t); return `Un nouveau corail pousse : ${CORALS[t].emoji} ${CORALS[t].name} !`; } },
      { label: 'Récupérer la ferraille', text: '+6 perles', act: (r) => { r.pearls += 6; return 'Quelques pièces se revendront bien.'; } },
    ],
  },
  decharge: {
    title: 'La décharge sous-marine', emoji: '🛍️',
    text: 'Des sacs et des bidons s’amoncellent, et au milieu, des objets de valeur. Se servir, c’est aussi repartir avec des déchets accrochés à vos palmes.',
    choices: [
      { label: 'Fouiller les bidons', text: '+15 perles, mais un Sac plastique rejoint votre banc',
        act: (r) => { r.pearls += 15; addCreature(r, 'plastique'); return 'Les poches pleines… et un sac plastique qui vous suit partout.'; } },
      { label: 'Libérer une créature rare', text: 'Une créature rare, mais un Filet fantôme rejoint votre banc',
        act: (r) => { const pool = Object.keys(CREATURES).filter((k) => CREATURES[k].rar === 'r'); const t = pick(r, pool); addCreature(r, t); addCreature(r, 'filet_fantome'); return `${CREATURES[t].emoji} ${CREATURES[t].name} vous rejoint, encore empêtré dans son filet.`; } },
      { label: 'Ne touchez à rien', text: '', act: () => 'Vous passez votre chemin.' },
    ],
  },
  source: {
    title: 'La source hydrothermale', emoji: '🌋',
    text: 'Une eau brûlante et riche en minéraux jaillit du fond. Les créatures qui s’en approchent ne sont plus tout à fait les mêmes.',
    choices: [
      { label: 'Exposer une créature', text: 'Choisissez 1 mutation parmi 3, puis sa créature',
        act: (r) => { r.pending = { purpose: 'mutchoice', options: mutationOffers(r, 3), then: 'map' }; return null; } },
      { label: 'Récolter les minéraux', text: '+6 perles', act: (r) => { r.pearls += 6; return 'Vous emportez quelques cristaux.'; } },
    ],
  },
  frai: {
    title: 'La nuit du frai', emoji: '🌕',
    text: 'À la pleine lune, tout le récif se reproduit. Vos créatures aussi ressentent l’appel.',
    choices: [
      { label: 'Unir deux créatures identiques', text: 'Fusion ★ : Éclat additionné et +1 Mult permanent', ok: canMerge,
        act: (r) => { r.pending = { purpose: 'merge', then: 'map' }; return null; } },
      { label: 'Accueillir les nouveau-nés', text: '2 créatures communes de votre famille dominante',
        act: (r) => {
          const f = dominantFam(r);
          const pool = Object.keys(CREATURES).filter((k) => CREATURES[k].rar === 'c' && CREATURES[k].fam === f);
          const a = pick(r, pool); const b = pick(r, pool);
          addCreature(r, a); addCreature(r, b);
          return `${CREATURES[a].emoji} ${CREATURES[a].name} et ${CREATURES[b].emoji} ${CREATURES[b].name} rejoignent votre banc.`;
        } },
    ],
  },
};
function pickEvent(run) { return pick(run, Object.keys(EVENTS)); }

export function eventChoose(run, i) {
  const ev = EVENTS[run.event.id];
  const ch = ev.choices[i];
  if (!ch || (ch.ok && !ch.ok(run))) return false;
  const msg = ch.act(run);
  if (run.phase === 'end') return true;
  if (run.pending) return true; // un choix de créature/corail suit
  run.event.msg = msg;
  run.event.done = true;
  return true;
}
