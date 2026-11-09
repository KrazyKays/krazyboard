// ─────────────────────────────────────────────────────────────
//  Krazy Sea — interface
// ─────────────────────────────────────────────────────────────
import {
  SLOTS, SLOT_LABEL, SLOT_ICON, FAMILIES, RARITY, CREATURES, CORALS, CROWNS, ARTIFACTS,
  CONDITIONS, ZONES, NODE_TYPES, DIVERS, DEPTHS, ROWS_PER_ZONE, MUTATIONS, BASE, CARD_TYPES, KEYWORDS, GLOSS_CATS,
} from './data.js';
import * as E from './engine.js';

const app = document.getElementById('app');
const SAVE_KEY = 'krazy-sea-run-v3';
const TUTO_SAVE_KEY = 'krazy-sea-tuto-run-v1'; // l'expédition du tutoriel n'écrase jamais la vraie
const META_KEY = 'krazy-sea-meta-v2';
const KEY_PREFIX = 'krazy-sea-'; // inclut les anciennes versions ; ne touche pas aux autres sites du même domaine
const DEBUG = new URLSearchParams(location.search).has('debug');

// ── Stockage ────────────────────────────────────────────────
function loadJSON(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
function clearSave(key = SAVE_KEY) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

function localKeys() {
  try { return Object.keys(localStorage).filter((k) => k.startsWith(KEY_PREFIX)); } catch { return []; }
}

// tips : Découvertes déjà lues ; tipsOff : le joueur les a masquées.
// glossOff : catégories de définitions (GLOSS_CATS) que le joueur ne veut plus voir dans les infobulles.
// animSpeed : clé de ANIM_SPEEDS ; tipMode : clé de TIP_MODES.
const newMeta = () => ({ runs: 0, wins: 0, bestZone: 0, bosses: 0, depth: 0, seenC: [], seenK: [], daily: {}, tips: [], tipsOff: false, glossOff: [],
  animSpeed: 'normal', tipMode: 'instant' });
const storedMeta = loadJSON(META_KEY, {});
const meta = Object.assign(newMeta(), storedMeta);
// Un joueur qui a déjà des expéditions derrière lui ne reçoit pas les Découvertes d'office.
if (storedMeta.tipsOff === undefined) meta.tipsOff = meta.runs > 0;
const saveMeta = () => saveJSON(META_KEY, meta);
const glossOn = (cat) => !meta.glossOff.includes(cat);

// Vitesse des animations de score : un facteur appliqué aux durées (0 = résultat affiché d'emblée).
const ANIM_SPEEDS = { normal: { name: 'Normale', k: 1 }, fast: { name: 'Rapide', k: 0.4 }, off: { name: 'Instantanée', k: 0 } };
const animK = () => (ANIM_SPEEDS[meta.animSpeed] || ANIM_SPEEDS.normal).k;
function applyAnimSpeed() {
  document.documentElement.style.setProperty('--as', animK());
  document.documentElement.classList.toggle('anim-off', animK() === 0);
}
applyAnimSpeed();

// Affichage des infobulles au survol. Le tutoriel, qui fait survoler des éléments, reste en immédiat.
const TIP_MODES = { instant: 'Immédiat', short: 'Avec délai', click: 'Au clic' };
const tipMode = () => (S.tuto || !TIP_MODES[meta.tipMode] ? 'instant' : meta.tipMode);

const S = {
  screen: 'title',
  run: null,
  ui: { sel: null, remous: false, rsel: [] },
  modal: null,
  diver: 'exploratrice',
  depth: Math.min(meta.depth, 0),
  anim: false,
  tuto: null,   // { i } pendant la partie guidée du tutoriel, jamais sauvegardée
  tipShown: null, // Découverte affichée en ce moment
  tipMoment: null, // moment de jeu de la dernière Découverte lue : une seule par moment
  tipLast: null,   // dernière Découverte lue (celles qui la suivent directement n'attendent pas)
  notice: null, // message ponctuel de l'écran titre
};

// Efface tout ce que le jeu a stocké sur cet appareil. L'expédition en mémoire est
// abandonnée aussi : sinon le prochain rendu la réécrirait aussitôt.
function wipeLocalData() {
  try { for (const k of localKeys()) localStorage.removeItem(k); } catch { /* stockage indisponible */ }
  for (const k of Object.keys(meta)) delete meta[k];
  Object.assign(meta, newMeta());
  S.run = null;
  S.tuto = null;
  S.screen = 'title';
  S.diver = 'exploratrice';
  S.depth = 0;
  S.modal = null;
  resetUI();
  lastBosses = 0;
}

function save() {
  if (S.run && !S.tuto && S.run.phase !== 'end') saveJSON(slotOf(S.run), S.run);
}
const slotOf = (r) => (r.tutorial ? TUTO_SAVE_KEY : SAVE_KEY);
const hasSave = (key = SAVE_KEY) => { const r = loadJSON(key, null); return !!(r && r.v === E.SAVE_VERSION && r.phase !== 'end'); };

// ── Utilitaires ─────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
// Jour local (et non UTC) : la plongée du jour change à minuit, heure du joueur.
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dailyLabel = (e) => (e.score < 0 ? 'en cours' : `${e.best} · ${fmt(e.pts || 0)} pts`);
const plural = (n, s, p = s + 's') => (n > 1 ? p : s);
const zoomTpl = (html) => `<template>${html}</template>`;
const typeBand = (type) => `<div class="a-type">${CARD_TYPES[type].icon} ${CARD_TYPES[type].name}</div>`;
const glossText = (text) => `data-zoom data-gloss="t" data-gloss-text="${esc(text)}"`;

function seen(list, key) { if (!meta[list].includes(key)) { meta[list].push(key); return true; } return false; }
function trackSeen() {
  const r = S.run;
  if (!r || S.tuto) return;
  let ch = false;
  for (const c of r.bag) ch = seen('seenC', c.t) || ch;
  for (const c of r.corals) ch = seen('seenK', c.t) || ch;
  if (ch) saveMeta();
}

// ── Petits composants ───────────────────────────────────────
function creatureCard(c, o = {}) {
  const def = CREATURES[c.t];
  const F = FAMILIES[def.fam];
  const pts = def.pts + (c.bonus || 0);
  const stars = c.star ? `<span class="star">${'★'.repeat(Math.min(3, c.star))}</span>` : '';
  const cls = ['card', `r-${def.rar}`, o.sel && 'sel', o.pick && 'pick', o.chosen && 'chosen', o.mini && 'mini', o.dim && 'dim']
    .filter(Boolean).join(' ');
  const act = o.action ? `data-action="${o.action}" data-id="${o.id ?? c.id}"` : '';
  const M = c.mut && MUTATIONS[c.mut];
  const tags = [def.allFam || c.mut === 'polyvalent' ? 'Toutes familles' : F.name, def.sed && 'Sédentaire', def.place && 'Pose', RARITY[def.rar].name]
    .filter(Boolean).join(' · ');
  const hatch = def.evolve && c.xp ? ` (${c.xp}/${def.evolve.after})` : '';
  const hover = o.mini ? 'data-zoom' : `data-zoom data-gloss="${['c', c.t, c.bonus || 0, c.mbonus || 0, c.star || 0, c.xp || 0, c.mut || ''].join('|')}"`;
  return `<div class="${cls}" ${act} data-t="${c.t}" style="--fam:${F.color}" ${hover}>
    ${o.mini ? zoomTpl(creatureCard(c)) : ''}<div class="c-top"><span class="c-fam">${def.allFam ? '🎨' : F.icon}</span><span class="c-type">${CARD_TYPES.creature.name}</span>${M ? `<span class="c-mut" data-tip="${esc(`${M.name} — ${M.text}`)}">${M.emoji}</span>` : ''}<span class="c-nums">${c.mbonus ? `<span class="c-pts mult" data-tip="Mult permanent">+${c.mbonus}M</span>` : ''}<span class="c-pts" data-tip="Éclat de base">${pts}</span></span></div>
    <div class="c-em">${def.emoji}</div>
    <div class="c-nm">${def.name}${stars}</div>
    <div class="c-tx">${def.text}${hatch}${M ? `<div class="c-mutx">${M.emoji} <b>${M.name}</b> : ${M.text}</div>` : ''}</div>
    <div class="c-tags">${tags}</div>
  </div>`;
}

// Une offre de créature, avec ce qu'elle apporterait à votre récif et à votre banc.
function offerCard(c, o = {}) {
  const hints = E.offerHints(S.run, c.t).map((h) => `<span class="hint ${h.strong ? 'strong' : ''}">${h.icon} ${esc(h.text)}</span>`).join('');
  return `<div class="offer-item">${creatureCard(c, o)}<div class="hints">${hints}</div>${o.extra || ''}</div>`;
}

const mutationCard = (m, extra = '') => `<div class="artifact mutation" data-zoom data-gloss="m|${m}">${typeBand('mutation')}<div class="a-em">${MUTATIONS[m].emoji}</div><div class="a-nm">${MUTATIONS[m].name}</div><div class="a-tx">${MUTATIONS[m].text}</div>${extra}</div>`;

// Avancement des écosystèmes : composition de votre banc par famille.
// `aim` : familles visées par une offre, soulignées pour comparer d'un coup d'œil.
function ecoChips(r, onlyActive = false, aim = []) {
  return E.ecoStatus(r).filter((e) => !onlyActive || e.tier).map((e) => {
    const goal = e.next ? e.next.n : e.tier.n;
    const lines = e.eco.tiers.map((t) => `Dès ${t.n} : ${t.text}`).join(' | ');
    const tip = esc(`${e.eco.name} — ${FAMILIES[e.f].name}s dans votre banc. | ${lines}`);
    return `<span class="eco ${e.tier ? 'on' : ''} ${aim.includes(e.f) ? 'aim' : ''}" data-tip="${tip}">${FAMILIES[e.f].icon}${onlyActive ? ` ${e.eco.name}` : ` ${e.n}/${goal}`}</span>`;
  }).join('');
}

function coralCard(t, o = {}) {
  const k = CORALS[t];
  const act = o.action ? `data-action="${o.action}" data-id="${o.id ?? t}"` : '';
  const lvl = o.lvl ? ` <span class="star">+${o.lvl}</span>` : '';
  const hover = o.mini ? 'data-zoom' : `data-zoom data-gloss="k|${t}"`;
  return `<div class="card coral-card r-${k.rar} ${o.pick ? 'pick' : ''} ${o.mini ? 'mini' : ''} ${o.sel ? 'sel' : ''}" ${act} style="--fam:${k.color}" ${hover}>
    ${o.mini ? zoomTpl(coralCard(t, { lvl: o.lvl })) : ''}<div class="c-top"><span class="c-fam">${CARD_TYPES.coral.icon}</span><span class="c-type">${CARD_TYPES.coral.name}</span><span class="c-pts mult" data-tip="Mult de base">×${k.mult + (o.lvl || 0)}</span></div>
    <div class="c-em">${k.emoji}</div>
    <div class="c-nm">${k.name}${lvl}</div>
    <div class="c-tx">${k.text}</div>
    <div class="c-tags">${RARITY[k.rar].name}</div>
  </div>`;
}

function artifactCard(a, extra = '') {
  const x = ARTIFACTS[a];
  return `<div class="artifact" data-zoom data-gloss="a|${a}">${typeBand('artifact')}<div class="a-em">${x.emoji}</div><div class="a-nm">${x.name}</div><div class="a-tx">${x.text}</div>${extra}</div>`;
}
const artifactChip = (a) => `<span class="chip" data-tip="${esc(`${ARTIFACTS[a].name} — ${ARTIFACTS[a].text}`)}">${ARTIFACTS[a].emoji}</span>`;
const condChip = (k) => `<span class="chip cond" data-tip="${esc(`${CONDITIONS[k].name} — ${CONDITIONS[k].text}`)}">${CONDITIONS[k].emoji} ${CONDITIONS[k].name}</span>`;
const oxygen = (r) => `<span class="o2" data-tip="Oxygène : vos points de vie. Une plongée ratée coûte 1 🫧.">${'🫧'.repeat(Math.max(0, r.oxygen))}<span class="o2-off">${'🫧'.repeat(Math.max(0, r.oxygenMax - r.oxygen))}</span></span>`;

function topbar(extra = '') {
  const r = S.run;
  const z = ZONES[r.zone];
  return `<header class="topbar">
    <div class="tb-l"><b>${z.name}</b> <span class="muted">${z.depth}${r.depth ? ` · ${DEPTHS[r.depth].name}` : ''}${r.daily ? ' · Plongée du jour' : ''}</span>${extra}</div>
    <div class="tb-c">${oxygen(r)} <span class="pearls" data-tip="Perles">⚪ ${r.pearls}</span></div>
    <div class="tb-r"><span class="arts">${r.artifacts.map(artifactChip).join('')}</span>
      <button class="btn tiny" data-action="bag">Banc (${r.bag.length})</button>
      <button class="btn tiny" data-action="rules">?</button>
      <button class="btn tiny" data-action="options" aria-label="Options" data-tip="Options">⚙</button>
      <button class="btn tiny" data-action="menu">Menu</button></div>
  </header>`;
}
const toast = () => (S.run.toast ? `<div class="toast">${esc(S.run.toast)}</div>` : '');

// ── Écran titre ─────────────────────────────────────────────
function diverUnlocked(v) {
  if (!v.unlock) return true;
  if (v.unlock.zone) return meta.bestZone >= v.unlock.zone - 1;
  if (v.unlock.boss) return meta.bosses >= v.unlock.boss;
  return true;
}
function renderTitle() {
  const divers = Object.entries(DIVERS).map(([k, v]) => {
    const ok = diverUnlocked(v);
    return `<button class="diver ${S.diver === k ? 'on' : ''} ${ok ? '' : 'locked'}" data-action="diver" data-k="${k}" ${ok ? glossText(v.text) : 'disabled'}>
      <div class="em">${ok ? v.emoji : '🔒'}</div><div class="nm">${v.name}</div>
      <div class="tx">${ok ? v.text : v.unlock.text}</div></button>`;
  }).join('');
  const depths = DEPTHS.map((dp, i) => (i <= meta.depth
    ? `<button class="btn tiny ${S.depth === i ? 'primary' : ''}" data-action="depth" data-i="${i}" data-tip="${esc(dp.text)}">${i === 0 ? 'Surface' : i}</button>` : '')).join('');
  const daily = meta.daily[today()];
  const firstTime = !meta.tuto && !meta.runs && !hasSave();
  const tutoSave = hasSave(TUTO_SAVE_KEY);
  const notice = S.notice;
  S.notice = null;
  app.innerHTML = `<div class="title-screen">
    <img class="pixel-logo" src="favicon.svg" alt="">
    <div class="logo">Krazy Sea</div>
    <p class="pitch">Composez des <b>couronnes de créatures</b> autour de vos coraux et déclenchez des combos
    à chaque marée. Chaque expédition part d’un récif et d’un banc <b>tirés au hasard</b> : à vous de voir ce qu’ils
    peuvent devenir, de recruter, de faire muter vos créatures… et de survivre aux gardiens des profondeurs.</p>
    <h3>Plongeur</h3>
    <div class="divers">${divers}</div>
    ${meta.depth > 0 ? `<h3>Profondeur</h3><div class="row">${depths}</div><div class="muted depth-tx">${DEPTHS.slice(1, S.depth + 1).map((d) => d.text).join(' ') || DEPTHS[0].text}</div>` : ''}
    <div class="row main-actions">
      ${hasSave() ? '<button class="btn primary" data-action="continue">Reprendre l’expédition</button>' : ''}
      ${tutoSave ? `<button class="btn ${hasSave() ? '' : 'primary'}" data-action="continue" data-slot="tuto">Reprendre l’expédition du tutoriel</button>` : ''}
      ${firstTime ? '<button class="btn primary" data-action="tuto">Tutoriel (conseillé)</button>' : ''}
      <button class="btn ${hasSave() || tutoSave || firstTime ? '' : 'primary'}" data-action="newrun">Nouvelle expédition</button>
      <button class="btn" data-action="daily" data-tip="${esc(daily
        ? `Plongée du jour — Votre essai classé : ${dailyLabel(daily)}. | ${dailyRunning() ? 'Reprenez-le pour le terminer.' : 'Vous pouvez rejouer, hors classement.'}`
        : 'Plongée du jour — Même départ et mêmes cartes pour tout le monde aujourd’hui. | Seul le premier essai est classé.')}">📅 Plongée du jour${daily ? ` (${dailyLabel(daily)})` : ''}</button>
    </div>
    <div class="row">
      ${firstTime ? '' : '<button class="btn ghost" data-action="tuto">Tutoriel</button>'}
      <button class="btn ghost" data-action="rules">Règles</button>
      <button class="btn ghost" data-action="bestiary">Bestiaire ${meta.seenC.length}/${Object.keys(CREATURES).length}</button>
      <button class="btn ghost" data-action="options">⚙ Options</button>
    </div>
    <div class="meta">Expéditions : ${meta.runs} · Victoires : ${meta.wins} · Gardiens vaincus : ${meta.bosses} · Plus profond : ${ZONES[meta.bestZone].name}</div>
    ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
  </div>`;
}

// ── Carte ───────────────────────────────────────────────────
// Repère face au gardien : la meilleure marée de la dernière plongée, comparée au rythme
// moyen qu'il faudra tenir sur ses marées (la Marée montante aide les dernières).
function pace(r, boss) {
  if (!r.bestTide) return '';
  const tides = BASE.tides + (E.has(r, 'boussole') ? 1 : 0) - (boss.cond.includes('siphon') ? 1 : 0);
  const need = E.targetFor(r, boss) / Math.max(1, tides);
  const ok = r.bestTide >= need;
  return `<div class="bc-pace ${ok ? 'ok' : 'low'}" data-tip="${esc(`Votre rythme — Meilleure marée de votre dernière plongée, face au score moyen qu’il faudra marquer à chaque marée contre le gardien. | La Marée montante renforce les dernières marées ; ses conditions peuvent vous freiner.`)}">📈 Votre meilleure marée : <b>${fmt(r.bestTide)}</b> · il faudra ~<b>${fmt(need)}</b> par marée</div>`;
}

function renderMap() {
  const r = S.run;
  const av = E.availableNodes(r);
  const W = 360; const RH = 74; const H = 40 + r.map.rows.length * RH;
  const X = (l) => 60 + l * 120; const Y = (row) => 34 + row * RH;
  let lines = ''; let nodes = ''; let info = null;
  r.map.rows.forEach((row) => row.forEach((n) => {
    if (!n) return;
    for (const l of n.links || []) {
      const m = r.map.rows[n.row + 1][l];
      const walked = r.pos && n.row === r.pos.row && n.lane === r.pos.lane && av.includes(m);
      const past = n.done && m.done;
      lines += `<line x1="${X(n.lane)}" y1="${Y(n.row)}" x2="${X(m.lane)}" y2="${Y(m.row)}" class="${past ? 'past' : walked ? 'next' : ''}"/>`;
    }
  }));
  r.map.rows.forEach((row) => row.forEach((n) => {
    if (!n) return;
    const T = NODE_TYPES[n.type];
    const isAv = av.includes(n);
    const cur = r.pos && r.pos.row === n.row && r.pos.lane === n.lane;
    const picked = isAv && S.ui.node === `${n.row}:${n.lane}`;
    const cls = ['node', `t-${n.type}`, isAv && 'av', n.done && 'done', cur && 'cur', picked && 'picked'].filter(Boolean).join(' ');
    const tip = [`${T.name} — ${T.text}`, ...(n.cond || []).map((k) => `${CONDITIONS[k].emoji} ${CONDITIONS[k].name} : ${CONDITIONS[k].text}`),
      ...(['dive', 'elite', 'boss'].includes(n.type) ? [`🏁 Objectif : ${fmt(E.targetFor(r, n))}`] : [])].join(' | ');
    const rad = n.type === 'boss' ? 28 : 21;
    if (picked) info = { T, tip, n };
    nodes += `<g class="${cls}" data-tip="${esc(tip)}" ${isAv ? `data-action="node" data-row="${n.row}" data-lane="${n.lane}" aria-label="${esc(`${T.name}${n.cond ? ` (${n.cond.map((k) => CONDITIONS[k].name).join(', ')})` : ''}`)}"` : ''}>
      <circle cx="${X(n.lane)}" cy="${Y(n.row)}" r="${rad}"/>
      <text x="${X(n.lane)}" y="${Y(n.row) + 1}" font-size="${n.type === 'boss' ? 26 : 19}">${n.done && !cur ? '✓' : T.icon}</text></g>`;
  }));
  const boss = r.map.rows[r.map.rows.length - 1][1];
  const zoneBg = ZONES[r.zone].bg;
  app.innerHTML = `<div class="screen map-screen" style="--z1:${zoneBg[0]};--z2:${zoneBg[1]}">${topbar()}
    <div class="map-wrap">
      <div class="map-col">
        <svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte de la zone">${lines}${nodes}</svg>
      </div>
      <div class="map-side">${toast()}
        ${info ? `<div class="node-info"><div>${info.tip.split(' | ').map((l, i) => (i ? `<div>${esc(l)}</div>` : `<b>${esc(l)}</b>`)).join('')}</div>
          <button class="btn primary" data-action="node" data-row="${info.n.row}" data-lane="${info.n.lane}" data-go="1">Y aller →</button></div>` : ''}
        <div class="boss-card">
          <div class="bc-h">🛡️ Gardien de la zone · objectif ${fmt(E.targetFor(r, boss))}</div>
          ${pace(r, boss)}
          ${boss.cond.map((k) => `<div class="bc-c" ${glossText(CONDITIONS[k].text)}><b>${CONDITIONS[k].emoji} ${CONDITIONS[k].name}</b> — ${CONDITIONS[k].text}</div>`).join('')}
          <div class="muted">Rater le gardien met fin à l’expédition. Le vaincre : nouveau corail et oxygène rechargé.</div>
        </div>
        <div class="legend">${Object.entries(NODE_TYPES).map(([, t]) => `<span data-tip="${esc(t.text)}">${t.icon} ${t.name}</span>`).join('')}</div>
        <h3>Votre récif</h3>
        <div class="mini-corals">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl, mini: true })).join('')}</div>
        <h3>Écosystèmes de votre banc</h3>
        <div class="eco-row">${ecoChips(r)}</div>
      </div>
    </div></div>`;
}

// ── Plongée ─────────────────────────────────────────────────
function renderDive() {
  const r = S.run; const d = r.dive; const ui = S.ui;
  const placing = d.phase === 'place';
  const info = placing ? E.scoreTide(r) : d.last;
  const node = E.nodeAt(r, r.pos.row, r.pos.lane);
  const title = d.type === 'boss' ? '🛡️ Gardien' : d.type === 'elite' ? '💀 Plongée périlleuse' : '🐟 Plongée';

  // HUD
  const pct = Math.min(100, (d.score / d.target) * 100);
  const proj = placing ? Math.min(100 - pct, (info.total / d.target) * 100) : 0;
  const tides = Array.from({ length: d.tidesMax }, (_, i) => {
    const n = i + 1;
    const st = n < d.tide || (n === d.tide && !placing) ? 'used' : n === d.tide ? 'now' : '';
    return `<span class="tide ${st}" data-tip="${d.history[i] !== undefined ? `Marée ${n} : ${fmt(d.history[i])}` : `Marée ${n}`}">🌊</span>`;
  }).join('');
  const hud = `<section class="hud">
    <div class="h-l"><div class="dname">${title} <span class="muted">· rangée ${node.row + 1}</span></div>
      <div class="conds">${d.cond.map(condChip).join('')}${ecoChips(r, true) || (d.cond.length ? '' : '<span class="muted">Aucune condition</span>')}</div></div>
    <div class="h-c">
      <div class="bar"><div class="fill ${d.score >= d.target ? 'ok' : ''}" style="width:${pct}%"></div><div class="ghost" style="left:${pct}%;width:${proj}%"></div></div>
      <div class="sc"><b data-count="${d.score}">${fmt(d.score)}</b> / ${fmt(d.target)}${placing && info.total ? ` <span class="proj">+${fmt(info.total)}</span>` : ''}</div>
    </div>
    <div class="h-r"><div class="tides" data-tip="Marées : nombre de fois où votre récif marque">${tides}</div>
      <div class="stats"><span data-tip="Remous : défaussez des créatures de votre main pour en piocher autant">🌀 ${d.remous}</span>
      <span data-tip="Créatures restantes dans la pioche / défausse">🂠 ${d.draw.length} · ♻ ${d.discard.length}</span></div></div>
  </section>`;

  // Récif
  const sel = ui.sel;
  const bridged = (ci, s) => (s === 'E' && ci < r.corals.length - 1) || (s === 'W' && ci > 0);
  const slotHTML = (ci, s) => {
    const cell = d.board[ci][s];
    const key = `${ci}:${s}`;
    if (cell) {
      const c = E.inst(r, cell.id);
      const def = CREATURES[c.t];
      const bk = info.byKey[key] || {};
      const F = FAMILIES[def.fam];
      const badges = [bk.silenced && '<span class="bdg sil" data-tip="Réduit au silence : ne marque rien à cette marée">🔇</span>', bk.times > 1 && '<span class="bdg x2">×2</span>',
        bk.mult || bk.xm > 1 ? `<span class="bdg mul ${bk.mult < 0 ? 'neg' : ''}">${[bk.mult > 0 ? `+${bk.mult}M` : bk.mult < 0 ? `−${-bk.mult}M` : '', bk.xm > 1 ? `×${bk.xm}M` : ''].filter(Boolean).join(' ')}</span>` : '', c.mut && `<span class="bdg mut" data-tip="${esc(`${MUTATIONS[c.mut].name} — ${MUTATIONS[c.mut].text}`)}">${MUTATIONS[c.mut].emoji}</span>`, cell.lock && '<span class="bdg lock" data-tip="Ne peut plus être déplacé">🔒</span>'].filter(Boolean).join('');
      const can = placing && !cell.lock && !tutoForce();
      return `<div class="slot s-${s} full ${can ? 'movable' : ''} ${bridged(ci, s) ? 'bridged' : ''}" style="--fam:${F.color}" ${can ? `data-action="unplace" data-ci="${ci}" data-s="${s}"` : ''} data-zoom>
        ${zoomTpl(creatureCard(c))}<span class="em">${def.emoji}</span><span class="nm">${def.name}${c.star ? ' ★' : ''}</span>
        <span class="pts ${!placing ? 'pop' : ''}" style="animation-delay:calc(${ci * 0.35}s * var(--as, 1))">${fmt(bk.pts || 0)}</span>${badges}</div>`;
    }
    if (E.isBlocked(r, ci, s)) {
      const kr = d.blocked.includes(key);
      return `<div class="slot s-${s} blocked" data-tip="${kr ? 'Bloqué par le Kraken pour cette marée' : 'Emplacement inexistant sur ce corail'}">${kr ? '🪢' : '✖'}</div>`;
    }
    const t = placing && sel && E.canPlace(r, sel, ci, s) && tutoAllows(ci, s);
    return `<div class="slot s-${s} ${t ? 'target' : ''} ${bridged(ci, s) ? 'bridged' : ''}" data-ci="${ci}" data-s="${s}" ${t ? 'data-action="place"' : ''}>
      <span class="ph">${SLOT_ICON[s]}</span><span class="lb">${SLOT_LABEL[s]}${bridged(ci, s) ? ' 🔗' : ''}</span></div>`;
  };
  // Buffs du corail : une pastille par bonus, avec sa valeur (+1M, ×2M…).
  const buffChip = (b) => `<span class="crown ${b.hint ? 'hint' : ''} ${b.neg ? 'neg' : ''} ${b.icon === '🌊' ? 'rising' : ''}" data-tip="${esc(`${b.name} — ${b.text}`)}">${b.icon}<span class="cn"> ${esc(b.name)}</span> <span class="bv ${b.x ? 'x' : ''}">${b.val}</span></span>`;
  const corals = r.corals.map((c, ci) => {
    const k = CORALS[c.t];
    const ci2 = info.corals[ci];
    const shown = ci2.buffs.filter((b) => placing || !b.hint);
    const crownB = shown.filter((b) => b.crown).map(buffChip).join('');
    const otherB = shown.filter((b) => !b.crown).map(buffChip).join('');
    // Pont : le Flanc ➡ de ce corail et le Flanc ⬅ du suivant. Inerte, à moitié occupé ou actif.
    const ends = ci < r.corals.length - 1 ? [d.board[ci].E, d.board[ci + 1].W].filter(Boolean).length : 0;
    const bridge = ci < r.corals.length - 1
      ? `<div class="bridge ${['', 'half', 'on'][ends]}" data-tip="${esc(`Pont — Ce Flanc ➡ et le Flanc ⬅ du corail suivant sont voisins. | ${['Posez une créature de chaque côté pour les relier.', 'Plus qu’une créature à poser de l’autre côté.', 'Actif : ces deux créatures sont voisines.'][ends]}`)}"><span class="b-ic">🔗</span></div>` : '';
    return `<div class="coral-wrap ${bridge ? 'has-bridge' : ''}"><div class="coral" style="--fam:${k.color}">
      ${slotHTML(ci, 'N')}${slotHTML(ci, 'W')}
      <div class="core" data-zoom>${zoomTpl(coralCard(c.t, { lvl: c.lvl }))}<div class="em">${k.emoji}</div><div class="nm">${k.name}</div><div class="mb">Mult ${k.mult + c.lvl}</div></div>
      ${slotHTML(ci, 'E')}${slotHTML(ci, 'S')}
      <div class="crowns tl">${crownB}</div><div class="crowns tr">${otherB}</div>
      ${bridge}
    </div>
    <div class="formula ${ci2.halved ? 'halved' : ''} ${!placing ? 'pop' : ''}" style="animation-delay:calc(${ci * 0.35 + 0.15}s * var(--as, 1))">
      <span class="ecl" data-tip="Éclat : somme des créatures">${fmt(ci2.eclat)}</span> × <span class="mlt" data-tip="Mult total">${ci2.multTot}</span> = <b>${fmt(ci2.score)}</b>
      ${ci2.halved ? `<span class="ign" data-tip="${esc(`${CONDITIONS.leviathan.name} — ${CONDITIONS.leviathan.text}`)}">🐉 ÷2</span>` : ''}
    </div></div>`;
  }).join('');
  const reef = `<section class="reef">${toast()}<div class="reef-row ${innerWidth / r.corals.length < 260 || innerHeight < 640 ? 'dense' : ''}" style="--n:${r.corals.length}">${corals}</div></section>`;

  // Barre d'action
  let bar;
  if (placing) {
    const n = E.boardCount(r);
    if (ui.remous) {
      bar = `<div class="msg">🌀 <b>Remous</b> : choisissez les créatures de votre main à renvoyer, vous en piocherez autant.</div>
        <button class="btn primary" data-action="remousok" ${ui.rsel.length ? '' : 'disabled'}>Remuer ${ui.rsel.length || ''}</button>
        <button class="btn ghost" data-action="remouscancel">Annuler</button>`;
    } else {
      const tip = sel ? 'Choisissez un emplacement <span class="glow">en surbrillance</span>.' : 'Glissez une créature vers un emplacement autour d’un corail, ou cliquez sur l’une puis sur l’autre. Glissez-la dans la main pour la ranger.';
      bar = `<div class="msg">Marée <b>${d.tide}/${d.tidesMax}</b> — ${tip}${info.factors.length ? ` <span class="badge">${info.factors.join(' · ')}</span>` : ''}</div>
        <button class="btn ghost" data-action="surrenderask" ${S.tuto ? 'disabled' : ''} data-tip="${esc(`Remonter — Abandonner cette plongée : elle compte comme ratée (${d.type === 'boss' ? 'fin de l’expédition' : '−1 🫧'}).`)}">🏳️ Remonter</button>
        <button class="btn" data-action="remous" ${d.remous > 0 && d.hand.length && !S.tuto ? '' : 'disabled'}>🌀 Remous (${d.remous})</button>
        <button class="btn primary big" data-action="launch" ${(n || !d.hand.length) && (!S.tuto || TUTO[S.tuto.i].launch) ? '' : 'disabled'}>Lancer la marée 🌊 <span class="proj-btn">+${fmt(info.total)}</span></button>`;
    }
  } else {
    const L = d.last;
    const notes = L.notes.length ? `<span class="notes">${L.notes.map(esc).join(' · ')}</span>` : '';
    const label = d.ended === 'win' ? '🎉 Objectif atteint ! Remonter' : d.ended === 'lose' ? 'Fin de la plongée' : 'Marée suivante →';
    bar = `<div class="msg">Marée ${L.tide} : <b class="tide-total" data-count="${L.total}">+${fmt(L.total)}</b>${L.factors.length ? ` <span class="badge">${L.factors.join(' · ')}</span>` : ''}${notes}</div>
      <button class="btn primary big" data-action="next">${label}</button>`;
  }

  // Main
  const force = tutoForce();
  const hand = d.hand.map((id) => {
    const c = E.inst(r, id);
    const chosen = ui.remous && ui.rsel.includes(id);
    const locked = !!force && c.t !== force.t;
    return creatureCard(c, { action: placing && !locked ? 'hand' : '', sel: !ui.remous && sel === id, pick: ui.remous, chosen, dim: locked });
  }).join('');
  const peek = E.has(r, 'lampe') && d.draw.length
    ? `<div class="peek">🔦 Prochaines : ${d.draw.slice(0, 3).map((id) => `<span data-tip="${esc(CREATURES[E.inst(r, id).t].name)}">${CREATURES[E.inst(r, id).t].emoji}</span>`).join(' ')}</div>` : '';
  const handSec = `<section class="hand"><div class="zone-label">Main <span class="muted">${d.hand.length} · pioche jusqu’à ${d.handSize} à chaque marée</span>${peek}</div>
    <div class="hand-row" style="--n:${d.hand.length}">${hand || '<div class="empty-note">Main vide.</div>'}</div></section>`;

  const zoneBg = ZONES[r.zone].bg;
  app.innerHTML = `<div class="screen dive-screen" style="--z1:${zoneBg[0]};--z2:${zoneBg[1]}">${topbar()}${hud}${reef}<section class="actionbar">${bar}</section>${handSec}</div>`;
}

// ── Récompense ──────────────────────────────────────────────
function renderReward() {
  const r = S.run; const rw = r.reward; const st = rw.stages[0];
  const head = `<h2>${rw.type === 'boss' ? '🛡️ Gardien vaincu !' : '🎉 Plongée réussie !'}</h2>
    <p>Score <b>${fmt(rw.score)}</b> / ${fmt(rw.target)} — <b>⚪ +${rw.pearls} perles</b>
    <span class="muted">(${rw.lines.map(([l, n]) => `${l} +${n}`).join(', ')})</span>${rw.type === 'boss' ? '<br>🫧 Oxygène entièrement rechargé.' : ''}</p>`;
  let body = '';
  if (!st) {
    body = ''; // dernière étape choisie : la fenêtre de choix prend le relais
  } else if (st.kind === 'creature') {
    body = `<h3>Une créature rejoint votre banc</h3><div class="offer">${st.options.map((t) => offerCard({ t, mut: st.muts && st.muts[t] }, { action: 'reward', id: t })).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+3 perles)</button>`;
  } else if (st.kind === 'artifact') {
    body = `<h3>Choisissez un artefact</h3><div class="offer">${st.options.map((a) => artifactCard(a, `<button class="btn primary" data-action="reward" data-id="${a}">Prendre</button>`)).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+4 perles)</button>`;
  } else if (st.kind === 'coral') {
    const full = E.reefFull(r);
    body = `<h3>${full ? `Récif plein (${BASE.maxCorals} coraux) : un nouveau corail en remplacerait un` : 'Un nouveau corail pousse dans votre récif'}</h3><div class="offer">${st.options.map((t) => coralCard(t, { action: 'reward', id: t })).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">${full ? 'Passer (+1 Mult à tous vos coraux)' : 'Passer (+5 perles)'}</button>`;
  } else if (st.kind === 'mutation') {
    body = `<h3>Le gardien laisse une trace : choisissez une mutation</h3><div class="offer">${st.options.map((m) => mutationCard(m, `<button class="btn primary" data-action="reward" data-id="${m}">Choisir</button>`)).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+4 perles)</button>`;
  }
  // Rappel de l'écosystème actuel : de quoi juger ce que chaque carte apporterait.
  const aim = st && st.kind === 'creature' ? st.options.map((t) => CREATURES[t].fam) : [];
  const active = E.ecoStatus(r).filter((e) => e.tier);
  const recap = st ? `<div class="reward-eco">
      <div class="kit-head"><h3>🌿 Votre écosystème actuel</h3><span class="muted">${r.bag.length} créatures · ${r.corals.length} coraux${aim.length ? ' · souligné : familles proposées' : ''}</span></div>
      <div class="kit-row">
        <div class="kit-group"><div class="kit-lbl">${CARD_TYPES.coral.icon} Vos coraux</div><div class="mini-corals">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl, mini: true })).join('')}</div></div>
        <div class="kit-group"><div class="kit-lbl">Familles du banc</div><div class="eco-row">${ecoChips(r, false, aim)}</div>
          <div class="eco-active">${active.length ? active.map((e) => `<span>${FAMILIES[e.f].icon} <b>${e.eco.name}</b> : ${e.tier.text}</span>`).join('') : '<span class="muted">Aucun bonus d’écosystème actif pour l’instant.</span>'}</div></div>
      </div>
    </div>` : '';
  app.innerHTML = `<div class="screen">${topbar()}<div class="between">${head}${recap}${body}</div></div>`;
}

// ── Draft de départ ─────────────────────────────────────────
function renderDraft() {
  const r = S.run; const dr = r.draft;
  const round = dr.picks.length + 1;
  const counts = {};
  for (const c of r.bag) (counts[c.t] = counts[c.t] || { c, n: 0 }).n++;
  // Le kit de départ en mini-cartes, une par espèce : ce que vous avez déjà, avant tout choix.
  const bag = Object.values(counts).map(({ c, n }) => `<div class="kit-card ${dr.picks.includes(c.t) ? 'new' : ''}">${creatureCard(c, { mini: true })}${n > 1 ? `<span class="kit-n">×${n}</span>` : ''}</div>`).join('');
  const intro = ['Regardez ce que le hasard vous donne : quelle direction prendre ?', 'Confirmez votre direction, ou préparez une autre piste.', 'Dernier choix : une pièce maîtresse pour votre récif.'][dr.picks.length];
  const offer = (t) => offerCard({ t }, { action: 'draft', id: t });
  app.innerHTML = `<div class="screen">${topbar()}<div class="between draft">
    <h2>🎒 Préparez votre expédition · choix ${round}/${BASE.draftRounds}</h2>
    <p class="ev-tx">${intro}</p>
    <div class="draft-board">
      <div class="draft-kit">
        <div class="kit-head"><h3>🎒 Déjà dans votre sac</h3><span class="muted">offert au départ, survolez pour lire</span></div>
        <div class="kit-row">
          <div class="kit-group"><div class="kit-lbl">${CARD_TYPES.coral.icon} Vos coraux · ${r.corals.length}</div><div class="mini-corals">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl, mini: true })).join('')}</div></div>
          <div class="kit-group"><div class="kit-lbl">${CARD_TYPES.creature.icon} Votre banc · ${r.bag.length} créatures</div><div class="kit-bag">${bag}</div></div>
        </div>
        <div class="kit-eco"><span class="kit-lbl">Écosystèmes</span><div class="eco-row">${ecoChips(r)}</div></div>
      </div>
      <div class="draft-plus">＋</div>
      <h3>Ajoutez une créature à votre banc</h3>
      <div class="offer">${dr.options.map(offer).join('')}</div>
    </div>
  </div></div>`;
}

// ── Comptoir ────────────────────────────────────────────────
function renderShop() {
  const r = S.run; const s = r.shop;
  const buy = (kind, i, p) => `<button class="btn ${r.pearls >= p ? 'primary' : ''}" data-action="buy" data-kind="${kind}" data-i="${i}" ${r.pearls >= p ? '' : 'disabled'}>⚪ ${p}</button>`;
  const sold = '<div class="sold">Vendu</div>';
  const cr = s.cr.map((x, i) => (x ? offerCard({ t: x.t }, { extra: buy('cr', i, x.price) }) : sold)).join('');
  const ar = s.ar.map((x, i) => (x ? artifactCard(x.a, buy('ar', i, x.price)) : '<div class="sold short">Vendu</div>')).join('');
  const mu = (s.mu || []).map((x, i) => (x ? mutationCard(x.m, buy('mu', i, x.price)) : '<div class="sold short">Vendu</div>')).join('');
  const swapNote = E.reefFull(r) ? '<div class="hints"><span class="hint">♻️ Récif plein : remplace un corail</span></div>' : '';
  const co = s.co.map((x, i) => (x ? `<div class="offer-item">${coralCard(x.t)}${swapNote}${buy('co', i, x.price)}</div>` : sold)).join('');
  app.innerHTML = `<div class="screen">${topbar()}${toast()}<div class="between">
    <h2>🛖 Le Comptoir</h2>
    <div class="shop-top">
      <div><h3>${CARD_TYPES.creature.icon} Créatures <button class="btn tiny" data-action="reroll" ${r.pearls >= s.reroll ? '' : 'disabled'}>↻ Renouveler · ⚪ ${s.reroll}</button></h3>
        <div class="offer">${cr}</div></div>
      ${s.co.length ? `<div><h3>${CARD_TYPES.coral.icon} Bouture de corail</h3><div class="offer">${co}</div></div>` : ''}
    </div>
    <h3>${CARD_TYPES.artifact.icon} Artefacts et ${CARD_TYPES.mutation.icon} mutation</h3><div class="offer">${ar}${mu}</div>
    <div class="shop-foot">
      <button class="btn" data-action="shopremove" ${r.pearls >= r.removeCost && r.bag.length > 6 ? '' : 'disabled'}>Relâcher une créature · ⚪ ${r.removeCost}</button>
      <button class="btn" data-action="shopheal" ${r.pearls >= E.healCost(r) && r.oxygen < r.oxygenMax ? '' : 'disabled'}>+1 🫧 · ⚪ ${E.healCost(r)}</button>
      <button class="btn primary big" data-action="leave">Reprendre la route →</button>
    </div>
  </div></div>`;
}

// ── Épave (événement) ───────────────────────────────────────
function renderEvent() {
  const r = S.run; const ev = E.EVENTS[r.event.id];
  const choices = r.event.done
    ? `<p class="ev-res">${esc(r.event.msg || '')}</p><button class="btn primary" data-action="leave">Continuer →</button>`
    : ev.choices.map((c, i) => {
      const ok = !c.ok || c.ok(r);
      return `<button class="btn choice" data-action="evchoice" data-i="${i}" ${ok ? '' : 'disabled'} ${glossText(`${c.label}. ${c.text || ''}`)}><b>${esc(c.label)}</b>${c.text ? `<span>${esc(c.text)}</span>` : ''}</button>`;
    }).join('');
  app.innerHTML = `<div class="screen">${topbar()}<div class="between event">
    <div class="ev-em">${ev.emoji}</div><h2>${ev.title}</h2><p class="ev-tx">${ev.text}</p>
    <div class="choices">${choices}</div></div></div>`;
}

// ── Nurserie ────────────────────────────────────────────────
function renderRest() {
  const r = S.run;
  app.innerHTML = `<div class="screen">${topbar()}<div class="between event">
    <div class="ev-em">🍼</div><h2>La Nurserie</h2>
    <p class="ev-tx">Un recoin abrité où le récif reprend des forces avant d’affronter le gardien. Choisissez une seule option.</p>
    <div class="choices">
      <button class="btn choice" data-action="rest" data-w="heal" ${r.oxygen < r.oxygenMax ? '' : 'disabled'}><b>Reprendre son souffle</b><span>+1 🫧 Oxygène</span></button>
      <button class="btn choice" data-action="rest" data-w="upgrade" ${glossText('Amélioration ★')}><b>Faire grandir une créature</b><span>Amélioration ★ : +50 % d’Éclat de base, définitivement</span></button>
      <button class="btn choice" data-action="rest" data-w="fortify"><b>Fortifier un corail</b><span>+1 Mult permanent</span></button>
      <button class="btn choice" data-action="rest" data-w="mutate"><b>Provoquer une mutation</b><span>1 mutation parmi 3, à poser sur la créature de votre choix</span></button>
      <button class="btn choice" data-action="rest" data-w="merge" ${E.canMerge(r) ? '' : 'disabled'}><b>Fusionner deux créatures identiques</b><span>★ Éclat additionné, +1 Mult permanent, et une carte de moins au banc</span></button>
    </div></div></div>`;
}

// ── Fin d'expédition ────────────────────────────────────────
function renderEnd() {
  const r = S.run; const e = r.end;
  const top = [...r.bag].sort((a, b) => b.bonus - a.bonus)[0];
  app.innerHTML = `<div class="screen"><div class="between end">
    <div class="logo">${e.win ? '🏆' : '🫧'}</div>
    <h2>${e.tutorial && e.win ? 'Tutoriel terminé !' : e.win ? 'Les Abysses sont à vous !' : 'L’expédition s’achève'}</h2>
    <p>${e.tutorial && e.win ? 'Le gardien du Lagon est vaincu : place à une vraie expédition, à travers trois zones et leurs trois gardiens.'
      : e.win ? 'Les trois gardiens sont vaincus : votre récif entre dans la légende.' : `Vous remontez depuis <b>${ZONES[e.zone].name}</b> (rangée ${Math.min(e.row + 1, ROWS_PER_ZONE + 1)}).`}</p>
    <div class="lines">
      <div class="line"><span>Plongeur</span><b>${DIVERS[r.diverId].emoji} ${DIVERS[r.diverId].name}</b></div>
      <div class="line"><span>Plongées</span><b>${r.dives}</b></div>
      <div class="line"><span>Gardiens vaincus</span><b>${r.bosses}</b></div>
      <div class="line"><span>Points marqués</span><b>${fmt(r.points || 0)}</b></div>
      <div class="line"><span>Banc final</span><b>${r.bag.length} créatures</b></div>
      ${top && top.bonus ? `<div class="line"><span>Star de l’expédition</span><b>${CREATURES[top.t].emoji} ${CREATURES[top.t].name} (+${top.bonus})</b></div>` : ''}
      <div class="line"><span>Graine</span><b>${r.seed}</b></div>
    </div>
    ${r.depthUnlocked ? `<p class="unlock">🔓 ${DEPTHS[r.depth + 1].name} débloquée !</p>` : ''}
    ${r.daily ? `<p class="muted">📅 Plongée du jour ${r.day || ''}${r.ranked ? ' · essai classé' : ' · hors classement'}</p>` : ''}
    <div class="row">${r.daily ? '<button class="btn" data-action="share">📋 Copier mon résultat</button>' : ''}<button class="btn primary" data-action="totitle">Retour au menu</button></div>
  </div></div>`;
}

// ── Fenêtres ────────────────────────────────────────────────
const RULES = `
  <h4>But</h4><p>Traverser trois zones — le <b>Lagon</b>, le <b>Tombant</b> et les <b>Abysses</b> — et vaincre leurs trois gardiens.</p>
  <h4>La carte</h4><p>Choisissez votre route : 🤿 plongées, 💀 plongées périlleuses (condition + artefact), ❓ épaves (rencontres),
  🛖 comptoir, 🍼 nurserie. Le 🛡️ gardien de chaque zone est annoncé à l’avance : préparez-vous en conséquence.</p>
  <h4>Une plongée</h4><p>Atteignez l’<b>objectif</b> en un nombre limité de <b>marées</b> 🌊. À chaque marée, vous piochez des créatures
  de votre <b>banc</b>, puis vous les posez autour de vos coraux. Quand vous lancez la marée, chaque corail marque :</p>
  <p class="formula-ex"><b>Éclat</b> (la somme des créatures posées) × <b>Mult</b> (celui du corail + les bonus)</p>
  <p>Ensuite, les créatures retournent dans la défausse, sauf les <b>Sédentaires</b>, qui restent en place. Les créatures non posées restent en main.
  🌀 <b>Remous</b> : renvoyez des créatures de votre main pour en piocher autant.</p>
  <h4>Associations</h4><ul>
  <li><b>Voisins</b> : sur une couronne, chaque emplacement touche ses deux voisins (Surface ⬆ touche les deux Flancs, etc.). La case d’en face est l’<b>opposée</b>.</li>
  <li><b>Ponts</b> 🔗 : le Flanc ➡ d’un corail touche le Flanc ⬅ du corail suivant. Le lien entre les deux coraux s’illumine quand les deux créatures sont posées.</li>
  <li><b>Surface ⬆ / Fond ⬇</b> : certaines créatures y sont plus fortes.</li>
  <li><b>Couronnes</b> : 💠 Couronne complète (+1 Mult) · 🎯 Harmonie, une seule famille (Mult ×2) · 🌈 Mosaïque, que des familles différentes (Mult ×1,5).</li>
  <li><b>Buffs</b> : chaque bonus actif s’affiche près de son corail avec sa valeur (<b>+1M</b>, <b>×2M</b>). Une pastille pâle signale qu’il ne manque plus qu’une créature.</li></ul>
  <h4>Construire son banc</h4><ul>
  <li><b>Départ</b> : 2 coraux et 9 créatures au hasard, puis 3 choix de 1 créature parmi 3. Les offres penchent vers ce que votre récif et votre banc mettent en valeur.</li>
  <li><b>Récif</b> 🪸 : 4 coraux au maximum. Si vous en prenez un cinquième, retirez-en un parmi les 5.</li>
  <li><b>Écosystèmes</b> 🌿 : à partir d’un certain nombre de créatures d’une même famille dans votre banc, toute la famille reçoit un bonus.</li>
  <li><b>Mutations</b> 🧬 : un modificateur sur une créature précise (Écho, Fidèle, Caméléon…). Nurserie, comptoir, épaves et gardiens en proposent.</li>
  <li><b>Fusion</b> ★ : deux créatures identiques n’en font plus qu’une, bien plus forte. Un banc plus fin pioche plus souvent ses meilleures cartes.</li>
  <li><b>Éphémère</b> : une seule fois par plongée. <b>Fidèle</b> : revient en main après la marée. <b>Éclosion</b> : devient une autre créature après quelques marées jouées, pour toujours.</li>
  <li><b>Parasites</b> ☣️ : ces cartes encombrent votre banc. Relâchez-les au comptoir, ou faites-les manger par un Orque ou un Labre.</li></ul>
  <h4>Roguelike</h4><p>🫧 <b>Oxygène</b> : une plongée ratée vous en coûte 1 ; à zéro, l’expédition s’arrête. Rater un gardien y met fin aussitôt.
  Les marées non utilisées rapportent des perles. Certaines créatures <b>grandissent</b> ou en <b>dévorent</b> d’autres, et ces changements sont permanents.
  Atteindre les Abysses débloque une <b>Profondeur</b> plus difficile.
  🌊 <b>Marée montante</b> : à chaque marée d’une plongée, vos coraux gagnent +1 Mult. Une plongée sans espoir ? 🏳️ <b>Remonter</b> l’abandonne (elle compte comme ratée).</p>
  <h4>Astuces</h4><p>Survolez une carte pour lire la définition de ses mots-clés et voir les cartes qu’elle cite, comme la forme éclose d’un Œuf de requin.
  Le bandeau en haut d’une carte indique son type : 🐾 créature, 🪸 corail, 🏺 artefact ou 🧬 mutation.
  Glissez-déposez les créatures pour les poser, les déplacer ou les échanger sur le récif, les reprendre en main ou choisir l’ordre de votre main.</p>`;

// Grille calculée pour que toutes les cartes tiennent dans la fenêtre.
function collGrid(n, reserved) {
  const w = Math.min(1276, innerWidth - 76);
  const h = Math.max(120, innerHeight - reserved);
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / (h * 1.1))));
  return `--cols:${cols};--rows:${Math.ceil(n / cols)}`;
}

// Cartes réparties en groupes titrés, avec le même nombre de colonnes partout.
function collGroups(groups, reserved) {
  const w = Math.min(1276, innerWidth - 76);
  const h = Math.max(120, innerHeight - reserved - groups.length * 24);
  const rows = (cols, g) => Math.ceil(g.cards.length / cols);
  const maxCols = Math.max(1, ...groups.map((g) => g.cards.length));
  let cols = 1;
  while (cols < maxCols && (w * groups.reduce((a, g) => a + rows(cols, g), 0)) / (cols * h) > 1.1) cols++;
  return `<div class="coll-groups">${groups.map((g) => `<div class="coll-group" style="--rows:${rows(cols, g)}">
    <h3>${g.label} · ${g.cards.length}</h3>
    ${g.cards.length ? `<div class="coll" style="--cols:${cols};--rows:${rows(cols, g)}">${g.cards.join('')}</div>` : ''}</div>`).join('')}</div>`;
}
// Ordre de lecture des créatures : famille (ordre des écosystèmes), rareté, nom,
// puis à espèce égale la plus forte d'abord.
const FAM_ORDER = Object.keys(FAMILIES);
const RAR_ORDER = Object.keys(RARITY);
const byKind = (ta, tb) => {
  const a = CREATURES[ta]; const b = CREATURES[tb];
  return FAM_ORDER.indexOf(a.fam) - FAM_ORDER.indexOf(b.fam)
    || RAR_ORDER.indexOf(a.rar) - RAR_ORDER.indexOf(b.rar)
    || a.name.localeCompare(b.name, 'fr');
};
const bySpecies = (a, b) => byKind(a.t, b.t) || (b.star || 0) - (a.star || 0) || (b.bonus || 0) - (a.bonus || 0);

// ── Options ─────────────────────────────────────────────────
// Un interrupteur accessible : le libellé dit ce qu'il règle, l'état est porté par aria-checked.
function optSwitch(on, action, title, sub, extra = '') {
  return `<button class="opt" role="switch" aria-checked="${on}" data-action="${action}" ${extra}>
    <span class="opt-tx"><span class="opt-t">${title}</span><span class="opt-s">${sub}</span></span>
    <span class="sw" aria-hidden="true"></span></button>`;
}
// Choix exclusif : un groupe de boutons radio présenté comme un sélecteur segmenté.
function optChoice(title, sub, action, cur, choices) {
  return `<div class="opt opt-c"><span class="opt-tx"><span class="opt-t">${title}</span><span class="opt-s">${sub}</span></span>
    <span class="seg" role="radiogroup" aria-label="${esc(title)}">${Object.entries(choices).map(([k, label]) =>
    `<button role="radio" aria-checked="${k === cur}" data-action="${action}" data-v="${k}">${label}</button>`).join('')}</span></div>`;
}
const TIP_MODE_TEXT = {
  instant: 'Elles s’affichent dès que le pointeur passe dessus.',
  short: 'Elles attendent un court instant sous le pointeur : plus de bulles qui surgissent en déplaçant une créature.',
  click: 'Cliquez sur une pastille, ou faites un clic droit sur une carte ou un bouton.',
};
function optionsHTML() {
  const terms = (cat) => KEYWORDS.filter((k) => k.cat === cat).map((k) => k.name).join(', ');
  const gloss = Object.entries(GLOSS_CATS).map(([cat, C]) => optSwitch(glossOn(cat), 'glosstoggle', `${C.icon} ${C.name}`,
    esc(C.text || terms(cat)), `data-cat="${cat}"`)).join('');
  return `<div class="modal-bg" data-action="closemodal"><div class="modal options" data-stop>
    <h2>⚙ Options</h2>
    <h3>Animations</h3>
    <div class="opt-list">${optChoice('⏩ Vitesse', 'Apparition des scores et décompte du total à la fin d’une marée.', 'animspeed', meta.animSpeed,
      Object.fromEntries(Object.entries(ANIM_SPEEDS).map(([k, v]) => [k, v.name])))}</div>
    <h3>Infobulles</h3>
    ${noHover() ? '' : `<div class="opt-list">${optChoice('🖱️ Affichage', TIP_MODE_TEXT[meta.tipMode] || TIP_MODE_TEXT.instant, 'tipmode', meta.tipMode, TIP_MODES)}</div>`}
    <p class="muted">Quand un texte cite un terme, sa définition s’affiche à côté. Masquez celles que vous connaissez déjà pour alléger l’écran.</p>
    <div class="opt-list">${gloss}</div>
    <h3>Aide</h3>
    <div class="opt-list">${optSwitch(!meta.tipsOff, 'tipstoggle', '💡 Découvertes',
      esc(`Les règles avancées vous sont présentées une à une, la première fois que vous les rencontrez. ${meta.tips.length}/${TIPS.length} déjà lues.`))}</div>
    <h3>Données</h3>
    <div class="row"><button class="btn ghost" data-action="wipeask" ${localKeys().length ? '' : 'disabled'}>🗑 Effacer mes données</button></div>
    <button class="btn primary" data-action="closemodal">Fermer</button></div></div>`;
}

function modalHTML() {
  const r = S.run;
  if (r && r.pending) {
    const p = r.pending;
    if (p.purpose === 'mutchoice') {
      return `<div class="modal-bg"><div class="modal">
        <h2>🧬 Choisissez une mutation</h2>
        <div class="mut-list">${p.options.map((m) => mutationCard(m, `<button class="btn primary" data-action="mutchoice" data-m="${m}">Choisir</button>`)).join('')}</div></div></div>`;
    }
    if (p.purpose === 'reorder') {
      return `<div class="modal-bg"><div class="modal wide coral-drop">
        <h2>🌀 Réorganisez votre récif</h2>
        <p class="muted">${p.sel == null ? 'Choisissez un corail, puis celui avec lequel l’échanger.' : 'Choisissez le corail avec lequel l’échanger.'} De gauche à droite, chaque corail touche ses voisins par ses Flancs.</p>
        <div class="offer">${r.corals.map((c) => `<div class="offer-item">${coralCard(c.t, { action: 'pick', id: c.id, lvl: c.lvl, pick: true, sel: c.id === p.sel })}</div>`).join('')}</div>
        <button class="btn primary" data-action="reorderdone">Terminer</button>
      </div></div>`;
    }
    if (p.purpose === 'dropcoral') {
      return `<div class="modal-bg"><div class="modal wide coral-drop">
        <h2>🪸 Récif plein : quel corail retirer ?</h2>
        <p class="muted">Votre récif accueille ${BASE.maxCorals} coraux au maximum. Le corail retiré perd ses améliorations.</p>
        <div class="offer">${r.corals.map((c) => `<div class="offer-item">${coralCard(c.t, { action: 'pick', id: c.id, lvl: c.lvl, pick: true })}${c.id === p.newId ? '<div class="up">Nouveau</div>' : ''}</div>`).join('')}</div>
      </div></div>`;
    }
    const titles = { remove: 'Relâcher une créature', sell: 'Céder une créature aux pêcheurs', upgrade: 'Faire grandir une créature ★', duplicate: 'Dupliquer une créature', fortify: 'Fortifier un corail',
      merge: 'Fusionner deux créatures identiques ★', mutate: p.mut ? `${MUTATIONS[p.mut].emoji} ${MUTATIONS[p.mut].name} : à quelle créature ?` : '' };
    // Fusion : une fois la première créature choisie, seuls ses doubles restent proposés.
    const mergeBase = p.purpose === 'merge' && p.sel != null ? r.bag.find((c) => c.id === p.sel) : null;
    const eligible = r.bag.filter((c) => E.pickable(r, c, p.purpose) && (!mergeBase || c.t === mergeBase.t));
    let items;
    const pickItem = (c) => {
      const ex = p.purpose === 'upgrade' ? `<div class="up">+${E.upgradeAmount(r, c)}</div>`
        : p.purpose === 'mutate' && c.mut ? `<div class="up">remplace ${MUTATIONS[c.mut].name}</div>`
        : mergeBase && c === mergeBase ? '<div class="up">Choisie</div>' : '';
      return `<div class="offer-item">${creatureCard(c, { action: 'pick', pick: true, mini: true, sel: c === mergeBase })}${ex}</div>`;
    };
    const hint = p.purpose === 'merge'
      ? `<p class="muted">${mergeBase ? 'Choisissez maintenant son double (cliquez de nouveau sur la première pour changer).' : 'Choisissez la première créature à fusionner.'}</p>` : '';
    const sorted = [...eligible].sort(bySpecies);
    if (p.purpose === 'fortify') {
      items = r.corals.map((c) => coralCard(c.t, { action: 'pick', id: c.id, lvl: c.lvl, pick: true, mini: true })).join('');
    } else if (p.purpose !== 'mutate') {
      items = sorted.map(pickItem).join('');
    }
    const list = p.purpose === 'mutate'
      ? collGroups([
        { label: 'Sans mutation', cards: sorted.filter((c) => !c.mut).map(pickItem) },
        { label: 'Déjà mutées', cards: sorted.filter((c) => c.mut).map(pickItem) },
      ], 130)
      : `<div class="coll" style="${collGrid(p.purpose === 'fortify' ? r.corals.length : eligible.length, 130)}">${items}</div>`;
    return `<div class="modal-bg"><div class="modal wide">
      <h2>${titles[p.purpose]}${p.cost ? ` · ⚪ ${p.cost}` : ''}</h2>
      ${hint}
      ${list}
      ${p.cancel ? '<button class="btn" data-action="pickcancel">Annuler</button>' : ''}</div></div>`;
  }
  if (!S.modal) return '';
  if (S.modal === 'rules') {
    return `<div class="modal-bg" data-action="closemodal"><div class="modal rules" data-stop>
      <h2>Règles de Krazy Sea</h2><div class="cols">${RULES}</div>
      <button class="btn primary" data-action="closemodal">Compris !</button></div></div>`;
  }
  if (S.modal === 'surrender') {
    const boss = r.dive.type === 'boss';
    return `<div class="modal-bg" data-action="closemodal"><div class="modal" data-stop>
      <h2>🏳️ Remonter à la surface ?</h2>
      <p class="wipe-tx">La plongée s’arrête et compte comme <b>ratée</b> : ${boss ? 'face au gardien, <b>l’expédition prend fin</b>.' : `vous perdez <b>1 🫧</b> (il vous en reste ${r.oxygen}).`}</p>
      <div class="row"><button class="btn primary" data-action="closemodal">Continuer à plonger</button>
        <button class="btn danger" data-action="surrenderok">Remonter</button></div></div></div>`;
  }
  if (S.modal === 'wipe') {
    const lost = [
      (hasSave() || hasSave(TUTO_SAVE_KEY)) && 'votre expédition en cours',
      'vos statistiques et vos scores de plongée du jour',
      'les plongeurs et les Profondeurs débloqués',
      'votre bestiaire',
      'vos options',
    ].filter(Boolean);
    return `<div class="modal-bg" data-action="closemodal"><div class="modal" data-stop>
      <h2>🗑 Effacer vos données ?</h2>
      <p class="wipe-tx">Le jeu reviendra à zéro sur ce navigateur. Cette action est définitive et supprimera :</p>
      <ul class="wipe-list">${lost.map((l) => `<li>${l}</li>`).join('')}</ul>
      <div class="row"><button class="btn primary" data-action="options">Annuler</button>
        <button class="btn danger" data-action="wipeok">Tout effacer</button></div></div></div>`;
  }
  if (S.modal === 'options') return optionsHTML();
  if (S.modal === 'bag') {
    // Pendant une plongée, le banc se lit par pile. Tri par espèce dans chacune :
    // l'ordre réel de la pioche reste secret.
    const d = r.phase === 'dive' ? r.dive : null;
    const sorted = [...r.bag].sort(bySpecies);
    const item = (c, note = '') => `<div class="offer-item">${creatureCard(c, { mini: true })}${note ? `<div class="muted">${note}</div>` : ''}</div>`;
    const reserved = 200 + Math.max(72, Math.min(100, innerHeight * 0.12));
    let list = `<div class="coll" style="${collGrid(r.bag.length, reserved)}">${sorted.map((c) => item(c)).join('')}</div>`;
    if (d) {
      const piles = [d.discard, d.draw, d.exhausted];
      const inPile = (pile) => sorted.filter((c) => pile.includes(c.id)).map((c) => item(c));
      const inPlay = sorted.filter((c) => !piles.some((pile) => pile.includes(c.id)));
      const groups = [
        { label: '♻ Défausse', cards: inPile(d.discard) },
        { label: '🂠 Pioche', cards: inPile(d.draw) },
        { label: '🌊 En jeu', cards: inPlay.map((c) => item(c, d.hand.includes(c.id) ? 'en main' : 'récif')) },
      ];
      if (d.exhausted.length) groups.push({ label: '🚫 Épuisées', cards: inPile(d.exhausted) });
      list = collGroups(groups, reserved);
    }
    return `<div class="modal-bg" data-action="closemodal"><div class="modal wide" data-stop>
      <h2>Votre banc · ${r.bag.length} créatures</h2>
      <div class="eco-row">${ecoChips(r)}</div>
      ${list}
      <div class="bag-foot">
        <div><h3>Coraux</h3><div class="list">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl, mini: true })).join('')}</div></div>
        ${r.artifacts.length ? `<div><h3>Artefacts</h3><div class="list">${r.artifacts.map(artifactChip).join('')}</div></div>` : ''}
      </div>
      <button class="btn" data-action="closemodal">Fermer</button></div></div>`;
  }
  if (S.modal === 'bestiary') {
    const unknown = '<div class="card mini unknown"><div class="c-em">❔</div><div class="c-nm">???</div></div>';
    const cr = Object.keys(CREATURES).sort(byKind).map((t) => (meta.seenC.includes(t) ? creatureCard({ t }, { mini: true }) : unknown));
    const co = Object.keys(CORALS).map((t) => (meta.seenK.includes(t) ? coralCard(t, { mini: true }) : unknown));
    return `<div class="modal-bg" data-action="closemodal"><div class="modal wide" data-stop>
      <h2>Bestiaire · ${meta.seenC.length}/${cr.length} créatures · ${meta.seenK.length}/${co.length} coraux</h2>
      <div class="coll" style="${collGrid(cr.length + co.length, 130)}">${cr.join('')}${co.join('')}</div>
      <button class="btn" data-action="closemodal">Fermer</button></div></div>`;
  }
  return '';
}

// ── Tutoriel ────────────────────────────────────────────────
// Le tutoriel n'enseigne que le cœur du jeu, sur la première plongée d'une expédition au
// départ fixé : l'objectif, la main, poser, Éclat × Mult, les voisins, lancer la marée.
// Tout le reste (couronnes, ponts, carte, comptoir…) arrive ensuite par les Découvertes.
// Les étapes `done` attendent une action du joueur ; les autres se lisent et bloquent l'écran.
const dive = () => S.run.dive;
// `focus` : les détails dont parle le texte, chacun cerné à l'écran par un repère. Les
// repères s'annoncent d'une onde, un par un dans l'ordre de lecture, puis restent fixes :
// seul ce qui attend une action bouge. `fl(i, mot, ton)` relie un mot du texte au repère i,
// qui prend son ton (ecl jaune, mlt rose) ; survoler le mot éclaire ce repère et atténue
// les autres. Les Découvertes (TIPS) acceptent le même champ `focus`.
const fl = (i, word, tone = '') => `<span class="tlink ${tone}" data-fi="${i}">${word}</span>`;
const TUTO = [
  { target: () => '.hud', title: 'Le but', focus: ['.h-c .sc', '.tides', '.h-c .bar'],
    text: () => `Une plongée, c'est un ${fl(0, 'objectif de points')} à atteindre en 4 ${fl(1, 'marées 🌊')}. ${fl(2, 'La barre')} se remplit à chaque marée.` },
  { target: () => '.hand', title: 'Vos créatures', focus: ['.hand .c-pts'],
    text: () => `Voici votre main, piochée dans votre banc. Chaque créature a un ${fl(0, 'Éclat', 'ecl')}, la pastille en haut à droite : ce qu'elle rapporte une fois posée.` },
  { title: 'Posez une créature', force: { t: 'sardine', ci: 0, s: 'N' }, focus: () => (S.ui.sel ? ['.coral-wrap:first-child .core'] : []),
    text: () => (S.ui.sel
      ? `Posez-la sur la <b>Surface ⬆</b> de l'Anémone, l'emplacement <span class="glow">en surbrillance</span>. ${fl(0, 'L\'Anémone')} donne +3 Éclat aux Poissons posés dessus.`
      : `Cliquez sur une <b>Sardine</b>, ou faites-la glisser vers la <b>Surface ⬆</b> de l'Anémone.`) },
  { title: 'Les voisins', force: { t: 'sardine', ci: 0, s: 'W' }, focus: () => (S.ui.sel ? ['.coral-wrap:first-child .slot.s-N'] : []),
    text: () => (S.ui.sel
      ? `Posez-la sur le <b>Flanc ⬅</b>, juste à côté de ${fl(0, 'la première')} : les deux Sardines se touchent.`
      : `Les créatures qui se touchent s'entraident. Une Sardine gagne <b>+2 Éclat par Sardine voisine</b> : prenez la deuxième Sardine de votre main.`) },
  { title: 'La Crevette nettoyeuse', force: { t: 'crevette', ci: 0, s: 'E' },
    text: () => (S.ui.sel
      ? `Posez-la sur le <b>Flanc ➡</b> : elle touche la Sardine de la Surface ⬆ et le Fond ⬇. Ce Flanc peut même toucher le Corail bulle voisin par un pont 🔗 : vous le découvrirez plus tard.`
      : `La <b>Crevette nettoyeuse</b> donne +3 Éclat à chacune de ses voisines : cliquez dessus.`) },
  { title: 'Le Mult', force: { t: 'meduse', ci: 0, s: 'S' }, focus: () => (S.ui.sel ? ['.coral-wrap:first-child .slot.s-E'] : ['.coral-wrap:first-child .core .mb']),
    text: () => (S.ui.sel
      ? `Posez-la sur le <b>Fond ⬇</b> : ${fl(0, 'la Crevette')} lui donne +3 Éclat, et les 4 emplacements de l'Anémone seront occupés.`
      : `Pour l'instant, l'Anémone ${fl(0, 'multiplie par 1', 'mlt')} seulement. La <b>Méduse</b> ajoute <b>+2 Mult</b> à son corail : cliquez dessus.`) },
  { target: () => '.reef-row > .coral-wrap:first-child', title: 'Éclat × Mult',
    focus: ['.coral-wrap:first-child .formula .ecl', '.coral-wrap:first-child .formula .mlt', '.coral-wrap:first-child .core .mb', '.coral-wrap:first-child .slot.s-S .bdg.mul', '.coral-wrap:first-child .crowns.tl .crown'],
    text: () => `Chaque corail marque l'${fl(0, 'Éclat', 'ecl')} de ses créatures multiplié par son ${fl(1, 'Mult', 'mlt')}. Celui de l'Anémone est passé de 1 à <b>4</b> : ${fl(2, '1 de base', 'mlt')}, ${fl(3, '+2 pour la Méduse', 'mlt')}, ${fl(4, '+1 parce que sa couronne est complète 💠', 'mlt')}. C'est en empilant le Mult que naissent les gros scores.` },
  { title: 'Lancez la marée', launch: true, target: () => '[data-action="launch"]', focus: ['.h-c .ghost', '.proj-btn'],
    text: () => `Posez d'autres créatures si vous le voulez : plus le récif est rempli, plus la marée rapporte, et ${fl(0, 'la barre')} montre d'avance ${fl(1, 'ce qu\'elle ajoutera')}. Une erreur ? Recliquez sur une créature posée pour la reprendre. Puis cliquez sur <b>Lancer la marée</b>.`,
    done: () => dive().phase === 'scored' },
  { title: 'Vous savez jouer !', final: true, target: () => '.actionbar', focus: ['.tide-total'],
    text: () => `${fl(0, 'Les points')} s'ajoutent à votre score. Les créatures posées partent à la défausse, celles restées en main sont gardées pour la marée suivante.<br>Finissez cette plongée : le reste du jeu vous sera présenté pas à pas, au moment où vous le rencontrerez 💡.` },
];
// `force` : pose imposée ; l'étape attend cette créature à cet emplacement, rien d'autre
// n'est jouable (ni autre carte, ni autre case, ni reprise d'une créature posée).
for (const step of TUTO) {
  const f = step.force;
  if (!f) continue;
  step.target = () => (S.ui.sel ? `.slot[data-ci="${f.ci}"][data-s="${f.s}"]` : `.hand [data-t="${f.t}"]`);
  step.done = () => !!dive().board[f.ci][f.s];
}
const tutoForce = () => (S.tuto && TUTO[S.tuto.i].force) || null;
const tutoAllows = (ci, s) => { const f = tutoForce(); return !f || (f.ci === ci && f.s === s); };
// Ce que le tutoriel a déjà expliqué : ces Découvertes sont considérées comme lues.
const TUTO_COVERS = ['aftertide'];

function startTuto() {
  S.run = E.tutorialRun();
  resetUI();
  S.screen = 'game';
  S.modal = null;
  S.tuto = { i: 0 };
  // Le tutoriel relance le fil des Découvertes depuis le début.
  Object.assign(meta, { tuto: true, tips: [], tipsOff: false });
  saveMeta();
}
function endTuto() { S.tuto = null; S.run = null; lastSpot = null; resetUI(); S.screen = 'title'; }

// Bulle commune au tutoriel et aux Découvertes. `live` : le joueur agit pendant qu'elle s'affiche.
function overlay({ title, count, text, buttons, live = false, target = null, fallback = null, kind = '', focus = [], point = false }) {
  app.insertAdjacentHTML('beforeend', `
    ${live ? '' : `<div class="tuto-block ${kind}"></div>`}
    <div class="tuto-spot ${live ? '' : 'shade'} ${kind}" hidden></div>
    <div class="tuto-bubble ${kind}"><h4>${title}<span>${count}</span></h4>
      <div>${text}</div><div class="tuto-actions">${buttons}</div></div>`);
  placeFocus(focus, kind);
  placeBubble(target, fallback, point);
}

// Repères sur les détails cités : posés par-dessus l'écran (aucun conteneur ne les rogne),
// un par élément trouvé. Ils s'allument un instant à l'arrivée, l'un après l'autre, puis
// ne reviennent qu'au survol du mot qui les cite (ou à l'appui, sur écran tactile).
function placeFocus(list, kind) {
  const pad = 2;
  const tone = (i) => (app.querySelector(`.tuto-bubble .tlink.mlt[data-fi="${i}"]`) ? 'mlt' : '');
  list.forEach((sel, i) => app.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    app.insertAdjacentHTML('beforeend', `<div class="tuto-ping ${kind} ${tone(i)}" data-fi="${i}" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;--d:${i * 0.35}s"></div>`);
  }));
  const hot = (w, on) => {
    w.classList.toggle('on', on);
    app.querySelectorAll(`.tuto-ping[data-fi="${w.dataset.fi}"]`).forEach((p) => p.classList.toggle('hot', on));
  };
  app.querySelectorAll('.tuto-bubble .tlink').forEach((w) => {
    w.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && hot(w, true));
    w.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && hot(w, false));
    w.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && hot(w, !w.classList.contains('on')));
  });
}

// Avant de dessiner l'écran : il peut dépendre de l'étape (bouton de marée actif ou non).
function advanceTuto() {
  while (TUTO[S.tuto.i].done && TUTO[S.tuto.i].done()) S.tuto.i++;
}
function renderTuto() {
  const step = TUTO[S.tuto.i];
  const live = !!step.done;
  const buttons = step.final
    ? '<button class="btn" data-action="tutoend">Retour au menu</button><button class="btn primary" data-action="tutofree">Continuer la plongée</button>'
    : `<button class="btn ghost" data-action="tutoend">Quitter</button>${live ? '<span class="tuto-turn">À vous de jouer !</span>' : '<button class="btn primary" data-action="tutonext">Suivant</button>'}`;
  // La carte visée n'est peut-être pas en main : on retombe alors sur la main.
  const focus = typeof step.focus === 'function' ? step.focus() : step.focus || [];
  overlay({ title: step.title, count: `${S.tuto.i + 1}/${TUTO.length}`, text: step.text(), buttons, live, target: step.target && step.target(), fallback: '.hand', focus, point: live });
}

// ── Découvertes ─────────────────────────────────────────────
// Après le tutoriel, chaque règle avancée est présentée la première fois qu'elle apparaît
// à l'écran, toujours dans cet ordre, et au plus une par moment de jeu (une marée, un
// écran) : le joueur a le temps d'essayer avant d'apprendre la suite. `after` : ne vient
// qu'une fois cette autre Découverte lue ; avec `chain`, elle la suit sans attendre.
const placing = (r) => r.phase === 'dive' && r.dive.phase === 'place';
const stage = (r, kind) => r.phase === 'reward' && r.reward.stages[0]?.kind === kind;
const handOf = (r, f) => r.dive.hand.map((id) => E.inst(r, id)).find((c) => f(CREATURES[c.t]));
const TIPS = [
  // Préparation (vraie expédition)
  { id: 'draft', title: 'Préparer son expédition', target: '.draft-board', when: (r) => r.phase === 'draft',
    text: `En haut, ce que le hasard vous donne : 2 coraux et un banc de créatures. <b>Survolez-les</b> pour lire leurs effets. En bas, choisissez la créature qui les complète le mieux, trois fois de suite. Sous chaque offre, les avantages qu'elle apporte à votre banc.` },
  // Plongée : ce qui prolonge le cœur du jeu
  { id: 'cond', title: 'Les conditions', target: '.conds .cond', when: (r) => r.phase === 'dive' && r.dive.cond.length > 0,
    text: `Cette plongée ajoute une règle, rappelée ici : <b>survolez-la</b>. Les plongées périlleuses et les gardiens en ont toujours.` },
  { id: 'aftertide', title: 'Après la marée', target: '.actionbar', when: (r) => r.phase === 'dive' && r.dive.phase === 'scored' && !r.dive.ended,
    text: `Les créatures posées partent à la défausse, celles restées en main sont gardées. À la marée suivante, vous complétez votre main depuis la pioche.` },
  { id: 'hover', title: 'Lire une carte', target: '.hand', when: (r) => placing(r) && r.dive.tide >= 2,
    text: `<b>Survolez une carte</b> pour l'agrandir : la bulle définit ses mots-clés et montre les cartes qu'elle cite. Les pastilles et les icônes ont aussi leur bulle.` },
  { id: 'sed', title: 'Les Sédentaires', when: (r) => placing(r) && !!handOf(r, (d) => d.sed),
    target: (r) => `.hand [data-t="${handOf(r, (d) => d.sed).t}"]`,
    text: `Une créature <b>Sédentaire</b> reste sur le récif d'une marée à l'autre, jusqu'à la fin de la plongée : elle marque à chaque marée, mais garde son emplacement.` },
  { id: 'crown', title: 'Les couronnes 💠', target: '.crowns.tl .crown', when: placing,
    text: `Occupez tous les emplacements d'un corail pour former une <b>couronne complète</b> : ${fl(0, '+1 Mult', 'mlt')}. Une pastille pâle signale qu'il ne manque plus qu'une créature.`,
    focus: ['.crowns.tl .crown .bv'] },
  { id: 'harmony', title: 'Harmonie et Mosaïque', after: 'crown', target: '.crowns.tl .crown:not(.hint)', when: placing,
    text: `Une couronne d'une seule famille forme une 🎯 <b>Harmonie</b> : Mult ×2. Toutes de familles différentes, une 🌈 <b>Mosaïque</b> : Mult ×1,5. La famille est l'icône en haut à gauche de chaque carte.` },
  { id: 'bridge', title: 'Les ponts 🔗', target: '.bridge.half, .bridge.on', when: placing,
    text: `Le Flanc ➡ d'un corail et le Flanc ⬅ du suivant sont <b>voisins</b>. Posez une créature de chaque côté : le pont s'illumine et les effets de voisinage passent d'un corail à l'autre.` },
  { id: 'rising', title: 'La marée montante 🌊', target: '.crowns.tr .crown.rising', when: (r) => placing(r) && r.dive.tide >= 2,
    text: `À chaque marée d'une plongée, la mer monte : chaque corail garni gagne <b>+1 Mult</b> par marée déjà jouée. Les dernières marées rapportent davantage. Une plongée perdue d'avance ? 🏳️ <b>Remonter</b> l'abandonne (elle compte comme ratée).` },
  { id: 'remous', title: 'Le Remous 🌀', target: '[data-action="remous"]', when: (r) => placing(r) && r.dive.tide >= 2 && r.dive.remous > 0,
    text: `Une main qui ne vous plaît pas ? Le <b>Remous</b> renvoie les créatures choisies dans la pioche et vous en donne autant de nouvelles. Vous n'en avez que quelques-uns par plongée.` },
  // Entre les plongées
  { id: 'oxygen', title: 'L’oxygène 🫧', target: '.o2', when: (r) => r.oxygen < r.oxygenMax && r.phase !== 'end',
    text: `Une plongée ratée coûte 1 bulle d'<b>oxygène</b>. À zéro, l'expédition s'arrête, et rater un gardien y met fin aussitôt. Le comptoir et la nurserie en rendent.` },
  { id: 'reward', title: 'La récompense', target: '.offer', when: (r) => stage(r, 'creature'),
    text: `Une plongée réussie rapporte des perles ⚪ (plus encore si vous finissez en avance) et une créature pour votre banc. ${fl(0, 'Sous une offre')}, l'icône d'un de vos coraux signale qu'il la met en valeur.`,
    focus: ['.offer-item:first-child .hints'] },
  { id: 'map', title: 'La carte', target: '.map-col', when: (r) => r.phase === 'map',
    text: `Votre route descend de haut en bas, et chaque étape n'ouvre que celles qui lui sont reliées. <b>Survolez une étape</b> pour savoir ce qu'elle propose.` },
  { id: 'guardian', title: 'Le gardien 🛡️', after: 'map', chain: true, target: '.boss-card', when: (r) => r.phase === 'map',
    text: `Chaque zone se termine par un <b>gardien</b>, annoncé dès maintenant avec sa règle : préparez votre récif en conséquence. Le vaincre fait pousser un nouveau corail.` },
  { id: 'eco', title: 'Les écosystèmes 🌿', target: '.eco-row', when: (r) => r.phase === 'map' || r.phase === 'draft',
    text: `Votre banc compte ses créatures par famille : <b>🐟 4/7</b>, c'est 4 Poissons, et un bonus à 7. ${fl(0, 'En vert')}, le bonus est actif. Les offres l'indiquent par l'icône de la famille.`,
    focus: ['.eco-row .eco.on'] },
  { id: 'elite', title: 'Les plongées périlleuses 💀', target: '.map .t-elite.av', when: (r) => r.phase === 'map',
    text: `Plus dures, avec une condition imposée, mais elles rapportent un <b>artefact</b> en plus de la récompense habituelle.` },
  { id: 'artifact', title: 'Les artefacts 🏺', target: '.arts', when: (r) => r.phase === 'map' && r.artifacts.length > 0,
    text: `Vos <b>artefacts</b> changent les règles pour toute l'expédition. Votre plongeur en apporte un ; les plongées périlleuses, le comptoir et les épaves en donnent d'autres.` },
  { id: 'shop', title: 'Le comptoir 🛖', target: '.shop-top', when: (r) => r.phase === 'shop',
    text: `Dépensez vos perles ⚪. Pensez aussi à <b>relâcher</b> une créature : un banc plus fin pioche plus souvent ses meilleures cartes.` },
  { id: 'event', title: 'Les épaves ❓', target: '.choices', when: (r) => r.phase === 'event' && !r.event.done,
    text: `Une rencontre et un choix. Certains se paient : <b>survolez</b> une option pour lire ce qu'elle implique.` },
  { id: 'rest', title: 'La nurserie 🍼', target: '.choices', when: (r) => r.phase === 'rest',
    text: `Une seule option, à choisir selon votre récif : souffle, créature améliorée ★, corail fortifié, mutation ou fusion de deux créatures identiques.` },
  { id: 'mutation', title: 'Les mutations 🧬', target: '.artifact.mutation, .c-mut, .bdg.mut', when: () => true,
    text: `Une <b>mutation</b> se pose sur une créature précise de votre banc et la modifie pour toujours. Survolez-la pour lire son effet.` },
  { id: 'coral', title: 'Un nouveau corail', target: '.offer', when: (r) => stage(r, 'coral'),
    text: `Un corail de plus, c'est une couronne de plus à remplir. Votre récif en accueille <b>${BASE.maxCorals} au maximum</b> : au-delà, il faudra en retirer un.` },
  { id: 'parasite', title: 'Les parasites ☣️', target: '[data-action="bag"]', when: (r) => r.phase === 'map' && r.bag.some((c) => CREATURES[c.t].parasite),
    text: `Un <b>parasite</b> encombre votre banc et ne rapporte rien. Relâchez-le au comptoir, ou laissez un Orque ou un Labre nettoyeur s'en charger.` },
];

const tipTarget = (t) => (typeof t.target === 'function' ? t.target(S.run) : t.target);
// Moment de jeu : une marée de plongée, ou un écran à une étape donnée de la carte.
function tipMoment(r) {
  const at = r.pos ? `${r.zone}.${r.pos.row}.${r.pos.lane}` : r.zone;
  if (r.phase === 'dive') return `${r.seed}:dive:${at}:${r.dive.tide}`;
  return `${r.seed}:${r.phase}:${at}:${r.draft ? r.draft.picks.length : ''}`;
}
function currentTip() {
  if (!S.run || S.screen !== 'game' || meta.tipsOff || S.tuto) return null;
  const fresh = S.tipMoment !== tipMoment(S.run);
  return TIPS.find((t) => !meta.tips.includes(t.id)
    && (!t.after || meta.tips.includes(t.after))
    && (fresh || (t.chain && t.after === S.tipLast))
    && t.when(S.run) && app.querySelector(tipTarget(t))) || null;
}
function renderTip() {
  const t = currentTip();
  S.tipShown = t && t.id;
  if (!t) return;
  overlay({ title: `💡 ${t.title}`, count: `Découverte ${meta.tips.length + 1}/${TIPS.length}`, text: typeof t.text === 'function' ? t.text(S.run) : t.text, target: tipTarget(t), kind: 'tip', focus: t.focus || [],
    buttons: '<button class="btn ghost" data-action="tipsoff">Ne plus afficher</button><button class="btn primary" data-action="tipok">Compris</button>' });
}
function readTip(id) {
  if (!meta.tips.includes(id)) meta.tips.push(id);
  saveMeta();
}

// Le projecteur glisse de la cible précédente à la nouvelle : l'œil suit le mouvement.
let lastSpot = null;
function placeBubble(sel, fallback, point = false) {
  const bubble = app.querySelector('.tuto-bubble');
  const spot = app.querySelector('.tuto-spot');
  const clamp = (v, max) => Math.max(8, Math.min(v, max));
  const w = bubble.offsetWidth; const h = bubble.offsetHeight;
  const el = sel && (app.querySelector(sel) || (fallback && app.querySelector(fallback)));
  let left = (innerWidth - w) / 2; let top = (innerHeight - h) / 2;
  if (!el) app.querySelector('.tuto-block')?.classList.add('dim');
  else {
    const r = el.getBoundingClientRect();
    spot.hidden = false;
    const box = { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` };
    const moved = lastSpot && Object.keys(box).some((k) => lastSpot[k] !== box[k]);
    Object.assign(spot.style, moved ? lastSpot : box);
    if (moved) { void spot.offsetWidth; spot.classList.add('glide'); Object.assign(spot.style, box); }
    lastSpot = box;
    // Action attendue : une main désigne l'endroit, au-dessus de la cible (en dessous si elle touche le haut).
    // Pas sur un emplacement du récif : il pulse déjà, comme partout dans le jeu.
    if (point && !el.matches('.slot')) {
      const up = r.top < 60;
      const y = up ? r.bottom + 4 : r.top - 4;
      app.insertAdjacentHTML('beforeend', `<div class="tuto-point ${up ? 'up' : ''}" style="left:${r.left + r.width / 2}px;top:${y}px">${up ? '👆' : '👇'}</div>`);
    }
    // Grande cible, ou pas la place au-dessus ni en dessous : la bulle se met à côté, sans la couvrir.
    const roomV = Math.max(innerHeight - r.bottom, r.top) >= h + 20;
    const roomR = innerWidth - r.right >= w + 20; const roomL = r.left >= w + 20;
    const gap = point && !el.matches('.slot') ? 50 : 12; // la place de la main qui pointe
    const cx = r.left + r.width / 2 - w / 2; const cy = r.top + (r.height - h) / 2;
    const below = [cx, r.bottom + gap]; const above = [cx, r.top - h - gap];
    let first;
    if ((roomR || roomL) && (!roomV || r.height > innerHeight * 0.6)) first = [roomR ? r.right + 12 : r.left - w - 12, cy];
    else first = innerHeight - r.bottom >= r.top ? below : above;
    // Sur un petit écran, cette place peut cacher un repère cité par le texte (ou la main qui
    // pointe) : on essaie alors les autres côtés, puis les bords de l'écran, et on garde la
    // première place libre (à défaut, celle qui cache le moins).
    const keep = [...app.querySelectorAll('.tuto-ping, .tuto-point')].map((e) => e.getBoundingClientRect());
    const over = (x, y, b) => Math.max(0, Math.min(x + w, b.right) - Math.max(x, b.left)) * Math.max(0, Math.min(y + h, b.bottom) - Math.max(y, b.top));
    const cost = ([x, y]) => keep.reduce((n, b) => n + over(x, y, b) * 10, 0) + over(x, y, r);
    const edges = [8, innerWidth - w - 8];
    const tries = [first, below, above, [r.right + 12, cy], [r.left - w - 12, cy],
      ...edges.flatMap((x) => [[x, below[1]], [x, above[1]], [x, cy], [x, 8], [x, innerHeight - h - 8]])]
      .map(([x, y]) => [clamp(x, innerWidth - w - 8), clamp(y, innerHeight - h - 8)]);
    [left, top] = tries.reduce((best, t) => (cost(t) < cost(best) ? t : best));
  }
  bubble.style.left = `${clamp(left, innerWidth - w - 8)}px`;
  bubble.style.top = `${clamp(top, innerHeight - h - 8)}px`;
}

// ── Aperçu agrandi au survol ────────────────────────────────
const zoomEl = document.createElement('div');
zoomEl.id = 'zoom';
zoomEl.hidden = true;
document.body.append(zoomEl);
let zoomFor = null;
function hideZoom() { zoomEl.hidden = true; zoomFor = null; }

// ── Glossaire : ce qu'un texte cite (mots-clés et autres cartes) ──
const noApos = (t) => t.replace(/’/g, "'");
const wordRe = (src) => new RegExp(`(?<![\\p{L}-])(?:${src})(?![\\p{L}])`, 'gu');
const quote = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KW_RE = KEYWORDS.map((k) => ({ ...k, re: wordRe(k.match) }));
// Du nom le plus long au plus court : « Filet fantôme » ne doit pas citer l'artefact « Filet ».
const REFS = [
  ...Object.entries(CREATURES).map(([key, d]) => ({ kind: 'c', key, def: d })),
  ...Object.entries(CORALS).map(([key, d]) => ({ kind: 'k', key, def: d })),
  ...Object.entries(ARTIFACTS).map(([key, d]) => ({ kind: 'a', key, def: d })),
].map((x) => ({ ...x, re: wordRe(`${quote(noApos(x.def.name))}s?`) }))
  .sort((a, b) => b.def.name.length - a.def.name.length);

const scanCache = new Map();
function scanText(text) {
  if (scanCache.has(text)) return scanCache.get(text);
  let rest = noApos(text);
  const refs = REFS.filter((x) => {
    const found = rest.search(x.re) >= 0;
    if (found) rest = rest.replace(x.re, ' ');
    return found;
  });
  const res = { refs, keywords: KW_RE.filter((k) => rest.search(k.re) >= 0) };
  scanCache.set(text, res);
  return res;
}

const refHTML = (x) => (x.kind === 'c' ? creatureCard({ t: x.key }) : x.kind === 'k' ? coralCard(x.key) : artifactCard(x.key));
const REF_LABEL = { c: 'Créature citée', k: 'Corail cité', a: 'Artefact cité' };

// Lit une carte (ou un texte) : formes liées à montrer et définitions à afficher.
function glossOf(host) {
  const [kind, ...a] = host.dataset.gloss.split('|');
  const links = [];
  let text = host.dataset.glossText || '';
  let self = null;
  let linkedText = '';
  if (kind === 'c') {
    const [t, bonus, mbonus, star, xp, mut] = a;
    const def = CREATURES[t];
    const M = mut && MUTATIONS[mut];
    self = t;
    text = `${def.text}${M ? ` ${M.name} : ${M.text}` : ''}`;
    if (def.evolve) {
      const left = Math.max(1, def.evolve.after - xp);
      const into = def.evolve.into;
      links.push({
        key: into,
        label: `🐣 Après éclosion · dans ${left} ${plural(left, 'marée')} ${plural(left, 'jouée')}`,
        html: creatureCard({ t: into, bonus: +bonus, mbonus: +mbonus, star: +star, mut: mut || null }),
      });
      linkedText = CREATURES[into].text;
    }
  } else if (kind === 'k') { self = a[0]; text = CORALS[a[0]].text; }
  else if (kind === 'a') { self = a[0]; text = ARTIFACTS[a[0]].text; }
  else if (kind === 'm') { text = MUTATIONS[a[0]].text; }
  const main = scanText(text);
  // Cartes citées masquées : ni leur carte, ni les mots-clés de leur texte.
  const refs = glossOn('ref') ? main.refs.filter((x) => x.key !== self) : [];
  for (const x of refs) {
    if (!links.some((l) => l.key === x.key)) links.push({ key: x.key, label: REF_LABEL[x.kind], html: refHTML(x) });
  }
  const notes = [...new Set([...main.keywords, ...scanText(linkedText).keywords,
    ...refs.flatMap((x) => scanText(x.def.text).keywords)])].filter((k) => glossOn(k.cat));
  return { links, notes };
}

function showZoom(el) {
  zoomFor = el;
  const tpl = el.querySelector(':scope > template');
  const host = tpl ? tpl.content.querySelector('[data-gloss]') : el;
  // Une carte entière affiche déjà son texte : on ne la répète que s'il est coupé.
  let main = tpl ? tpl.innerHTML : '';
  if (!tpl && el.matches('.card') && el.scrollHeight > el.clientHeight) {
    const copy = el.cloneNode(true);
    copy.classList.remove('sel', 'chosen', 'pick', 'drag-src');
    main = copy.outerHTML;
  }
  const { links, notes } = host ? glossOf(host) : { links: [], notes: [] };
  if (!main && !links.length && !notes.length) { zoomEl.hidden = true; return; }
  zoomEl.innerHTML = `<div class="zoom-wrap">${main}
    ${links.map((l) => `<div class="zoom-link"><div class="zl-h">${l.label}</div>${l.html}</div>`).join('')}
    ${notes.length ? `<div class="kw-col">${notes.map((k) => `<div class="kw"><b>${k.name}</b>${k.text}</div>`).join('')}</div>` : ''}</div>`;
  zoomEl.hidden = false;
  const r = el.getBoundingClientRect();
  const w = zoomEl.offsetWidth; const h = zoomEl.offsetHeight;
  let top = r.bottom + 8;
  // Une carte de la main grandit au survol : on garde de la marge pour ne pas la couvrir.
  if (top + h > innerHeight - 8) top = r.top - h - (el.closest('.hand-row') ? 26 : 8);
  let left = r.left + r.width / 2 - w / 2;
  if (top < 8) { // ni dessous ni dessus : à côté
    top = Math.max(8, Math.min(r.top, innerHeight - h - 8));
    left = r.right + 8 + w < innerWidth ? r.right + 8 : r.left - w - 8;
  }
  zoomEl.style.left = `${Math.max(8, Math.min(left, innerWidth - w - 8))}px`;
  zoomEl.style.top = `${top}px`;
}

// ── Infobulles : instantanées, « Titre — texte | ligne | ligne » ─
const tipEl = document.createElement('div');
tipEl.id = 'tip';
tipEl.setAttribute('role', 'tooltip');
tipEl.hidden = true;
document.body.append(tipEl);
let tipFor = null;
function hideTip() { tipEl.hidden = true; tipFor = null; }
// Définitions à ajouter à une bulle titrée, sans redéfinir le sujet de la bulle.
function tipNotes(title, body) {
  const { keywords, refs } = scanText(body);
  const head = scanText(title);
  const note = (name, text) => {
    const n = document.createElement('div');
    n.className = 'tip-k';
    n.append(Object.assign(document.createElement('b'), { textContent: name }), ` ${text}`);
    return n;
  };
  return [
    ...keywords.filter((k) => glossOn(k.cat) && !head.keywords.includes(k)).map((k) => note(k.name, k.text)),
    ...(glossOn('ref') ? refs : []).filter((x) => !head.refs.includes(x)).map((x) => note(`${x.def.emoji} ${x.def.name}`, x.def.text)),
  ];
}
function showTip(el) {
  if (el === tipFor) return;
  tipFor = el;
  const part = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });
  const [first, ...lines] = el.dataset.tip.split(' | ');
  const cut = first.indexOf(' — ');
  tipEl.replaceChildren(
    ...(cut < 0 ? [part('tip-b', first)] : [part('tip-h', first.slice(0, cut)), part('tip-b', first.slice(cut + 3))]),
    ...lines.map((l) => part('tip-l', l)),
    ...(cut < 0 ? [] : tipNotes(first.slice(0, cut), [first.slice(cut + 3), ...lines].join(' '))),
  );
  tipEl.hidden = false;
  const r = el.getBoundingClientRect();
  const w = tipEl.offsetWidth; const h = tipEl.offsetHeight;
  const above = r.top - h - 10 >= 8;
  const top = above ? r.top - h - 10 : r.bottom + 10;
  const cx = r.left + r.width / 2;
  const left = Math.max(8, Math.min(cx - w / 2, innerWidth - w - 8));
  tipEl.classList.toggle('below', !above);
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${Math.max(8, Math.min(top, innerHeight - h - 8))}px`;
  tipEl.style.setProperty('--ax', `${Math.max(14, Math.min(cx - left, w - 14))}px`);
}
// Bulle en attente (mode « Avec délai ») : elle ne s'ouvre que si le pointeur reste sur le même élément.
let hoverTimer = null;
let hoverNext = null;
function hoverCancel() { clearTimeout(hoverTimer); hoverNext = null; }
function hoverShow(el, show) {
  if (hoverNext === el) return;
  hoverCancel();
  if (tipMode() === 'instant') { show(el); return; }
  hoverNext = el;
  hoverTimer = setTimeout(() => { hoverNext = null; if (el.isConnected && !drag?.ghost) show(el); }, 350);
}
function hideHover() { hoverCancel(); hideZoom(); hideTip(); }
// Ce que montre un élément : la bulle d'une pastille, ou l'aperçu agrandi d'une carte.
function hoverTarget(target) {
  const zoom = target.closest('[data-zoom]');
  let tip = target.closest('[data-tip]');
  // Sur une mini-carte, l'aperçu agrandi dit déjà tout ; une pastille posée sur une case garde sa bulle.
  if (tip && zoom && (!zoom.contains(tip) || zoom.matches('.card.mini'))) tip = null;
  return { tip, zoom };
}
document.addEventListener('mouseover', (ev) => {
  if (drag?.ghost) return;
  const { tip, zoom } = hoverTarget(ev.target);
  // Au clic : le survol ne fait que refermer ce que le pointeur a quitté.
  if (tipMode() === 'click') {
    if (tip !== tipFor) hideTip();
    if (tip || zoom !== zoomFor) hideZoom();
    return;
  }
  if (tip) { hideZoom(); hoverShow(tip, showTip); return; }
  hideTip();
  if (!zoom) { hideZoom(); hoverCancel(); } else if (zoom !== zoomFor) hoverShow(zoom, showZoom); else hoverCancel();
});
// Au clic, le clic droit ouvre la bulle de n'importe quel élément, même d'une carte ou d'un bouton.
document.addEventListener('contextmenu', (ev) => {
  if (tipMode() !== 'click') return;
  const { tip, zoom } = hoverTarget(ev.target);
  if (!tip && !zoom) return;
  ev.preventDefault();
  if (tip) { hideZoom(); showTip(tip); } else { hideTip(); showZoom(zoom); }
});
document.documentElement.addEventListener('mouseleave', hideHover);
document.addEventListener('focusin', (ev) => {
  if (!ev.target.matches || !ev.target.matches(':focus-visible')) return;
  const tip = ev.target.closest('[data-tip]'); const zoom = ev.target.closest('[data-zoom]');
  if (zoom) { hideTip(); showZoom(zoom); } else if (tip) { hideZoom(); showTip(tip); }
});
document.addEventListener('focusout', hideHover);
document.addEventListener('scroll', hideHover, true);

// ── Rendu ───────────────────────────────────────────────────
const noHover = () => matchMedia('(hover: none)').matches;
// Signature d'un élément interactif, pour lui rendre le focus après un nouveau rendu.
const FOCUS_KEYS = ['action', 'id', 'ci', 's', 'row', 'lane', 'kind', 'i', 'w', 'k', 'm', 'slot', 'go', 'cat', 'v'];
const focusSig = (el) => (el && el.dataset && el.dataset.action ? FOCUS_KEYS.map((k) => el.dataset[k] ?? '').join('|') : null);
function keyboardReady(sig) {
  for (const el of app.querySelectorAll('[data-action]:not(button):not(.modal-bg)')) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
  }
  if (!sig) return;
  const back = [...app.querySelectorAll('[data-action]')].find((el) => focusSig(el) === sig);
  if (back) back.focus({ preventScroll: true });
}

function render() {
  const sig = app.contains(document.activeElement) ? focusSig(document.activeElement) : null;
  hideHover();
  const r = S.run;
  if (S.tuto && r) advanceTuto();
  if (S.screen === 'title' || !r) renderTitle();
  else ({ draft: renderDraft, map: renderMap, dive: renderDive, reward: renderReward, shop: renderShop, event: renderEvent, rest: renderRest, end: renderEnd })[r.phase]();
  const m = modalHTML();
  if (m) app.insertAdjacentHTML('beforeend', m);
  else if (S.tuto) renderTuto();
  else renderTip();
  if (S.anim) { S.anim = false; animateCounts(); }
  trackSeen();
  save();
  keyboardReady(sig);
  if (DEBUG) Object.assign(window, { S, E, render });
}

function animateCounts() {
  const dur = 900 * animK();
  if (!dur) return; // le total est déjà écrit en entier
  for (const el of app.querySelectorAll('.tide-total[data-count]')) {
    const to = +el.dataset.count;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = `+${fmt(to * (1 - (1 - k) ** 3))}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

// ── Suivi méta ──────────────────────────────────────────────
function onRunEnd() {
  const r = S.run;
  meta.bestZone = Math.max(meta.bestZone, r.end.zone);
  if (r.end.win && !r.end.tutorial) meta.wins++;
  // Plongée du jour : seul le premier essai est classé. Score : progression, puis points marqués.
  if (r.daily && r.ranked) {
    meta.daily[r.day || today()] = { best: dailyProgress(r), score: r.end.win ? 999 : r.end.zone * 10 + r.end.row, pts: r.points || 0 };
  }
  saveMeta();
  clearSave(slotOf(r));
}
let lastBosses = 0;
const dailyProgress = (r) => (r.end.win ? '🏆' : `${ZONES[r.end.zone].name} ${Math.min(r.end.row + 1, ROWS_PER_ZONE + 1)}`);
// Un essai classé du jour est-il sauvegardé, à reprendre ?
function dailyRunning() {
  const r = loadJSON(SAVE_KEY, null);
  return !!(r && r.v === E.SAVE_VERSION && r.phase !== 'end' && r.daily && r.ranked && r.day === today());
}
function afterAction() {
  const r = S.run;
  if (!r || S.tuto) return;
  // Atteindre les Abysses à sa Profondeur la plus difficile débloque la suivante.
  if (!r.tutorial && r.zone >= 2 && r.depth === meta.depth && meta.depth < DEPTHS.length - 1 && !r.depthUnlocked) {
    r.depthUnlocked = true;
    meta.depth++;
    saveMeta();
    r.toast = `${r.toast ? `${r.toast} ` : ''}🔓 ${DEPTHS[meta.depth].name} débloquée !`;
  }
  if (r.bosses > lastBosses) { meta.bosses += r.bosses - lastBosses; lastBosses = r.bosses; saveMeta(); }
  meta.bestZone = Math.max(meta.bestZone, r.zone);
  if (r.phase === 'end' && !r.endTracked) { r.endTracked = true; onRunEnd(); }
}

function startRun(opts) {
  clearSave();
  S.run = E.newRun(opts);
  lastBosses = 0;
  S.ui = { sel: null, remous: false, rsel: [] };
  S.screen = 'game';
  meta.runs++; saveMeta();
}

// ── Interactions ────────────────────────────────────────────
const resetUI = () => { S.ui = { sel: null, remous: false, rsel: [] }; };
const handlers = {
  diver: (el) => { S.diver = el.dataset.k; },
  depth: (el) => { S.depth = +el.dataset.i; },
  newrun: () => startRun({ diverId: S.diver, depth: S.depth }),
  daily: () => {
    const day = today();
    if (dailyRunning()) { handlers.continue({ dataset: {} }); return; }
    const ranked = !meta.daily[day];
    startRun({ diverId: 'exploratrice', depth: 0, seed: E.seedFrom(`krazy-${day}`), daily: true });
    Object.assign(S.run, { day, ranked });
    if (ranked) { meta.daily[day] = { best: '', score: -1, pts: 0 }; saveMeta(); }
  },
  share: () => {
    const r = S.run;
    const txt = `🌊 Krazy Sea · Plongée du jour ${r.day || today()}\n${dailyProgress(r)} · ${fmt(r.points || 0)} pts · ${r.bosses} ${plural(r.bosses, 'gardien')}${r.ranked ? '' : ' (hors classement)'}`;
    const done = () => { const b = app.querySelector('[data-action="share"]'); if (b) b.textContent = '✅ Copié !'; };
    const ask = () => prompt('Copiez votre résultat :', txt);
    try { navigator.clipboard.writeText(txt).then(done, ask); } catch { ask(); }
  },
  surrenderask: () => { S.modal = 'surrender'; },
  surrenderok: () => { S.modal = null; E.surrender(S.run); resetUI(); },
  continue: (el) => {
    const r = loadJSON(el.dataset.slot === 'tuto' ? TUTO_SAVE_KEY : SAVE_KEY, null);
    if (r && r.v === E.SAVE_VERSION) { S.run = r; lastBosses = r.bosses; S.screen = 'game'; resetUI(); }
  },
  rules: () => { S.modal = 'rules'; },
  bestiary: () => { S.modal = 'bestiary'; },
  bag: () => { S.modal = 'bag'; },
  closemodal: () => { S.modal = null; },
  wipeask: () => { S.modal = 'wipe'; },
  wipeok: () => { wipeLocalData(); S.notice = 'Vos données locales ont été effacées.'; },
  menu: () => { S.modal = null; if (S.tuto) endTuto(); else S.screen = 'title'; },
  tuto: () => startTuto(),
  tutonext: () => { S.tuto.i++; },
  tutoend: () => endTuto(),
  // Fin du guidage : l'expédition se poursuit et compte comme une vraie, sur son propre emplacement.
  // Les Découvertes prennent le relais, après la prochaine action du joueur.
  tutofree: () => {
    S.tuto = null; lastBosses = 0; meta.runs++;
    for (const id of TUTO_COVERS) readTip(id);
    S.tipMoment = tipMoment(S.run); S.tipLast = null;
  },
  totitle: () => { S.screen = 'title'; S.run = null; },
  tipok: () => { readTip(S.tipShown); S.tipLast = S.tipShown; S.tipMoment = tipMoment(S.run); },
  tipsoff: () => { meta.tipsOff = true; saveMeta(); },
  tipstoggle: () => { meta.tipsOff = !meta.tipsOff; saveMeta(); },
  options: () => { S.modal = 'options'; },
  animspeed: (el) => { meta.animSpeed = el.dataset.v; saveMeta(); applyAnimSpeed(); },
  tipmode: (el) => { meta.tipMode = el.dataset.v; saveMeta(); },
  glosstoggle: (el) => {
    const c = el.dataset.cat;
    meta.glossOff = glossOn(c) ? [...meta.glossOff, c] : meta.glossOff.filter((x) => x !== c);
    saveMeta();
  },

  node: (el) => {
    const key = `${el.dataset.row}:${el.dataset.lane}`;
    if (noHover() && !el.dataset.go && S.ui.node !== key) { S.ui.node = key; return; }
    E.enterNode(S.run, +el.dataset.row, +el.dataset.lane);
    resetUI();
  },
  leave: () => E.backToMap(S.run),

  hand: (el) => {
    const id = +el.dataset.id;
    if (S.ui.remous) {
      const a = S.ui.rsel;
      S.ui.rsel = a.includes(id) ? a.filter((x) => x !== id) : [...a, id];
      return;
    }
    S.ui.sel = S.ui.sel === id ? null : id;
  },
  place: (el) => {
    if (!tutoAllows(+el.dataset.ci, el.dataset.s)) return;
    const notes = E.place(S.run, S.ui.sel, +el.dataset.ci, el.dataset.s);
    S.run.toast = notes && notes.length ? notes.join(' · ') : null;
    S.ui.sel = null;
  },
  unplace: (el) => {
    const id = E.unplace(S.run, +el.dataset.ci, el.dataset.s);
    if (id) S.ui.sel = id;
  },
  remous: () => { S.ui = { sel: null, remous: true, rsel: [] }; },
  remouscancel: () => resetUI(),
  remousok: () => { E.doRemous(S.run, S.ui.rsel); resetUI(); },
  launch: () => { if (E.launchTide(S.run)) { resetUI(); S.run.toast = null; S.anim = true; } },
  next: () => { S.run.toast = null; E.nextTide(S.run); resetUI(); },

  draft: (el) => E.draftChoose(S.run, el.dataset.id),
  mutchoice: (el) => E.chooseMutation(S.run, el.dataset.m),
  reward: (el) => E.rewardChoose(S.run, el.dataset.id || null),
  buy: (el) => E.shopBuy(S.run, el.dataset.kind, +el.dataset.i),
  reroll: () => E.shopReroll(S.run),
  shopheal: () => E.shopHeal(S.run),
  shopremove: () => { S.run.pending = { purpose: 'remove', cost: S.run.removeCost, then: null, cancel: true }; },
  pick: (el) => E.applyPick(S.run, +el.dataset.id),
  pickcancel: () => { S.run.pending = null; },
  reorderdone: () => { S.run.toast = '🌀 Votre récif est réorganisé.'; E.backToMap(S.run); },
  evchoice: (el) => E.eventChoose(S.run, +el.dataset.i),
  rest: (el) => E.restChoose(S.run, el.dataset.w),
};

// ── Glisser-déposer : poser, déplacer, reprendre et ranger les créatures ─
// Le récif et la main ne sont pas redessinés pendant le geste : sur écran
// tactile, retirer l'élément touché interromprait le glissement.
const DRAG_THRESHOLD = 6;
let drag = null;
let swallowClick = false;
let swallowTimer = null;
function releaseClicks() {
  if (swallowClick) swallowTimer = setTimeout(() => { swallowClick = false; }, 50);
}

function startDrag() {
  const d = drag;
  swallowClick = true;
  hideHover();
  document.body.classList.add('dragging');
  d.el.classList.add('drag-src');
  d.ghost = document.createElement('div');
  d.ghost.id = 'drag-ghost';
  d.ghost.innerHTML = creatureCard(E.inst(S.run, d.id));
  d.mark = document.createElement('div');
  d.mark.id = 'drop-mark';
  d.mark.hidden = true;
  document.body.append(d.ghost, d.mark);
  for (const s of app.querySelectorAll('.slot:not(.full):not(.blocked)')) {
    if (tutoAllows(+s.dataset.ci, s.dataset.s)) s.classList.add('target');
  }
  for (const s of app.querySelectorAll('.slot.movable')) if (s !== d.el) s.classList.add('swap');
}

function handDropIndex(x) {
  const row = app.querySelector('.hand-row');
  const cards = [...row.querySelectorAll(':scope > .card')].filter((c) => c !== drag.el).map((c) => c.getBoundingClientRect());
  const index = cards.filter((c) => c.left + c.width / 2 < x).length;
  const box = row.getBoundingClientRect();
  let markX = box.left + box.width / 2;
  if (cards.length) markX = index < cards.length ? cards[index].left - 3 : cards[index - 1].right + 3;
  return { index, markX, top: box.top, height: box.height };
}

function trackDrop(x, y) {
  const d = drag;
  d.ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(-3deg) scale(.6)`;
  const hit = document.elementFromPoint(x, y);
  const slot = hit?.closest('.slot.target, .slot.swap');
  d.over?.classList.remove('drop-over');
  d.over = slot || null;
  slot?.classList.add('drop-over');
  d.ghost.classList.toggle('over-slot', !!slot);
  d.drop = slot ? { ci: +slot.dataset.ci, s: slot.dataset.s } : null;
  d.mark.hidden = true;
  // Toute la bande de la main compte, y compris au-delà de ses bords.
  if (!slot && y >= app.querySelector('.hand').getBoundingClientRect().top) {
    const h = handDropIndex(x);
    d.drop = { index: h.index };
    d.mark.hidden = false;
    Object.assign(d.mark.style, { left: `${h.markX}px`, top: `${h.top}px`, height: `${h.height}px` });
  }
}

function endDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  document.body.classList.remove('dragging');
  d.el.classList.remove('drag-src');
  d.over?.classList.remove('drop-over');
  d.ghost?.remove();
  d.mark?.remove();
  for (const s of app.querySelectorAll('.slot:not(.full):not(.blocked)')) {
    if (s.dataset.action !== 'place') s.classList.remove('target');
  }
  for (const s of app.querySelectorAll('.slot.swap')) s.classList.remove('swap');
}

function commitDrop(d) {
  const r = S.run;
  const handPos = r.dive.hand.indexOf(d.id);
  if (d.drop.s && !tutoAllows(d.drop.ci, d.drop.s)) return;
  if (d.from) E.unplace(r, d.from.ci, d.from.s);
  if (d.drop.s) {
    // Emplacement occupé : l'occupant prend la place que quitte la créature déposée.
    const occupant = E.unplace(r, d.drop.ci, d.drop.s);
    if (occupant && d.from) E.place(r, occupant, d.from.ci, d.from.s);
    else if (occupant) E.moveInHand(r, occupant, handPos);
    const notes = E.place(r, d.id, d.drop.ci, d.drop.s);
    r.toast = notes && notes.length ? notes.join(' · ') : null;
  } else {
    E.moveInHand(r, d.id, d.drop.index);
  }
  if (S.ui.sel === d.id) S.ui.sel = null;
}

app.addEventListener('pointerdown', (ev) => {
  // Un nouvel appui : le clic du geste précédent ne peut plus arriver.
  clearTimeout(swallowTimer);
  swallowClick = false;
  if (ev.button !== 0 || !ev.isPrimary || drag || S.ui.remous) return;
  const el = ev.target.closest('.hand-row > .card[data-action="hand"], .slot.movable');
  if (!el) return;
  const from = el.matches('.slot') ? { ci: +el.dataset.ci, s: el.dataset.s } : null;
  const id = from ? S.run.dive.board[from.ci][from.s].id : +el.dataset.id;
  drag = { el, id, from, pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY };
});

document.addEventListener('pointermove', (ev) => {
  if (!drag || ev.pointerId !== drag.pointerId) return;
  if (!(ev.buttons & 1)) { endDrag(); return; }
  if (!drag.ghost) {
    if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < DRAG_THRESHOLD) return;
    startDrag();
  }
  trackDrop(ev.clientX, ev.clientY);
});

document.addEventListener('pointerup', (ev) => {
  releaseClicks();
  if (!drag || ev.pointerId !== drag.pointerId) return;
  const d = drag;
  endDrag();
  if (!d.ghost || !d.drop) return;
  commitDrop(d);
  afterAction();
  render();
});

document.addEventListener('pointercancel', () => {
  releaseClicks();
  endDrag();
});

app.addEventListener('click', (ev) => {
  if (swallowClick) return;
  const el = ev.target.closest('[data-action]');
  if (!el || (el.classList.contains('modal-bg') && ev.target.closest('[data-stop]'))) {
    // Sans survol (écran tactile) ou en mode « Au clic », toucher une pastille ou une carte affiche sa bulle.
    if (noHover() || tipMode() === 'click') {
      const tip = ev.target.closest('[data-tip]');
      const zoom = ev.target.closest('[data-zoom]');
      if (tip && !(zoom && zoom.matches('.card.mini'))) { hideZoom(); showTip(tip); } else if (zoom) { hideTip(); showZoom(zoom); } else hideHover();
    }
    if (!el) return;
  }
  if (el.dataset.action === 'closemodal' && el.classList.contains('modal-bg') && ev.target.closest('[data-stop]')) return;
  const h = handlers[el.dataset.action];
  if (!h || el.disabled) return;
  h(el, ev);
  afterAction();
  render();
});

document.addEventListener('keydown', (ev) => {
  const f = document.activeElement;
  if ((ev.key === 'Enter' || ev.key === ' ') && f && f.dataset && f.dataset.action && f.tagName !== 'BUTTON') {
    ev.preventDefault();
    f.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return;
  }
  if (ev.key !== 'Escape') return;
  if (drag) { endDrag(); return; }
  if (S.modal) S.modal = null;
  else if (S.run && S.run.phase === 'dive') resetUI();
  render();
});

window.addEventListener('resize', () => { endDrag(); render(); });

render();
