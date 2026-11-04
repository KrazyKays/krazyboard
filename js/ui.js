// ─────────────────────────────────────────────────────────────
//  Krazy Sea — interface
// ─────────────────────────────────────────────────────────────
import {
  SLOTS, SLOT_LABEL, SLOT_ICON, FAMILIES, RARITY, CREATURES, CORALS, CROWNS, ARTIFACTS,
  CONDITIONS, ZONES, NODE_TYPES, DIVERS, DEPTHS, ROWS_PER_ZONE,
} from './data.js';
import * as E from './engine.js';

const app = document.getElementById('app');
const SAVE_KEY = 'krazy-sea-run-v2';
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
};

function save() {
  if (S.run && S.run.phase !== 'end') saveJSON(SAVE_KEY, S.run);
}
const hasSave = () => { const r = loadJSON(SAVE_KEY, null); return !!(r && r.v === 2 && r.phase !== 'end'); };

// ── Utilitaires ─────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const today = () => new Date().toISOString().slice(0, 10);
const plural = (n, s, p = s + 's') => (n > 1 ? p : s);

function seen(list, key) { if (!meta[list].includes(key)) { meta[list].push(key); return true; } return false; }
function trackSeen() {
  const r = S.run;
  if (!r) return;
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
  const cls = ['card', `r-${def.rar}`, o.sel && 'sel', o.pick && 'pick', o.chosen && 'chosen', o.small && 'small', o.dim && 'dim']
    .filter(Boolean).join(' ');
  const act = o.action ? `data-action="${o.action}" data-id="${o.id ?? c.id}"` : '';
  const tags = [def.allFam ? 'Toutes familles' : F.name, def.sed && 'Sédentaire', def.place && 'Pose', RARITY[def.rar].name]
    .filter(Boolean).join(' · ');
  return `<div class="${cls}" ${act} style="--fam:${F.color}" title="${esc(`${def.name} — ${def.text}`)}">
    <div class="c-top"><span class="c-fam">${def.allFam ? '🌈' : F.icon}</span><span class="c-pts" title="Éclat de base">${pts}</span></div>
    <div class="c-em">${def.emoji}</div>
    <div class="c-nm">${def.name}${stars}</div>
    <div class="c-tx">${def.text}</div>
    <div class="c-tags">${tags}</div>
  </div>`;
}

function coralCard(t, o = {}) {
  const k = CORALS[t];
  const act = o.action ? `data-action="${o.action}" data-id="${o.id ?? t}"` : '';
  const lvl = o.lvl ? ` <span class="star">+${o.lvl}</span>` : '';
  return `<div class="card coral-card r-${k.rar} ${o.pick ? 'pick' : ''}" ${act} style="--fam:${k.color}" title="${esc(`${k.name} — ${k.text}`)}">
    <div class="c-top"><span class="c-fam">🪸</span><span class="c-pts mult" title="Mult de base">×${k.mult + (o.lvl || 0)}</span></div>
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
const artifactChip = (a) => `<span class="chip" title="${esc(`${ARTIFACTS[a].name} — ${ARTIFACTS[a].text}`)}">${ARTIFACTS[a].emoji}</span>`;
const condChip = (k) => `<span class="chip cond" title="${esc(CONDITIONS[k].text)}">${CONDITIONS[k].emoji} ${CONDITIONS[k].name}</span>`;
const oxygen = (r) => `<span class="o2" title="Oxygène : vos points de vie. Une plongée ratée coûte 1 🫧.">${'🫧'.repeat(Math.max(0, r.oxygen))}<span class="o2-off">${'🫧'.repeat(Math.max(0, r.oxygenMax - r.oxygen))}</span></span>`;

function topbar(extra = '') {
  const r = S.run;
  const z = ZONES[r.zone];
  return `<header class="topbar">
    <div class="tb-l"><b>${z.name}</b> <span class="muted">${z.depth}${r.depth ? ` · ${DEPTHS[r.depth].name}` : ''}${r.daily ? ' · Plongée du jour' : ''}</span>${extra}</div>
    <div class="tb-c">${oxygen(r)} <span class="pearls" title="Perles">🦪 ${r.pearls}</span></div>
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
    ? `<button class="btn tiny ${S.depth === i ? 'primary' : ''}" data-action="depth" data-i="${i}" title="${esc(dp.text)}">${i === 0 ? 'Surface' : i}</button>` : '')).join('');
  const daily = meta.daily[today()];
  app.innerHTML = `<div class="title-screen">
    <img class="pixel-logo" src="favicon.svg" alt="" width="96" height="96">
    <div class="logo">Krazy Sea</div>
    <p class="pitch">Composez des <b>couronnes de créatures</b> autour de vos coraux et déclenchez des combos
    à chaque marée. Choisissez votre route à travers trois zones, recrutez, faites évoluer vos créatures,
    trouvez des artefacts… et survivez aux gardiens des profondeurs.</p>
    <h3>Plongeur</h3>
    <div class="divers">${divers}</div>
    ${meta.depth > 0 ? `<h3>Profondeur</h3><div class="row">${depths}</div><div class="muted depth-tx">${DEPTHS.slice(1, S.depth + 1).map((d) => d.text).join(' ') || DEPTHS[0].text}</div>` : ''}
    <div class="row main-actions">
      ${hasSave() ? '<button class="btn primary" data-action="continue">Reprendre l’expédition</button>' : ''}
      <button class="btn ${hasSave() ? '' : 'primary'}" data-action="newrun">Nouvelle expédition</button>
      <button class="btn" data-action="daily" title="Même graine pour tout le monde aujourd’hui">📅 Plongée du jour${daily ? ` (${daily.best})` : ''}</button>
    </div>
    <div class="row">
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
    const tip = `${T.name} — ${T.text}${n.cond ? ' ' + n.cond.map((k) => `[${CONDITIONS[k].name} : ${CONDITIONS[k].text}]`).join(' ') : ''}${['dive', 'elite', 'boss'].includes(n.type) ? ` Objectif : ${fmt(E.targetFor(r, n))}.` : ''}`;
    const rad = n.type === 'boss' ? 28 : 21;
    nodes += `<g class="${cls}" ${isAv ? `data-action="node" data-row="${n.row}" data-lane="${n.lane}"` : ''}>
      <title>${esc(tip)}</title>
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
  app.innerHTML = `<div class="screen map-screen" style="--z1:${zoneBg[0]};--z2:${zoneBg[1]}">${topbar()}${toast()}
    <div class="map-wrap">
      <div class="map-col">
        <svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte de la zone">${lines}${nodes}</svg>
      </div>
      <div class="map-side">
        <h3>Choisissez votre route</h3>
        <div class="routes">${next || '<div class="muted">—</div>'}</div>
        <div class="boss-card">
          <div class="bc-h">👑 Gardien de la zone · objectif ${fmt(E.targetFor(r, boss))}</div>
          ${boss.cond.map((k) => `<div class="bc-c"><b>${CONDITIONS[k].emoji} ${CONDITIONS[k].name}</b> — ${CONDITIONS[k].text}</div>`).join('')}
          <div class="muted">Rater le gardien met fin à l’expédition. Le vaincre : nouveau corail et oxygène rechargé.</div>
        </div>
        <div class="legend">${Object.entries(NODE_TYPES).map(([, t]) => `<span title="${esc(t.text)}">${t.icon} ${t.name}</span>`).join('')}</div>
        <h3>Votre récif</h3>
        <div class="mini-corals">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl })).join('')}</div>
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
    return `<span class="tide ${st}" title="${d.history[i] !== undefined ? `Marée ${n} : ${fmt(d.history[i])}` : `Marée ${n}`}">🌊</span>`;
  }).join('');
  const hud = `<section class="hud">
    <div class="h-l"><div class="dname">${title} <span class="muted">· rangée ${node.row + 1}</span></div>
      <div class="conds">${d.cond.map(condChip).join('') || '<span class="muted">Aucune condition</span>'}</div></div>
    <div class="h-c">
      <div class="bar"><div class="fill ${d.score >= d.target ? 'ok' : ''}" style="width:${pct}%"></div><div class="ghost" style="left:${pct}%;width:${proj}%"></div></div>
      <div class="sc"><b data-count="${d.score}">${fmt(d.score)}</b> / ${fmt(d.target)}${placing && info.total ? ` <span class="proj">+${fmt(info.total)}</span>` : ''}</div>
    </div>
    <div class="h-r"><div class="tides" title="Marées : nombre de fois où votre récif marque">${tides}</div>
      <div class="stats"><span title="Remous : défaussez des créatures de votre main pour en piocher autant">🌀 ${d.remous}</span>
      <span title="Créatures restantes dans la pioche / défausse">🂠 ${d.draw.length} · ♻ ${d.discard.length}</span></div></div>
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
      const badges = [bk.silenced && '<span class="bdg sil" title="Réduit au silence">🔇</span>', bk.times > 1 && '<span class="bdg x2">×2</span>',
        bk.mult ? `<span class="bdg mul">+${bk.mult} M</span>` : '', cell.lock && '<span class="bdg lock" title="Ne peut plus être déplacé">🔒</span>'].filter(Boolean).join('');
      const can = placing && !cell.lock;
      return `<div class="slot s-${s} full ${can ? 'movable' : ''}" style="--fam:${F.color}" ${can ? `data-action="unplace" data-ci="${ci}" data-s="${s}"` : ''} title="${esc(`${def.name} — ${def.text}`)}">
        <span class="em">${def.emoji}</span><span class="nm">${def.name}${c.star ? ' ★' : ''}</span>
        <span class="pts ${!placing ? 'pop' : ''}" style="animation-delay:${ci * 0.35}s">${fmt(bk.pts || 0)}</span>${badges}</div>`;
    }
    if (E.isBlocked(r, ci, s)) {
      const kr = d.blocked.includes(key);
      return `<div class="slot s-${s} blocked" title="${kr ? 'Bloqué par le Kraken pour cette marée' : 'Emplacement inexistant sur ce corail'}">${kr ? '🦑' : '✖'}</div>`;
    }
    const t = placing && sel && E.canPlace(r, sel, ci, s);
    return `<div class="slot s-${s} ${t ? 'target' : ''}" ${t ? `data-action="place" data-ci="${ci}" data-s="${s}"` : ''}>
      <span class="ph">${SLOT_ICON[s]}</span><span class="lb">${SLOT_LABEL[s]}</span></div>`;
  };
  const crownIcons = (tags) => tags.filter((t) => CROWNS[t]).map((t) => `<span class="crown" title="${esc(CROWNS[t].name + ' — ' + CROWNS[t].text)}">${CROWNS[t].icon} ${CROWNS[t].name}</span>`).join('');
  const corals = r.corals.map((c, ci) => {
    const k = CORALS[c.t];
    const ci2 = info.corals[ci];
    const bridge = ci < r.corals.length - 1
      ? `<div class="bridge ${d.board[ci].E && d.board[ci + 1].W ? 'on' : ''}" title="Pont : le Flanc ➡ et le Flanc ⬅ du corail suivant sont voisins">⋯</div>` : '';
    return `<div class="coral-wrap"><div class="coral" style="--fam:${k.color}">
      ${slotHTML(ci, 'N')}${slotHTML(ci, 'W')}
      <div class="core" title="${esc(`${k.name} — ${k.text}`)}"><div class="em">${k.emoji}</div><div class="nm">${k.name}</div><div class="mb">Mult ${k.mult + c.lvl}</div></div>
      ${slotHTML(ci, 'E')}${slotHTML(ci, 'S')}
    </div>
    <div class="formula ${ci2.ignored ? 'ignored' : ''} ${!placing ? 'pop' : ''}" style="animation-delay:${ci * 0.35 + 0.15}s">
      <span class="ecl" title="Éclat : somme des créatures">${fmt(ci2.eclat)}</span> × <span class="mlt" title="Mult total">${ci2.multTot}</span> = <b>${fmt(ci2.score)}</b>
      ${ci2.ignored ? '<div class="ign">🐉 ignoré</div>' : ''}
    </div>
    <div class="crowns">${crownIcons(ci2.tags)}</div></div>${bridge}`;
  }).join('');
  const reef = `<section class="reef"><div class="reef-row">${corals}</div></section>`;

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
        <button class="btn primary big" data-action="launch" ${n ? '' : 'disabled'}>Lancer la marée 🌊 <span class="proj-btn">+${fmt(info.total)}</span></button>`;
    }
  } else {
    const L = d.last;
    const notes = L.notes.length ? `<div class="notes">${L.notes.map(esc).join(' · ')}</div>` : '';
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
    ? `<div class="peek">🔦 Prochaines : ${d.draw.slice(0, 3).map((id) => `<span title="${esc(CREATURES[E.inst(r, id).t].name)}">${CREATURES[E.inst(r, id).t].emoji}</span>`).join(' ')}</div>` : '';
  const handSec = `<section class="hand"><div class="zone-label">Main <span class="muted">${d.hand.length} · pioche jusqu’à ${d.handSize} à chaque marée</span>${peek}</div>
    <div class="hand-row">${hand || '<div class="empty-note">Main vide.</div>'}</div></section>`;

  const zoneBg = ZONES[r.zone].bg;
  app.innerHTML = `<div class="screen dive-screen" style="--z1:${zoneBg[0]};--z2:${zoneBg[1]}">${topbar()}${toast()}${hud}${reef}<section class="actionbar">${bar}</section>${handSec}</div>`;
}

// ── Récompense ──────────────────────────────────────────────
function renderReward() {
  const r = S.run; const rw = r.reward; const st = rw.stages[0];
  const head = `<h2>${rw.type === 'boss' ? '👑 Gardien vaincu !' : '🎉 Plongée réussie !'}</h2>
    <p>Score <b>${fmt(rw.score)}</b> / ${fmt(rw.target)} — <b>🦪 +${rw.pearls} perles</b>
    <span class="muted">(${rw.lines.map(([l, n]) => `${l} +${n}`).join(', ')})</span>${rw.type === 'boss' ? '<br>🫧 Oxygène entièrement rechargé.' : ''}</p>`;
  let body = '';
  if (st.kind === 'creature') {
    body = `<h3>Une créature rejoint votre banc</h3><div class="offer">${st.options.map((t) => creatureCard({ t }, { action: 'reward', id: t })).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+3 perles)</button>`;
  } else if (st.kind === 'artifact') {
    body = `<h3>Choisissez un artefact</h3><div class="offer">${st.options.map((a) => artifactCard(a, `<button class="btn primary" data-action="reward" data-id="${a}">Prendre</button>`)).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+4 perles)</button>`;
  } else if (st.kind === 'coral') {
    body = `<h3>Un nouveau corail pousse dans votre récif</h3><div class="offer">${st.options.map((t) => coralCard(t, { action: 'reward', id: t })).join('')}</div>
      <button class="btn ghost" data-action="reward" data-id="">Passer (+5 perles)</button>`;
  } else if (st.kind === 'fortify-all') {
    body = `<h3>Votre récif est complet</h3><p>Tous vos coraux se fortifient : <b>+1 Mult</b> permanent chacun.</p>
      <button class="btn primary" data-action="reward" data-id="">Continuer</button>`;
  }
  app.innerHTML = `<div class="screen">${topbar()}<div class="between">${head}${body}</div></div>`;
}

// ── Comptoir ────────────────────────────────────────────────
function renderShop() {
  const r = S.run; const s = r.shop;
  const buy = (kind, i, p) => `<button class="btn ${r.pearls >= p ? 'primary' : ''}" data-action="buy" data-kind="${kind}" data-i="${i}" ${r.pearls >= p ? '' : 'disabled'}>🦪 ${p}</button>`;
  const sold = '<div class="sold">Vendu</div>';
  const cr = s.cr.map((x, i) => (x ? `<div class="offer-item">${creatureCard({ t: x.t })}${buy('cr', i, x.price)}</div>` : sold)).join('');
  const ar = s.ar.map((x, i) => (x ? artifactCard(x.a, buy('ar', i, x.price)) : sold)).join('');
  const co = s.co.map((x, i) => (x ? `<div class="offer-item">${coralCard(x.t)}${buy('co', i, x.price)}</div>` : sold)).join('');
  app.innerHTML = `<div class="screen">${topbar()}${toast()}<div class="between">
    <h2>⚓ Le Comptoir</h2>
    <h3>Créatures <button class="btn tiny" data-action="reroll" ${r.pearls >= s.reroll ? '' : 'disabled'}>↻ Renouveler · 🦪 ${s.reroll}</button></h3>
    <div class="offer">${cr}</div>
    <h3>Artefacts</h3><div class="offer">${ar || '<div class="muted">Plus rien à vendre.</div>'}</div>
    ${s.co.length ? `<h3>Bouture de corail</h3><div class="offer">${co}</div>` : ''}
    <h3>Services</h3>
    <div class="row">
      <button class="btn" data-action="shopremove" ${r.pearls >= r.removeCost && r.bag.length > 6 ? '' : 'disabled'}>Relâcher une créature · 🦪 ${r.removeCost}</button>
      <button class="btn" data-action="shopheal" ${r.pearls >= E.healCost(r) && r.oxygen < r.oxygenMax ? '' : 'disabled'}>+1 🫧 · 🦪 ${E.healCost(r)}</button>
    </div>
    <button class="btn primary big" data-action="leave">Reprendre la route →</button>
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
  <li><b>Couronnes</b> : 💠 Couronne complète (+1 Mult) · 🎯 Banc, une seule famille (Mult ×2) · 🌈 Mosaïque, que des familles différentes (Mult ×1,5).</li></ul>
  <h4>Roguelike</h4><p>🫧 <b>Oxygène</b> : une plongée ratée vous en coûte 1 ; à zéro, l’expédition s’arrête. Rater un gardien y met fin aussitôt.
  Les marées non utilisées rapportent des perles. Certaines créatures <b>grandissent</b> ou en <b>dévorent</b> d’autres, et ces changements sont permanents.
  Vaincre l’expédition débloque une <b>Profondeur</b> plus difficile.</p>`;

function modalHTML() {
  const r = S.run;
  if (r && r.pending) {
    const p = r.pending;
    const titles = { remove: 'Relâcher une créature', sell: 'Céder une créature aux pêcheurs', upgrade: 'Faire grandir une créature ★', duplicate: 'Dupliquer une créature', fortify: 'Fortifier un corail' };
    let items;
    if (p.purpose === 'fortify') {
      items = r.corals.map((c) => coralCard(c.t, { action: 'pick', id: c.id, lvl: c.lvl, pick: true })).join('');
    } else {
      items = [...r.bag].sort((a, b) => a.t.localeCompare(b.t)).map((c) => {
        const ex = p.purpose === 'upgrade' ? `<div class="up">+${E.upgradeAmount(r, c)}</div>` : '';
        return `<div class="offer-item">${creatureCard(c, { action: 'pick', pick: true, small: true })}${ex}</div>`;
      }).join('');
    }
    return `<div class="modal-bg"><div class="modal wide">
      <h2>${titles[p.purpose]}${p.cost ? ` · 🦪 ${p.cost}` : ''}</h2>
      <div class="coll">${items}</div>
      ${p.cancel ? '<button class="btn" data-action="pickcancel">Annuler</button>' : ''}</div></div>`;
  }
  if (!S.modal) return '';
  if (S.modal === 'rules') {
    return `<div class="modal-bg" data-action="closemodal"><div class="modal rules" data-stop>
      <h2>Règles de Krazy Sea</h2>${RULES}
      <button class="btn primary" data-action="closemodal">Compris !</button></div></div>`;
  }
  if (S.modal === 'bag') {
    const d = r.dive;
    const where = (id) => (!d ? '' : d.hand.includes(id) ? 'en main' : d.draw.includes(id) ? 'pioche' : d.discard.includes(id) ? 'défausse' : 'récif');
    const items = [...r.bag].sort((a, b) => a.t.localeCompare(b.t)).map((c) => `<div class="offer-item">${creatureCard(c, { small: true })}${d ? `<div class="muted">${where(c.id)}</div>` : ''}</div>`).join('');
    return `<div class="modal-bg" data-action="closemodal"><div class="modal wide" data-stop>
      <h2>Votre banc · ${r.bag.length} créatures</h2>
      <div class="coll">${items}</div>
      <h3>Coraux</h3><div class="coll">${r.corals.map((c) => coralCard(c.t, { lvl: c.lvl })).join('')}</div>
      ${r.artifacts.length ? `<h3>Artefacts</h3><div class="coll">${r.artifacts.map((a) => artifactCard(a)).join('')}</div>` : ''}
      <button class="btn" data-action="closemodal">Fermer</button></div></div>`;
  }
  if (S.modal === 'bestiary') {
    const cr = Object.keys(CREATURES).map((t) => (meta.seenC.includes(t) ? creatureCard({ t }, { small: true }) : '<div class="card small unknown"><div class="c-em">❔</div><div class="c-nm">???</div></div>')).join('');
    const co = Object.keys(CORALS).map((t) => (meta.seenK.includes(t) ? coralCard(t) : '<div class="card small unknown"><div class="c-em">❔</div><div class="c-nm">???</div></div>')).join('');
    return `<div class="modal-bg" data-action="closemodal"><div class="modal wide" data-stop>
      <h2>Bestiaire · ${meta.seenC.length}/${Object.keys(CREATURES).length}</h2>
      <p class="muted">Les créatures et coraux que vous avez accueillis dans votre récif.</p>
      <div class="coll">${cr}</div><h3>Coraux · ${meta.seenK.length}/${Object.keys(CORALS).length}</h3><div class="coll">${co}</div>
      <button class="btn" data-action="closemodal">Fermer</button></div></div>`;
  }
  return '';
}

// ── Rendu ───────────────────────────────────────────────────
function render() {
  const r = S.run;
  if (S.screen === 'title' || !r) renderTitle();
  else ({ map: renderMap, dive: renderDive, reward: renderReward, shop: renderShop, event: renderEvent, rest: renderRest, end: renderEnd })[r.phase]();
  const m = modalHTML();
  if (m) app.insertAdjacentHTML('beforeend', m);
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
  if (!r) return;
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
    if (r && r.v === 2) { S.run = r; lastBosses = r.bosses; S.screen = 'game'; resetUI(); }
  },
  rules: () => { S.modal = 'rules'; },
  bestiary: () => { S.modal = 'bestiary'; },
  bag: () => { S.modal = 'bag'; },
  closemodal: () => { S.modal = null; },
  menu: () => { S.screen = 'title'; S.modal = null; },
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

render();
