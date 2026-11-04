// ─────────────────────────────────────────────────────────────
//  Krazy Sea — interface
// ─────────────────────────────────────────────────────────────
import {
  SLOTS, SLOT_LABEL, SLOT_ICON, FAMILIES, RARITY, CREATURES, CORALS, CROWNS, ARTIFACTS,
  CONDITIONS, ZONES, NODE_TYPES, DIVERS, DEPTHS, ROWS_PER_ZONE, MUTATIONS, BASE,
} from './data.js';
import * as E from './engine.js';

const app = document.getElementById('app');
const SAVE_KEY = 'krazy-sea-run-v3';
const META_KEY = 'krazy-sea-meta-v2';
const DEBUG = new URLSearchParams(location.search).has('debug');

// ── Stockage ────────────────────────────────────────────────
function loadJSON(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

const meta = Object.assign(
  { runs: 0, wins: 0, bestZone: 0, bosses: 0, depth: 0, seenC: [], seenK: [], daily: {} },
  loadJSON(META_KEY, {}),
);
const saveMeta = () => saveJSON(META_KEY, meta);

const S = {
  screen: 'title',
  run: null,
  ui: { sel: null, remous: false, rsel: [] },
  modal: null,
  diver: 'exploratrice',
  depth: Math.min(meta.depth, 0),
  anim: false,
  tuto: null,   // { i } pendant le tutoriel : expédition d'essai, jamais sauvegardée
};

function save() {
  if (S.run && !S.tuto && S.run.phase !== 'end') saveJSON(SAVE_KEY, S.run);
}
const hasSave = () => { const r = loadJSON(SAVE_KEY, null); return !!(r && r.v === E.SAVE_VERSION && r.phase !== 'end'); };

// ── Utilitaires ─────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const today = () => new Date().toISOString().slice(0, 10);
const plural = (n, s, p = s + 's') => (n > 1 ? p : s);
const zoomTpl = (html) => `<template>${html}</template>`;

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
  const hover = o.mini ? 'data-zoom' : `data-tip="${esc(`${def.name} — ${def.text}`)}"`;
  return `<div class="${cls}" ${act} data-t="${c.t}" style="--fam:${F.color}" ${hover}>
    ${o.mini ? zoomTpl(creatureCard(c)) : ''}<div class="c-top"><span class="c-fam">${def.allFam ? '🌈' : F.icon}</span>${M ? `<span class="c-mut" data-tip="${esc(`${M.name} — ${M.text}`)}">${M.emoji}</span>` : ''}<span class="c-nums">${c.mbonus ? `<span class="c-pts mult" data-tip="Mult permanent">+${c.mbonus}M</span>` : ''}<span class="c-pts" data-tip="Éclat de base">${pts}</span></span></div>
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

const mutationCard = (m, extra = '') => `<div class="artifact mutation"><div class="a-em">${MUTATIONS[m].emoji}</div><div class="a-nm">🧬 ${MUTATIONS[m].name}</div><div class="a-tx">${MUTATIONS[m].text}</div>${extra}</div>`;

// Avancement des écosystèmes : composition de votre banc par famille.
function ecoChips(r, onlyActive = false) {
  return E.ecoStatus(r).filter((e) => !onlyActive || e.tier).map((e) => {
    const goal = e.next ? e.next.n : e.tier.n;
    const lines = e.eco.tiers.map((t) => `${t.n} : ${t.text}`).join(' | ');
    const tip = esc(`${e.eco.name} — ${FAMILIES[e.f].name}s dans votre banc. | ${lines}`);
    return `<span class="eco ${e.tier ? 'on' : ''}" data-tip="${tip}">${FAMILIES[e.f].icon}${onlyActive ? ` ${e.eco.name}` : ` ${e.n}/${goal}`}</span>`;
  }).join('');
}

function coralCard(t, o = {}) {
  const k = CORALS[t];
  const act = o.action ? `data-action="${o.action}" data-id="${o.id ?? t}"` : '';
  const lvl = o.lvl ? ` <span class="star">+${o.lvl}</span>` : '';
  const hover = o.mini ? 'data-zoom' : `data-tip="${esc(`${k.name} — ${k.text}`)}"`;
  return `<div class="card coral-card r-${k.rar} ${o.pick ? 'pick' : ''} ${o.mini ? 'mini' : ''}" ${act} style="--fam:${k.color}" ${hover}>
    ${o.mini ? zoomTpl(coralCard(t, { lvl: o.lvl })) : ''}<div class="c-top"><span class="c-fam">🪸</span><span class="c-pts mult" data-tip="Mult de base">×${k.mult + (o.lvl || 0)}</span></div>
    <div class="c-em">${k.emoji}</div>
    <div class="c-nm">${k.name}${lvl}</div>
    <div class="c-tx">${k.text}</div>
    <div class="c-tags">Corail · ${RARITY[k.rar].name}</div>
  </div>`;
}

function artifactCard(a, extra = '') {
  const x = ARTIFACTS[a];
  return `<div class="artifact"><div class="a-em">${x.emoji}</div><div class="a-nm">${x.name}</div><div class="a-tx">${x.text}</div>${extra}</div>`;
}
const artifactChip = (a) => `<span class="chip" data-tip="${esc(`${ARTIFACTS[a].name} — ${ARTIFACTS[a].text}`)}">${ARTIFACTS[a].emoji}</span>`;
const condChip = (k) => `<span class="chip cond" data-tip="${esc(CONDITIONS[k].text)}">${CONDITIONS[k].emoji} ${CONDITIONS[k].name}</span>`;
const oxygen = (r) => `<span class="o2" data-tip="Oxygène : vos points de vie. Une plongée ratée coûte 1 🫧.">${'🫧'.repeat(Math.max(0, r.oxygen))}<span class="o2-off">${'🫧'.repeat(Math.max(0, r.oxygenMax - r.oxygen))}</span></span>`;

function topbar(extra = '') {
  const r = S.run;
  const z = ZONES[r.zone];
  return `<header class="topbar">
    <div class="tb-l"><b>${z.name}</b> <span class="muted">${z.depth}${r.depth ? ` · ${DEPTHS[r.depth].name}` : ''}${r.daily ? ' · Plongée du jour' : ''}</span>${extra}</div>
    <div class="tb-c">${oxygen(r)} <span class="pearls" data-tip="Perles">🦪 ${r.pearls}</span></div>
    <div class="tb-r"><span class="arts">${r.artifacts.map(artifactChip).join('')}</span>
      <button class="btn tiny" data-action="bag">Banc (${r.bag.length})</button>
      <button class="btn tiny" data-action="rules">?</button>
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
    return `<button class="diver ${S.diver === k ? 'on' : ''} ${ok ? '' : 'locked'}" data-action="diver" data-k="${k}" ${ok ? '' : 'disabled'}>
      <div class="em">${ok ? v.emoji : '🔒'}</div><div class="nm">${v.name}</div>
      <div class="tx">${ok ? v.text : v.unlock.text}</div></button>`;
  }).join('');
  const depths = DEPTHS.map((dp, i) => (i <= meta.depth
    ? `<button class="btn tiny ${S.depth === i ? 'primary' : ''}" data-action="depth" data-i="${i}" data-tip="${esc(dp.text)}">${i === 0 ? 'Surface' : i}</button>` : '')).join('');
  const daily = meta.daily[today()];
  const firstTime = !meta.tuto && !meta.runs && !hasSave();
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
      ${firstTime ? '<button class="btn primary" data-action="tuto">Tutoriel (conseillé)</button>' : ''}
      <button class="btn ${hasSave() || firstTime ? '' : 'primary'}" data-action="newrun">Nouvelle expédition</button>
      <button class="btn" data-action="daily" data-tip="Même graine pour tout le monde aujourd’hui">📅 Plongée du jour${daily ? ` (${daily.best})` : ''}</button>
    </div>
    <div class="row">
      ${firstTime ? '' : '<button class="btn ghost" data-action="tuto">Tutoriel</button>'}
      <button class="btn ghost" data-action="rules">Règles</button>
      <button class="btn ghost" data-action="bestiary">Bestiaire ${meta.seenC.length}/${Object.keys(CREATURES).length}</button>
    </div>
    <div class="meta">Expéditions : ${meta.runs} · Victoires : ${meta.wins} · Gardiens vaincus : ${meta.bosses} · Plus profond : ${ZONES[meta.bestZone].name}</div>
  </div>`;
}

// ── Carte ───────────────────────────────────────────────────
function renderMap() {
  const r = S.run;
  const av = E.availableNodes(r);
  const W = 360; const RH = 74; const H = 40 + (ROWS_PER_ZONE + 1) * RH;
  const X = (l) => 60 + l * 120; const Y = (row) => 34 + row * RH;
  let lines = ''; let nodes = '';
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
    const cls = ['node', `t-${n.type}`, isAv && 'av', n.done && 'done', cur && 'cur'].filter(Boolean).join(' ');
    const tip = [`${T.name} — ${T.text}`, ...(n.cond || []).map((k) => `${CONDITIONS[k].emoji} ${CONDITIONS[k].name} : ${CONDITIONS[k].text}`),
      ...(['dive', 'elite', 'boss'].includes(n.type) ? [`🎯 Objectif : ${fmt(E.targetFor(r, n))}`] : [])].join(' | ');
    const rad = n.type === 'boss' ? 28 : 21;
    nodes += `<g class="${cls}" data-tip="${esc(tip)}" ${isAv ? `data-action="node" data-row="${n.row}" data-lane="${n.lane}"` : ''}>
      <circle cx="${X(n.lane)}" cy="${Y(n.row)}" r="${rad}"/>
      <text x="${X(n.lane)}" y="${Y(n.row) + 1}" font-size="${n.type === 'boss' ? 26 : 19}">${n.done && !cur ? '✓' : T.icon}</text></g>`;
  }));
  const boss = r.map.rows[ROWS_PER_ZONE][1];
  const next = av.map((n) => {
    const T = NODE_TYPES[n.type];
    const tg = ['dive', 'elite', 'boss'].includes(n.type) ? ` · objectif <b>${fmt(E.targetFor(r, n))}</b>` : '';
    return `<button class="btn route" data-action="node" data-row="${n.row}" data-lane="${n.lane}">${T.icon} ${T.name}${tg}${n.cond ? ` · ${n.cond.map((k) => CONDITIONS[k].emoji).join('')}` : ''}</button>`;
  }).join('');
  const zoneBg = ZONES[r.zone].bg;
  app.innerHTML = `<div class="screen map-screen" style="--z1:${zoneBg[0]};--z2:${zoneBg[1]}">${topbar()}
    <div class="map-wrap">
      <div class="map-col">
        <svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte de la zone">${lines}${nodes}</svg>
      </div>
      <div class="map-side">${toast()}
        <h3>Choisissez votre route</h3>
        <div class="routes">${next || '<div class="muted">—</div>'}</div>
        <div class="boss-card">
          <div class="bc-h">👑 Gardien de la zone · objectif ${fmt(E.targetFor(r, boss))}</div>
          ${boss.cond.map((k) => `<div class="bc-c"><b>${CONDITIONS[k].emoji} ${CONDITIONS[k].name}</b> — ${CONDITIONS[k].text}</div>`).join('')}
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
  const title = d.type === 'boss' ? '👑 Gardien' : d.type === 'elite' ? '💀 Plongée périlleuse' : '🐟 Plongée';

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
  const slotHTML = (ci, s) => {
    const cell = d.board[ci][s];
    const key = `${ci}:${s}`;
    if (cell) {
      const c = E.inst(r, cell.id);
      const def = CREATURES[c.t];
      const bk = info.byKey[key] || {};
      const F = FAMILIES[def.fam];
      const badges = [bk.silenced && '<span class="bdg sil" data-tip="Réduit au silence">🔇</span>', bk.times > 1 && '<span class="bdg x2">×2</span>',
        bk.mult || bk.xm > 1 ? `<span class="bdg mul ${bk.mult < 0 ? 'neg' : ''}">${[bk.mult > 0 ? `+${bk.mult}M` : bk.mult < 0 ? `−${-bk.mult}M` : '', bk.xm > 1 ? `×${bk.xm}M` : ''].filter(Boolean).join(' ')}</span>` : '', c.mut && `<span class="bdg mut" data-tip="${esc(`${MUTATIONS[c.mut].name} — ${MUTATIONS[c.mut].text}`)}">${MUTATIONS[c.mut].emoji}</span>`, cell.lock && '<span class="bdg lock" data-tip="Ne peut plus être déplacé">🔒</span>'].filter(Boolean).join('');
      const can = placing && !cell.lock;
      return `<div class="slot s-${s} full ${can ? 'movable' : ''}" style="--fam:${F.color}" ${can ? `data-action="unplace" data-ci="${ci}" data-s="${s}"` : ''} data-zoom>
        ${zoomTpl(creatureCard(c))}<span class="em">${def.emoji}</span><span class="nm">${def.name}${c.star ? ' ★' : ''}</span>
        <span class="pts ${!placing ? 'pop' : ''}" style="animation-delay:${ci * 0.35}s">${fmt(bk.pts || 0)}</span>${badges}</div>`;
    }
    if (E.isBlocked(r, ci, s)) {
      const kr = d.blocked.includes(key);
      return `<div class="slot s-${s} blocked" data-tip="${kr ? 'Bloqué par le Kraken pour cette marée' : 'Emplacement inexistant sur ce corail'}">${kr ? '🦑' : '✖'}</div>`;
    }
    const t = placing && sel && E.canPlace(r, sel, ci, s);
    return `<div class="slot s-${s} ${t ? 'target' : ''}" ${t ? `data-action="place" data-ci="${ci}" data-s="${s}"` : ''}>
      <span class="ph">${SLOT_ICON[s]}</span><span class="lb">${SLOT_LABEL[s]}</span></div>`;
  };
  // Buffs du corail : une pastille par bonus, avec sa valeur (+1M, ×2M…).
  const buffChip = (b) => `<span class="crown ${b.hint ? 'hint' : ''} ${b.neg ? 'neg' : ''}" data-tip="${esc(`${b.name} — ${b.text}`)}">${b.icon}<span class="cn"> ${esc(b.name)}</span> <span class="bv ${b.x ? 'x' : ''}">${b.val}</span></span>`;
  const corals = r.corals.map((c, ci) => {
    const k = CORALS[c.t];
    const ci2 = info.corals[ci];
    const shown = ci2.buffs.filter((b) => placing || !b.hint);
    const crownB = shown.filter((b) => b.crown).map(buffChip).join('');
    const otherB = shown.filter((b) => !b.crown).map(buffChip).join('');
    const bridge = ci < r.corals.length - 1
      ? `<div class="bridge ${d.board[ci].E && d.board[ci + 1].W ? 'on' : ''}" data-tip="Pont : le Flanc ➡ et le Flanc ⬅ du corail suivant sont voisins">⋯</div>` : '';
    return `<div class="coral-wrap"><div class="coral" style="--fam:${k.color}">
      ${slotHTML(ci, 'N')}${slotHTML(ci, 'W')}
      <div class="core" data-zoom>${zoomTpl(coralCard(c.t, { lvl: c.lvl }))}<div class="em">${k.emoji}</div><div class="nm">${k.name}</div><div class="mb">Mult ${k.mult + c.lvl}</div></div>
      ${slotHTML(ci, 'E')}${slotHTML(ci, 'S')}
      <div class="crowns tl">${crownB}</div><div class="crowns tr">${otherB}</div>
    </div>
    <div class="formula ${ci2.ignored ? 'ignored' : ''} ${!placing ? 'pop' : ''}" style="animation-delay:${ci * 0.35 + 0.15}s">
      <span class="ecl" data-tip="Éclat : somme des créatures">${fmt(ci2.eclat)}</span> × <span class="mlt" data-tip="Mult total">${ci2.multTot}</span> = <b>${fmt(ci2.score)}</b>
      ${ci2.ignored ? '<span class="ign">🐉 ignoré</span>' : ''}
    </div></div>${bridge}`;
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
      const tip = sel ? 'Choisissez un emplacement <span class="glow">en surbrillance</span>.' : 'Sélectionnez une créature de votre main puis un emplacement autour d’un corail.';
      bar = `<div class="msg">Marée <b>${d.tide}/${d.tidesMax}</b> — ${tip}${info.factors.length ? ` <span class="badge">${info.factors.join(' · ')}</span>` : ''}</div>
        <button class="btn" data-action="remous" ${d.remous > 0 && d.hand.length ? '' : 'disabled'}>🌀 Remous (${d.remous})</button>
        <button class="btn primary big" data-action="launch" ${n || !d.hand.length ? '' : 'disabled'}>Lancer la marée 🌊 <span class="proj-btn">+${fmt(info.total)}</span></button>`;
    }
  } else {
    const L = d.last;
    const notes = L.notes.length ? `<span class="notes">${L.notes.map(esc).join(' · ')}</span>` : '';
    const label = d.ended === 'win' ? '🎉 Objectif atteint ! Remonter' : d.ended === 'lose' ? 'Fin de la plongée' : 'Marée suivante →';
    bar = `<div class="msg">Marée ${L.tide} : <b class="tide-total" data-count="${L.total}">+${fmt(L.total)}</b>${L.factors.length ? ` <span class="badge">${L.factors.join(' · ')}</span>` : ''}${notes}</div>
      <button class="btn primary big" data-action="next">${label}</button>`;
  }

  // Main
  const hand = d.hand.map((id) => {
    const c = E.inst(r, id);
    const chosen = ui.remous && ui.rsel.includes(id);
    return creatureCard(c, { action: placing ? 'hand' : '', sel: !ui.remous && sel === id, pick: ui.remous, chosen });
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
  const head = `<h2>${rw.type === 'boss' ? '👑 Gardien vaincu !' : '🎉 Plongée réussie !'}</h2>
    <p>Score <b>${fmt(rw.score)}</b> / ${fmt(rw.target)} — <b>🦪 +${rw.pearls} perles</b>
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
    body = `<h3>Un nouveau corail pousse dans votre récif</h3><div class="offer">${st.options.map((t) => coralCard(t, { action: 'reward', id: t })).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+5 perles)</button>`;
  } else if (st.kind === 'mutation') {
    body = `<h3>Le gardien laisse une trace : choisissez une mutation</h3><div class="offer">${st.options.map((m) => mutationCard(m, `<button class="btn primary" data-action="reward" data-id="${m}">Choisir</button>`)).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+4 perles)</button>`;
  } else if (st.kind === 'fortify-all') {
    body = `<h3>Votre récif est complet</h3><p>Tous vos coraux se fortifient : <b>+1 Mult</b> permanent chacun.</p>
      <button class="btn primary" data-action="reward" data-id="">Continuer</button>`;
  }
  app.innerHTML = `<div class="screen">${topbar()}<div class="between">${head}${body}</div></div>`;
}

// ── Draft de départ ─────────────────────────────────────────
function renderDraft() {
  const r = S.run; const dr = r.draft;
  const round = dr.picks.length + 1;
  const counts = {};
  for (const c of r.bag) (counts[c.t] = counts[c.t] || { c, n: 0 }).n++;
  const bag = Object.values(counts).map(({ c, n }) => `<span class="bag-chip" data-zoom>${zoomTpl(creatureCard(c))}${CREATURES[c.t].emoji}${n > 1 ? ` <b>×${n}</b>` : ''}</span>`).join('');
  const intro = ['Regardez ce que le hasard vous donne : quelle direction prendre ?', 'Confirmez votre direction, ou préparez une autre piste.', 'Dernier choix : une pièce maîtresse pour votre récif.'][dr.picks.length];
  app.innerHTML = `<div class="screen">${topbar()}<div class="between draft">
    <h2>🧭 Préparez votre expédition · choix ${round}/${BASE.draftRounds}</h2>
    <p class="ev-tx">${intro}</p>
    <div class="draft-kit">
      <div><h3>Vos coraux</h3><div class="mini-corals">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl, mini: true })).join('')}</div></div>
      <div><h3>Votre banc · ${r.bag.length} créatures</h3><div class="bag-chips">${bag}</div>
        <h3 class="eco-h">Écosystèmes</h3><div class="eco-row">${ecoChips(r)}</div></div>
    </div>
    <h3>Choisissez une créature</h3>
    <div class="offer">${dr.options.map((t) => offerCard({ t }, { action: 'draft', id: t })).join('')}</div>
  </div></div>`;
}

// ── Comptoir ────────────────────────────────────────────────
function renderShop() {
  const r = S.run; const s = r.shop;
  const buy = (kind, i, p) => `<button class="btn ${r.pearls >= p ? 'primary' : ''}" data-action="buy" data-kind="${kind}" data-i="${i}" ${r.pearls >= p ? '' : 'disabled'}>🦪 ${p}</button>`;
  const sold = '<div class="sold">Vendu</div>';
  const cr = s.cr.map((x, i) => (x ? offerCard({ t: x.t }, { extra: buy('cr', i, x.price) }) : sold)).join('');
  const ar = s.ar.map((x, i) => (x ? artifactCard(x.a, buy('ar', i, x.price)) : '<div class="sold short">Vendu</div>')).join('');
  const mu = (s.mu || []).map((x, i) => (x ? mutationCard(x.m, buy('mu', i, x.price)) : '<div class="sold short">Vendu</div>')).join('');
  const co = s.co.map((x, i) => (x ? `<div class="offer-item">${coralCard(x.t)}${buy('co', i, x.price)}</div>` : sold)).join('');
  app.innerHTML = `<div class="screen">${topbar()}${toast()}<div class="between">
    <h2>⚓ Le Comptoir</h2>
    <div class="shop-top">
      <div><h3>Créatures <button class="btn tiny" data-action="reroll" ${r.pearls >= s.reroll ? '' : 'disabled'}>↻ Renouveler · 🦪 ${s.reroll}</button></h3>
        <div class="offer">${cr}</div></div>
      ${s.co.length ? `<div><h3>Bouture de corail</h3><div class="offer">${co}</div></div>` : ''}
    </div>
    <h3>Artefacts et mutation</h3><div class="offer">${ar}${mu}</div>
    <div class="shop-foot">
      <button class="btn" data-action="shopremove" ${r.pearls >= r.removeCost && r.bag.length > 6 ? '' : 'disabled'}>Relâcher une créature · 🦪 ${r.removeCost}</button>
      <button class="btn" data-action="shopheal" ${r.pearls >= E.healCost(r) && r.oxygen < r.oxygenMax ? '' : 'disabled'}>+1 🫧 · 🦪 ${E.healCost(r)}</button>
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
      return `<button class="btn choice" data-action="evchoice" data-i="${i}" ${ok ? '' : 'disabled'}><b>${esc(c.label)}</b>${c.text ? `<span>${esc(c.text)}</span>` : ''}</button>`;
    }).join('');
  app.innerHTML = `<div class="screen">${topbar()}<div class="between event">
    <div class="ev-em">${ev.emoji}</div><h2>${ev.title}</h2><p class="ev-tx">${ev.text}</p>
    <div class="choices">${choices}</div></div></div>`;
}

// ── Nurserie ────────────────────────────────────────────────
function renderRest() {
  const r = S.run;
  app.innerHTML = `<div class="screen">${topbar()}<div class="between event">
    <div class="ev-em">🌱</div><h2>La Nurserie</h2>
    <p class="ev-tx">Un recoin abrité où le récif reprend des forces avant d’affronter le gardien. Choisissez une seule option.</p>
    <div class="choices">
      <button class="btn choice" data-action="rest" data-w="heal" ${r.oxygen < r.oxygenMax ? '' : 'disabled'}><b>Reprendre son souffle</b><span>+1 🫧 Oxygène</span></button>
      <button class="btn choice" data-action="rest" data-w="upgrade"><b>Faire grandir une créature</b><span>Amélioration ★ : +50 % d’Éclat de base, définitivement</span></button>
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
    <h2>${e.win ? 'Les Abysses sont à vous !' : 'L’expédition s’achève'}</h2>
    <p>${e.win ? 'Les trois gardiens sont vaincus : votre récif entre dans la légende.' : `Vous remontez depuis <b>${ZONES[e.zone].name}</b> (rangée ${Math.min(e.row + 1, ROWS_PER_ZONE + 1)}).`}</p>
    <div class="lines">
      <div class="line"><span>Plongeur</span><b>${DIVERS[r.diverId].emoji} ${DIVERS[r.diverId].name}</b></div>
      <div class="line"><span>Plongées</span><b>${r.dives}</b></div>
      <div class="line"><span>Gardiens vaincus</span><b>${r.bosses}</b></div>
      <div class="line"><span>Banc final</span><b>${r.bag.length} créatures</b></div>
      ${top && top.bonus ? `<div class="line"><span>Star de l’expédition</span><b>${CREATURES[top.t].emoji} ${CREATURES[top.t].name} (+${top.bonus})</b></div>` : ''}
      <div class="line"><span>Graine</span><b>${r.seed}</b></div>
    </div>
    ${e.win && r.depth === meta.depth - 1 && meta.depth <= DEPTHS.length - 1 ? `<p class="unlock">🔓 ${DEPTHS[meta.depth].name} débloquée !</p>` : ''}
    <div class="row"><button class="btn primary" data-action="totitle">Retour au menu</button></div>
  </div></div>`;
}

// ── Fenêtres ────────────────────────────────────────────────
const RULES = `
  <h4>But</h4><p>Traverser trois zones — le <b>Lagon</b>, le <b>Tombant</b> et les <b>Abysses</b> — et vaincre leurs trois gardiens.</p>
  <h4>La carte</h4><p>Choisissez votre route : 🐟 plongées, 💀 plongées périlleuses (condition + artefact), ❓ épaves (rencontres),
  ⚓ comptoir, 🌱 nurserie. Le 👑 gardien de chaque zone est annoncé à l’avance : préparez-vous en conséquence.</p>
  <h4>Une plongée</h4><p>Atteignez l’<b>objectif</b> en un nombre limité de <b>marées</b> 🌊. À chaque marée, vous piochez des créatures
  de votre <b>banc</b>, puis vous les posez autour de vos coraux. Quand vous lancez la marée, chaque corail marque :</p>
  <p class="formula-ex"><b>Éclat</b> (la somme des créatures posées) × <b>Mult</b> (celui du corail + les bonus)</p>
  <p>Ensuite, les créatures retournent dans la défausse, sauf les <b>Sédentaires</b>, qui restent en place. Les créatures non posées restent en main.
  🌀 <b>Remous</b> : renvoyez des créatures de votre main pour en piocher autant.</p>
  <h4>Associations</h4><ul>
  <li><b>Voisins</b> : sur une couronne, chaque emplacement touche ses deux voisins (Surface ⬆ touche les deux Flancs, etc.). La case d’en face est l’<b>opposée</b>.</li>
  <li><b>Ponts</b> : le Flanc ➡ d’un corail touche le Flanc ⬅ du corail suivant.</li>
  <li><b>Surface ⬆ / Fond ⬇</b> : certaines créatures y sont plus fortes.</li>
  <li><b>Couronnes</b> : 💠 Couronne complète (+1 Mult) · 🎯 Banc, une seule famille (Mult ×2) · 🌈 Mosaïque, que des familles différentes (Mult ×1,5).</li>
  <li><b>Buffs</b> : chaque bonus actif s’affiche près de son corail avec sa valeur (<b>+1M</b>, <b>×2M</b>). Une pastille pâle signale qu’il ne manque plus qu’une créature.</li></ul>
  <h4>Construire son banc</h4><ul>
  <li><b>Départ</b> : 2 coraux et 9 créatures au hasard, puis 3 choix de 1 créature parmi 3. Les offres penchent vers ce que votre récif et votre banc mettent en valeur.</li>
  <li><b>Écosystèmes</b> 🌿 : à partir d’un certain nombre de créatures d’une même famille dans votre banc, toute la famille reçoit un bonus.</li>
  <li><b>Mutations</b> 🧬 : un modificateur sur une créature précise (Écho, Fidèle, Caméléon…). Nurserie, comptoir, épaves et gardiens en proposent.</li>
  <li><b>Fusion</b> ★ : deux créatures identiques n’en font plus qu’une, bien plus forte. Un banc plus fin pioche plus souvent ses meilleures cartes.</li>
  <li><b>Éphémère</b> : une seule fois par plongée. <b>Fidèle</b> : revient en main après la marée. <b>Éclosion</b> : devient une autre créature après quelques marées jouées, pour toujours.</li>
  <li><b>Parasites</b> ☣️ : ces cartes encombrent votre banc. Relâchez-les au comptoir, ou faites-les manger par un Orque ou un Labre.</li></ul>
  <h4>Roguelike</h4><p>🫧 <b>Oxygène</b> : une plongée ratée vous en coûte 1 ; à zéro, l’expédition s’arrête. Rater un gardien y met fin aussitôt.
  Les marées non utilisées rapportent des perles. Certaines créatures <b>grandissent</b> ou en <b>dévorent</b> d’autres, et ces changements sont permanents.
  Vaincre l’expédition débloque une <b>Profondeur</b> plus difficile.</p>
  <h4>Astuce</h4><p>Survolez une créature ou un corail du récif, ou une carte du banc, pour la lire en grand.</p>`;

// Grille calculée pour que toutes les cartes tiennent dans la fenêtre.
function collGrid(n, reserved) {
  const w = Math.min(1276, innerWidth - 76);
  const h = Math.max(120, innerHeight - reserved);
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / (h * 1.1))));
  return `--cols:${cols};--rows:${Math.ceil(n / cols)}`;
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
    const titles = { remove: 'Relâcher une créature', sell: 'Céder une créature aux pêcheurs', upgrade: 'Faire grandir une créature ★', duplicate: 'Dupliquer une créature', fortify: 'Fortifier un corail',
      merge: 'Fusionner deux créatures identiques ★', mutate: p.mut ? `${MUTATIONS[p.mut].emoji} ${MUTATIONS[p.mut].name} : à quelle créature ?` : '' };
    const eligible = r.bag.filter((c) => E.pickable(r, c, p.purpose));
    let items;
    if (p.purpose === 'fortify') {
      items = r.corals.map((c) => coralCard(c.t, { action: 'pick', id: c.id, lvl: c.lvl, pick: true, mini: true })).join('');
    } else {
      items = [...eligible].sort((a, b) => a.t.localeCompare(b.t)).map((c) => {
        const ex = p.purpose === 'upgrade' ? `<div class="up">+${E.upgradeAmount(r, c)}</div>` : '';
        return `<div class="offer-item">${creatureCard(c, { action: 'pick', pick: true, mini: true })}${ex}</div>`;
      }).join('');
    }
    return `<div class="modal-bg"><div class="modal wide">
      <h2>${titles[p.purpose]}${p.cost ? ` · 🦪 ${p.cost}` : ''}</h2>
      <div class="coll" style="${collGrid(p.purpose === 'fortify' ? r.corals.length : eligible.length, 130)}">${items}</div>
      ${p.cancel ? '<button class="btn" data-action="pickcancel">Annuler</button>' : ''}</div></div>`;
  }
  if (!S.modal) return '';
  if (S.modal === 'rules') {
    return `<div class="modal-bg" data-action="closemodal"><div class="modal rules" data-stop>
      <h2>Règles de Krazy Sea</h2><div class="cols">${RULES}</div>
      <button class="btn primary" data-action="closemodal">Compris !</button></div></div>`;
  }
  if (S.modal === 'bag') {
    const d = r.dive;
    const where = (id) => (!d ? '' : d.hand.includes(id) ? 'en main' : d.draw.includes(id) ? 'pioche' : d.discard.includes(id) ? 'défausse' : d.exhausted.includes(id) ? 'épuisée' : 'récif');
    const items = [...r.bag].sort((a, b) => a.t.localeCompare(b.t)).map((c) => `<div class="offer-item">${creatureCard(c, { mini: true })}${d ? `<div class="muted">${where(c.id)}</div>` : ''}</div>`).join('');
    return `<div class="modal-bg" data-action="closemodal"><div class="modal wide" data-stop>
      <h2>Votre banc · ${r.bag.length} créatures</h2>
      <div class="eco-row">${ecoChips(r)}</div>
      <div class="coll" style="${collGrid(r.bag.length, 200 + Math.max(72, Math.min(100, innerHeight * 0.12)))}">${items}</div>
      <div class="bag-foot">
        <div><h3>Coraux</h3><div class="list">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl, mini: true })).join('')}</div></div>
        ${r.artifacts.length ? `<div><h3>Artefacts</h3><div class="list">${r.artifacts.map(artifactChip).join('')}</div></div>` : ''}
      </div>
      <button class="btn" data-action="closemodal">Fermer</button></div></div>`;
  }
  if (S.modal === 'bestiary') {
    const unknown = '<div class="card mini unknown"><div class="c-em">❔</div><div class="c-nm">???</div></div>';
    const cr = Object.keys(CREATURES).map((t) => (meta.seenC.includes(t) ? creatureCard({ t }, { mini: true }) : unknown));
    const co = Object.keys(CORALS).map((t) => (meta.seenK.includes(t) ? coralCard(t, { mini: true }) : unknown));
    return `<div class="modal-bg" data-action="closemodal"><div class="modal wide" data-stop>
      <h2>Bestiaire · ${meta.seenC.length}/${cr.length} créatures · ${meta.seenK.length}/${co.length} coraux</h2>
      <div class="coll" style="${collGrid(cr.length + co.length, 130)}">${cr.join('')}${co.join('')}</div>
      <button class="btn" data-action="closemodal">Fermer</button></div></div>`;
  }
  return '';
}

// ── Tutoriel ────────────────────────────────────────────────
// Expédition d'essai avec une main préparée. Les étapes `done` attendent une
// action du joueur ; les autres se lisent et bloquent le reste de l'écran.
const dive = () => S.run.dive;
const TUTO = [
  { target: () => '.hud', title: 'Le but',
    text: () => `Chaque plongée a un <b>objectif de points</b> à atteindre en 4 <b>marées</b> 🌊. La partie hachurée de la barre montre ce que rapportera la marée en préparation.` },
  { target: () => '.hand', title: 'Vos créatures',
    text: () => `À chaque marée, vous piochez des créatures dans votre banc. Chaque carte indique sa <b>famille</b>, son <b>Éclat</b> (la pastille sombre) et son effet.` },
  { title: 'Posez une créature',
    target: () => (S.ui.sel ? '.reef' : '.hand [data-t="sardine"]'),
    text: () => (S.ui.sel
      ? `Cliquez sur un emplacement <span class="glow">en surbrillance</span>, par exemple la <b>Surface ⬆</b> du premier corail.`
      : `Cliquez sur les <b>Sardines</b> : vous les poserez ensuite autour d'un corail.`),
    done: () => E.boardCount(S.run) >= 1 },
  { title: 'Soignez les voisinages',
    target: () => (S.ui.sel ? '.reef' : '.hand [data-t="crevette"]'),
    text: () => (S.ui.sel
      ? `Posez-la sur un <b>Flanc ⬅ ➡</b> du même corail : Surface et Flancs se touchent. Une erreur ? Recliquez sur une créature posée pour la reprendre.`
      : `Une créature peut renforcer celles qui la touchent. Cliquez sur la <b>Crevette nettoyeuse</b>, qui donne +3 Éclat à ses voisins.`),
    done: () => E.boardCount(S.run) >= 2 },
  { target: () => '.formula', title: 'Éclat × Mult',
    text: () => `Chaque corail marque son <span style="color:var(--accent2)"><b>Éclat</b></span> (la somme des créatures posées) multiplié par son <span style="color:var(--mult)"><b>Mult</b></span>. Certaines créatures, comme la Méduse, augmentent le Mult : c'est là que naissent les gros scores.` },
  { target: () => '.reef', title: 'Les couronnes',
    text: () => `Occupez les 4 emplacements d'un corail pour former une <b>couronne</b> : 💠 +1 Mult. Si les créatures sont d'une seule famille, 🎯 Mult ×2 ; si elles sont toutes différentes, 🌈 Mult ×1,5. Chaque bonus actif s'affiche près du corail, avec sa valeur : <b>+1M</b>, <b>×2M</b>.` },
  { title: 'Lancez la marée', target: () => '[data-action="launch"]',
    text: () => `Cliquez sur <b>Lancer la marée</b> pour marquer vos points. Pour la suite : 🌀 <b>Remous</b> échange des créatures de votre main contre de nouvelles.`,
    done: () => dive().phase === 'scored' },
  { target: () => '.actionbar', title: 'Après la marée',
    text: () => `Les points s'ajoutent à votre score. Les créatures posées repartent dans la défausse, sauf les <b>Sédentaires</b>, et celles restées en main sont conservées.`,
    next: () => E.backToMap(S.run) },
  { target: () => '.map-col', title: 'La carte',
    text: () => `Entre deux plongées, choisissez votre route : 🐟 plongées, 💀 plongées périlleuses, ❓ épaves, ⚓ comptoir pour acheter, 🌱 nurserie pour renforcer votre récif.` },
  { target: () => '.boss-card', title: 'Le gardien',
    text: () => `Chaque zone se termine par un <b>gardien</b> annoncé à l'avance : préparez votre récif en conséquence. Le rater met fin à l'expédition.` },
  { title: 'Prêt à plonger ?', final: true,
    text: () => `Une plongée ratée coûte 1 🫧 <b>Oxygène</b> ; à zéro, l'expédition s'arrête. Les perles 🦪 gagnées servent au comptoir. En vraie expédition, vos coraux et votre banc sont tirés au hasard, puis vous choisissez 3 créatures pour donner une direction à votre récif. Bonne chance !` },
];

function startTuto() {
  S.run = E.tutorialRun();
  resetUI();
  S.screen = 'game';
  S.modal = null;
  S.tuto = { i: 0 };
  meta.tuto = true; saveMeta();
}
function endTuto() { S.tuto = null; S.run = null; resetUI(); S.screen = 'title'; }

function renderTuto() {
  while (TUTO[S.tuto.i].done && TUTO[S.tuto.i].done()) S.tuto.i++;
  const step = TUTO[S.tuto.i];
  const live = !!step.done;
  const buttons = step.final
    ? `<button class="btn" data-action="tutoend">Retour au menu</button>${hasSave() ? '' : '<button class="btn primary" data-action="tutoplay">Commencer une expédition</button>'}`
    : `<button class="btn ghost" data-action="tutoend">Quitter</button>${live ? '<span class="tuto-turn">À vous de jouer !</span>' : '<button class="btn primary" data-action="tutonext">Suivant</button>'}`;
  app.insertAdjacentHTML('beforeend', `
    ${live ? '' : `<div class="tuto-block ${step.final ? 'dim' : ''}"></div>`}
    <div class="tuto-spot ${live ? '' : 'shade'}" hidden></div>
    <div class="tuto-bubble"><h4>${step.title}<span>${S.tuto.i + 1}/${TUTO.length}</span></h4>
      <div>${step.text()}</div><div class="tuto-actions">${buttons}</div></div>`);
  placeTuto(step);
}

function placeTuto(step) {
  const bubble = app.querySelector('.tuto-bubble');
  const spot = app.querySelector('.tuto-spot');
  const clamp = (v, max) => Math.max(8, Math.min(v, max));
  const w = bubble.offsetWidth; const h = bubble.offsetHeight;
  const sel = step.target && step.target();
  // La carte visée n'est peut-être pas en main : on retombe alors sur la main.
  const el = sel && (app.querySelector(sel) || app.querySelector('.hand'));
  let left = (innerWidth - w) / 2; let top = (innerHeight - h) / 2;
  if (el) {
    const r = el.getBoundingClientRect();
    spot.hidden = false;
    Object.assign(spot.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    if (r.width + w + 24 < innerWidth && r.height > innerHeight * 0.6) { // grande cible : à côté
      left = r.right + 12 + w < innerWidth ? r.right + 12 : r.left - w - 12;
      top = r.top + (r.height - h) / 2;
    } else {
      left = r.left + r.width / 2 - w / 2;
      top = innerHeight - r.bottom >= r.top ? r.bottom + 12 : r.top - h - 12;
    }
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
function showZoom(el) {
  zoomFor = el;
  zoomEl.innerHTML = el.querySelector(':scope > template').innerHTML;
  zoomEl.hidden = false;
  const r = el.getBoundingClientRect();
  const w = zoomEl.offsetWidth; const h = zoomEl.offsetHeight;
  let top = r.bottom + 8;
  if (top + h > innerHeight - 8) top = r.top - h - 8;
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
function showTip(el) {
  if (el === tipFor) return;
  tipFor = el;
  const part = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });
  const [first, ...lines] = el.dataset.tip.split(' | ');
  const cut = first.indexOf(' — ');
  tipEl.replaceChildren(
    ...(cut < 0 ? [part('tip-b', first)] : [part('tip-h', first.slice(0, cut)), part('tip-b', first.slice(cut + 3))]),
    ...lines.map((l) => part('tip-l', l)),
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
function hideHover() { hideZoom(); hideTip(); }
document.addEventListener('mouseover', (ev) => {
  const zoom = ev.target.closest('[data-zoom]');
  let tip = ev.target.closest('[data-tip]');
  // Sur une mini-carte, l'aperçu agrandi dit déjà tout ; une pastille posée sur une case garde sa bulle.
  if (tip && zoom && (!zoom.contains(tip) || zoom.matches('.card.mini'))) tip = null;
  // Une carte entière affiche déjà son texte : la bulle ne sert que s'il est coupé.
  if (tip && tip.matches('.card') && tip.scrollHeight <= tip.clientHeight) tip = null;
  if (tip) { hideZoom(); showTip(tip); return; }
  hideTip();
  if (!zoom) hideZoom();
  else if (zoom !== zoomFor) showZoom(zoom);
});
document.documentElement.addEventListener('mouseleave', hideHover);
document.addEventListener('scroll', hideHover, true);

// ── Rendu ───────────────────────────────────────────────────
function render() {
  hideHover();
  const r = S.run;
  if (S.screen === 'title' || !r) renderTitle();
  else ({ draft: renderDraft, map: renderMap, dive: renderDive, reward: renderReward, shop: renderShop, event: renderEvent, rest: renderRest, end: renderEnd })[r.phase]();
  const m = modalHTML();
  if (m) app.insertAdjacentHTML('beforeend', m);
  else if (S.tuto) renderTuto();
  if (S.anim) { S.anim = false; animateCounts(); }
  trackSeen();
  save();
  if (DEBUG) Object.assign(window, { S, E, render });
}

function animateCounts() {
  for (const el of app.querySelectorAll('.tide-total[data-count]')) {
    const to = +el.dataset.count;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
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
  if (r.end.win) {
    meta.wins++;
    if (r.depth === meta.depth && meta.depth < DEPTHS.length - 1) meta.depth++;
  }
  if (r.daily) {
    const progress = r.end.win ? '🏆' : `${ZONES[r.end.zone].name} ${Math.min(r.end.row + 1, ROWS_PER_ZONE + 1)}`;
    const score = r.end.win ? 999 : r.end.zone * 10 + r.end.row;
    const prev = meta.daily[today()];
    if (!prev || score > prev.score) meta.daily[today()] = { best: progress, score };
  }
  saveMeta();
  clearSave();
}
let lastBosses = 0;
function afterAction() {
  const r = S.run;
  if (!r || S.tuto) return;
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
  daily: () => startRun({ diverId: 'exploratrice', depth: 0, seed: E.seedFrom(`krazy-${today()}`), daily: true }),
  continue: () => {
    const r = loadJSON(SAVE_KEY, null);
    if (r && r.v === E.SAVE_VERSION) { S.run = r; lastBosses = r.bosses; S.screen = 'game'; resetUI(); }
  },
  rules: () => { S.modal = 'rules'; },
  bestiary: () => { S.modal = 'bestiary'; },
  bag: () => { S.modal = 'bag'; },
  closemodal: () => { S.modal = null; },
  menu: () => { S.modal = null; if (S.tuto) endTuto(); else S.screen = 'title'; },
  tuto: () => startTuto(),
  tutonext: () => { const st = TUTO[S.tuto.i]; S.tuto.i++; if (st.next) st.next(); },
  tutoend: () => endTuto(),
  tutoplay: () => { endTuto(); startRun({ diverId: S.diver, depth: S.depth }); },
  totitle: () => { S.screen = 'title'; S.run = null; },

  node: (el) => { E.enterNode(S.run, +el.dataset.row, +el.dataset.lane); resetUI(); },
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
  evchoice: (el) => E.eventChoose(S.run, +el.dataset.i),
  rest: (el) => E.restChoose(S.run, el.dataset.w),
};

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'closemodal' && el.classList.contains('modal-bg') && ev.target.closest('[data-stop]')) return;
  const h = handlers[el.dataset.action];
  if (!h || el.disabled) return;
  h(el, ev);
  afterAction();
  render();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (S.modal) S.modal = null;
  else if (S.run && S.run.phase === 'dive') resetUI();
  render();
});

window.addEventListener('resize', render);

render();
