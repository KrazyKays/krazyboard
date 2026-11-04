// ─────────────────────────────────────────────────────────────
//  Récif Mêlé — moteur de jeu (indépendant de l'affichage)
// ─────────────────────────────────────────────────────────────
import {
  CORALS, SPECIES, FAMILIES, STARTER, POOL_COMMON, POOL_RARE,
  TREASURES, MODIFIERS, DIVES, DIVERS,
} from './data.js';

let UID = 1;
const uid = () => UID++;

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Une carte « gabarit » de la collection du joueur (persistante sur l'expédition).
export function makeTemplate(base) {
  const t = { ...base, id: uid() };
  if (t.kind === 'species') t.color = t.color || pick(FAMILIES);
  return t;
}

// ── Expédition ───────────────────────────────────────────────
export function newRun(diverId) {
  const diver = DIVERS[diverId];
  const collection = [...STARTER, ...diver.extra].map(makeTemplate);
  return {
    diverId, collection,
    treasures: [...diver.treasures],
    pearls: 0, diveIndex: 0, scores: [], removeCost: 3,
  };
}

export const has = (run, t) => run.treasures.includes(t);

// ── Plongée ──────────────────────────────────────────────────
export function startDive(run) {
  const cfg = DIVES[run.diveIndex];
  const d = {
    cfg, target: cfg.target, mods: [],
    drawPile: [], courant: [], hand: [], reef: [], epave: [],
    tides: 0, tidesNeeded: 3 + (has(run, 'ancre') ? 1 : 0),
    handMax: 10 + (has(run, 'sac') ? 3 : 0),
    courantMax: 10 + (has(run, 'algues') ? 3 : 0),
    reveal: 1, coralCostMod: has(run, 'couronne') ? -1 : 0, topCostMod: 0,
    tideZone: 1 / 3,
    drawLimit: has(run, 'longuevue') ? 3 : 2,
    actions: 1, taken: 0, turn: 1,
    log: [], ended: false, endReason: '',
  };
  // Conditions
  const modKeys = shuffle(Object.keys(MODIFIERS)).slice(0, cfg.mods);
  for (const k of modKeys) { d.mods.push(k); MODIFIERS[k].apply(d); }

  // Pioche : cartes mélangées, Marées cachées dans la dernière partie.
  const cards = shuffle(run.collection.map((t) => ({ ...t, uid: uid() })));
  const cut = Math.floor(cards.length * (1 - d.tideZone));
  const tides = Array.from({ length: d.tidesNeeded }, () => ({ kind: 'tide', uid: uid() }));
  d.drawPile = [...cards.slice(0, cut), ...shuffle([...cards.slice(cut), ...tides])];

  if (has(run, 'bouteille')) {
    d.reef.push(newCoral({ kind: 'coral', coral: 'cerveau', uid: uid() }));
  }
  const start = 6 + (has(run, 'filet') ? 2 : 0);
  for (let i = 0; i < start; i++) drawCard(d);
  for (let i = 0; i < 3; i++) revealCard(d);
  log(d, `Plongée « ${cfg.name} » — objectif ${d.target} pts.`);
  return d;
}

function newCoral(card) {
  return { card, type: card.coral, slots: { top: [], bottom: [], left: [], right: [] } };
}

export function log(d, msg) { d.log.unshift(msg); if (d.log.length > 40) d.log.pop(); }

// Tire la première carte non-Marée de la pioche.
function pullCard(d) {
  while (d.drawPile.length) {
    const c = d.drawPile.shift();
    if (c.kind === 'tide') {
      d.tides++;
      log(d, `🌊 Une Marée monte ! (${d.tides}/${d.tidesNeeded})`);
      if (d.tides >= d.tidesNeeded) { endDive(d, 'La dernière Marée est montée.'); return null; }
      continue;
    }
    return c;
  }
  endDive(d, 'La pioche est épuisée.');
  return null;
}

function endDive(d, reason) { if (!d.ended) { d.ended = true; d.endReason = reason; } }

export function drawCard(d) {
  if (d.ended || d.hand.length >= d.handMax) return null;
  const c = pullCard(d);
  if (c) d.hand.push(c);
  return c;
}
function revealCard(d) {
  if (d.ended) return null;
  const c = pullCard(d);
  if (c) d.courant.push(c);
  return c;
}

// ── Action « Piocher » ──────────────────────────────────────
export function canTake(d) {
  return !d.ended && d.taken < d.drawLimit && d.hand.length < d.handMax;
}
export function takeFromDeck(d) {
  if (!canTake(d) || !d.drawPile.length) return false;
  d.taken++;
  drawCard(d);
  afterTake(d);
  return true;
}
export function takeFromCourant(d, cardUid) {
  if (!canTake(d)) return false;
  const i = d.courant.findIndex((c) => c.uid === cardUid);
  if (i < 0) return false;
  d.taken++;
  d.hand.push(d.courant.splice(i, 1)[0]);
  afterTake(d);
  return true;
}
function afterTake(d) {
  if (d.ended) return;
  if (d.taken >= d.drawLimit || d.hand.length >= d.handMax) finishDraw(d);
}
export function finishDraw(d) {
  if (d.taken > 0) log(d, `Vous piochez ${d.taken} carte${d.taken > 1 ? 's' : ''}.`);
  d.taken = 0;
  completeAction(d);
}

function completeAction(d) {
  d.actions--;
  if (d.actions <= 0) endTurn(d);
}

export function endTurn(d) {
  if (d.ended) return;
  for (let i = 0; i < d.reveal; i++) revealCard(d);
  if (d.courant.length >= d.courantMax) {
    log(d, `🌀 Le Courant déborde et emporte ${d.courant.length} cartes vers les abysses.`);
    d.courant = [];
  }
  d.turn++;
  d.actions = 1;
  d.taken = 0;
}

// ── Action « Jouer » ────────────────────────────────────────
export function cardCost(d, card, half) {
  if (card.kind === 'coral') return Math.max(0, CORALS[card.coral].cost + d.coralCostMod);
  const sp = SPECIES[card.halves[half]];
  return sp.cost + (sp.pos === 'top' ? d.topCostMod : 0);
}

// Emplacements où une moitié de carte peut être posée.
export function validTargets(d, card, half) {
  if (card.kind === 'coral') return [{ coral: -1, slot: 'new' }];
  const sp = SPECIES[card.halves[half]];
  const slots = sp.pos === 'flank' ? ['left', 'right'] : [sp.pos];
  const out = [];
  d.reef.forEach((coral, ci) => {
    for (const s of slots) {
      const cur = coral.slots[s];
      if (!cur.length || (sp.stack && cur[0].sp === card.halves[half])) out.push({ coral: ci, slot: s });
    }
  });
  return out;
}

export function canPlay(d, card, half) {
  if (d.ended || d.taken > 0) return false;
  if (cardCost(d, card, half) > d.hand.length - 1) return false;
  return validTargets(d, card, half).length > 0;
}

// Joue une carte. Retourne la liste des effets interactifs à résoudre.
export function playCard(run, d, cardUid, half, target, payUids) {
  const card = d.hand.find((c) => c.uid === cardUid);
  if (!card || !canPlay(d, card, half)) return null;
  const cost = cardCost(d, card, half);
  if (payUids.length !== cost || payUids.includes(cardUid)) return null;
  if (!payUids.every((u) => d.hand.some((c) => c.uid === u))) return null;
  const ok = validTargets(d, card, half).some((t) => t.coral === target.coral && t.slot === target.slot);
  if (!ok) return null;

  d.hand = d.hand.filter((c) => c.uid !== cardUid);
  const paid = d.hand.filter((c) => payUids.includes(c.uid));
  d.hand = d.hand.filter((c) => !payUids.includes(c.uid));
  d.courant.push(...paid);

  let effects = [];
  if (card.kind === 'coral') {
    d.reef.push(newCoral(card));
    log(d, `🪸 Vous faites pousser : ${CORALS[card.coral].name}.`);
    effects = [...(CORALS[card.coral].effects || [])];
  } else {
    const spId = card.halves[half];
    const sp = SPECIES[spId];
    const coral = d.reef[target.coral];
    coral.slots[target.slot].push({ sp: spId, card });
    log(d, `${sp.emoji} ${sp.name} rejoint ${CORALS[coral.type].name}.`);
    effects = [...(sp.effects || [])];
    if (card.color === coral.type) {
      const n = has(run, 'hippocampe') ? 2 : 1;
      log(d, `✨ Symbiose ! Vous piochez ${n} carte${n > 1 ? 's' : ''}.`);
      effects.unshift({ type: 'draw', n, symbiose: true });
    }
  }

  // Effets automatiques immédiats ; on renvoie les interactifs.
  const pending = [];
  for (const e of effects) {
    if (e.type === 'draw') for (let i = 0; i < e.n; i++) drawCard(d);
    else if (e.type === 'extra') { d.actions++; log(d, '➕ Action supplémentaire !'); }
    else pending.push({ ...e });
  }
  return pending.filter((e) => isEffectUseful(d, e));
}

export function isEffectUseful(d, e) {
  if (d.ended) return false;
  if (e.type === 'takeCourant') return d.courant.length > 0 && d.hand.length < d.handMax;
  if (e.type === 'epaveCourant') return d.courant.length > 0;
  if (e.type === 'epaveHand') return d.hand.length > 0;
  return false;
}

export function resolveEffect(d, e, uids) {
  uids = uids.slice(0, e.n);
  if (e.type === 'takeCourant') {
    const room = d.handMax - d.hand.length;
    uids = uids.slice(0, room);
    for (const u of uids) {
      const i = d.courant.findIndex((c) => c.uid === u);
      if (i >= 0) d.hand.push(d.courant.splice(i, 1)[0]);
    }
    if (uids.length) log(d, `Vous prenez ${uids.length} carte(s) du Courant.`);
  } else if (e.type === 'epaveCourant') {
    for (const u of uids) {
      const i = d.courant.findIndex((c) => c.uid === u);
      if (i >= 0) d.epave.push(d.courant.splice(i, 1)[0]);
    }
    if (uids.length) log(d, `⚓ ${uids.length} carte(s) coulent dans l'Épave.`);
  } else if (e.type === 'epaveHand') {
    for (const u of uids) {
      const i = d.hand.findIndex((c) => c.uid === u);
      if (i >= 0) d.epave.push(d.hand.splice(i, 1)[0]);
    }
    if (uids.length) log(d, `⚓ ${uids.length} carte(s) coulent dans l'Épave.`);
  }
}

// À appeler une fois tous les effets d'une carte jouée résolus.
export function finishPlay(d) { completeAction(d); }

// Passer l'action en cours (sans rien faire).
export function passAction(d) { if (!d.ended) { d.taken = 0; completeAction(d); } }

// Après un chargement de sauvegarde : éviter les collisions d'identifiants.
export function bumpUid(n) { if (n >= UID) UID = n + 1; }

// ── Score ───────────────────────────────────────────────────
export function makeCtx(run, d) {
  const creatures = [];
  d.reef.forEach((coral) => {
    for (const [slot, arr] of Object.entries(coral.slots)) {
      for (const p of arr) creatures.push({ p, coral, slot, sp: SPECIES[p.sp] });
    }
  });
  const posOf = (slot) => (slot === 'left' || slot === 'right' ? 'flank' : slot);
  return {
    corals: d.reef, creatures, hand: d.hand, epave: d.epave,
    countCoral: (t) => d.reef.filter((c) => c.type === t).length,
    coralFamilies: () => new Set(d.reef.map((c) => c.type).filter((t) => t !== 'noir')).size,
    countTag: (t) => creatures.filter((c) => c.sp.tags.includes(t)).length,
    countSp: (id) => creatures.filter((c) => c.p.sp === id).length,
    countPos: (pos) => creatures.filter((c) => posOf(c.slot) === pos).length,
    creaturesOn: (coral) => Object.values(coral.slots).reduce((a, s) => a + s.length, 0),
    tagOn: (coral, t) => Object.values(coral.slots).flat().filter((p) => SPECIES[p.sp].tags.includes(t)).length,
    isFull: (coral) => Object.values(coral.slots).every((s) => s.length > 0),
  };
}

export function computeScore(run, d) {
  const ctx = makeCtx(run, d);
  const per = new Map(); // uid -> pts
  const lines = [];
  let total = 0;
  const add = (label, pts, key) => {
    total += pts;
    if (key !== undefined) per.set(key, (per.get(key) || 0) + pts);
    lines.push({ label, pts });
  };
  for (const coral of d.reef) {
    const def = CORALS[coral.type];
    let pts = def.score(ctx, { coral });
    if (has(run, 'conque')) pts += 1;
    add(`🪸 ${def.name}`, pts, coral.card.uid);
  }
  for (const c of ctx.creatures) {
    let pts = c.sp.score(ctx, { coral: c.coral, slot: c.slot });
    if (has(run, 'hamecon') && c.sp.tags.includes('Poisson')) pts += 1;
    if (has(run, 'nasse') && (c.sp.tags.includes('Crustacé') || c.sp.tags.includes('Mollusque'))) pts += 1;
    add(`${c.sp.emoji} ${c.sp.name}`, pts, c.p.card.uid);
  }
  if (d.epave.length) add(`⚓ Épave (${d.epave.length} cartes)`, d.epave.length * (has(run, 'carte') ? 2 : 1));
  if (has(run, 'perle')) add('⚫ Perle noire', 6);
  return { total, per, lines };
}

// Regroupe les lignes identiques pour le récapitulatif.
export function summarize(lines) {
  const m = new Map();
  for (const l of lines) {
    const e = m.get(l.label) || { label: l.label, pts: 0, n: 0 };
    e.pts += l.pts; e.n++;
    m.set(l.label, e);
  }
  return [...m.values()].sort((a, b) => b.pts - a.pts);
}

// ── Fin de plongée & récompenses ────────────────────────────
export function concludeDive(run, d) {
  const { total } = computeScore(run, d);
  const success = total >= d.target;
  const pearls = success ? 3 + Math.floor((total - d.target) / 4) : 0;
  run.scores.push(total);
  if (success) { run.pearls += pearls; run.diveIndex++; }
  return { total, success, pearls, last: run.diveIndex >= DIVES.length };
}

export function randomOffer(rareChance = 0.35) {
  const base = Math.random() < rareChance ? pick(POOL_RARE) : pick(POOL_COMMON);
  return makeTemplate(base);
}
export function isRare(t) {
  if (t.kind === 'coral') return !!CORALS[t.coral].rare;
  return t.halves.some((h) => SPECIES[h].rare);
}
export function cardPrice(t) { return isRare(t) ? 5 : 3; }

export function makeShop(run) {
  const owned = new Set(run.treasures);
  const tr = shuffle(Object.keys(TREASURES).filter((k) => !owned.has(k))).slice(0, 3);
  return {
    cards: [randomOffer(0.5), randomOffer(0.5), randomOffer(0.5), randomOffer(0.5)],
    treasures: tr,
  };
}
