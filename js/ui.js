// ─────────────────────────────────────────────────────────────
//  Krazy Sea — interface
// ─────────────────────────────────────────────────────────────
import { CORALS, SPECIES, TREASURES, MODIFIERS, DIVES, DIVERS, POS_LABEL, POS_ICON } from './data.js';
import * as E from './engine.js';

const app = document.getElementById('app');
const SAVE_KEY = 'krazy-sea-save-v1';
const META_KEY = 'krazy-sea-meta-v1';

const S = {
  screen: 'title',   // title | dive | reward | shop | end
  run: null, dive: null,
  ui: { m: 'idle' },
  result: null, reward: null, shop: null,
  modal: null,       // rules | collection | remove | null
  diver: 'exploratrice',
};

// ── Stockage ────────────────────────────────────────────────
function loadJSON(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
const meta = loadJSON(META_KEY, { runs: 0, wins: 0, bestDive: 1, bestTotal: 0 });

function save() {
  if (!S.run || S.screen === 'end' || S.screen === 'title') return;
  const { screen, run, dive, ui, result, reward, shop } = S;
  saveJSON(SAVE_KEY, { screen, run, dive, ui, result, reward, shop });
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
function loadSave() {
  const s = loadJSON(SAVE_KEY, null);
  if (!s || !s.run) return false;
  Object.assign(S, s, { modal: null });
  let max = 0;
  JSON.stringify(s, (k, v) => { if ((k === 'uid' || k === 'id') && typeof v === 'number') max = Math.max(max, v); return v; });
  E.bumpUid(max);
  return true;
}
const hasSave = () => !!loadJSON(SAVE_KEY, null);

// ── Utilitaires ─────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pips = (n) => (n === 0 ? '<span class="cost free">0</span>' : `<span class="cost">${n}</span>`);
const familyName = (f) => (CORALS[f] ? CORALS[f].name : f);

function cardHTML(card, o = {}) {
  const cls = ['card', card.kind, o.selected && 'selected', o.playable && 'playable',
    o.dim && 'dim', o.pick && 'pick', o.chosen && 'chosen', o.small && 'small'].filter(Boolean).join(' ');
  const attrs = `data-uid="${card.uid ?? card.id}" ${o.action ? `data-action="${o.action}"` : ''}`;
  if (card.kind === 'coral') {
    const c = CORALS[card.coral];
    const cost = o.d ? E.cardCost(o.d, card, 0) : c.cost;
    return `<div class="${cls}" ${attrs} style="--fam:${c.color}">
      <div class="coral-face">
        <div class="ch"><span class="kind">Corail</span>${pips(cost)}</div>
        <div class="big">🪸</div>
        <div class="nm">${c.name}${c.rare ? ' <span class="rare">★</span>' : ''}</div>
        <div class="tx">${c.text}</div>
      </div></div>`;
  }
  const fam = CORALS[card.color];
  const halves = card.halves.map((h, i) => {
    const sp = SPECIES[h];
    const cost = o.d ? E.cardCost(o.d, card, i) : sp.cost;
    const hcls = ['half', o.halfSel === i && 'hsel'].filter(Boolean).join(' ');
    return `<div class="${hcls}" data-half="${i}">
      <div class="hh"><span class="pos" title="${POS_LABEL[sp.pos]}">${POS_ICON[sp.pos]}</span>
        <span class="em">${sp.emoji}</span><span class="nm">${sp.name}${sp.rare ? ' <span class="rare">★</span>' : ''}</span>${pips(cost)}</div>
      <div class="tags">${POS_LABEL[sp.pos]} · ${sp.tags.join(', ')}${sp.stack ? ' · empilable' : ''}</div>
      <div class="tx">${sp.text}</div>
    </div>`;
  }).join('');
  return `<div class="${cls}" ${attrs} style="--fam:${fam.color}" title="Symbiose avec : ${fam.name}">
    ${halves}<div class="gem" title="Symbiose : ${fam.name}"></div></div>`;
}

function treasureChip(t) {
  const x = TREASURES[t];
  return `<span class="chip" title="${esc(x.name + ' — ' + x.text)}">${x.emoji}</span>`;
}

// ── Écran titre ─────────────────────────────────────────────
function renderTitle() {
  const divers = Object.entries(DIVERS).map(([k, v]) => {
    const locked = v.unlock && meta.bestDive < v.unlock.bestDive && meta.wins === 0;
    return `<button class="diver ${S.diver === k ? 'on' : ''} ${locked ? 'locked' : ''}" data-action="diver" data-k="${k}" ${locked ? 'disabled' : ''}>
      <div class="em">${locked ? '🔒' : v.emoji}</div><div class="nm">${v.name}</div>
      <div class="tx">${locked ? v.unlock.text : v.text}</div></button>`;
  }).join('');
  app.innerHTML = `<div class="title-screen">
    <img class="pixel-logo" src="favicon.svg" alt="" width="96" height="96"><div class="logo">Krazy Sea</div>
    <p class="pitch">Faites pousser des coraux, attirez-y poissons, crustacés et mammifères marins,
    et enchaînez <b>six plongées</b> de plus en plus exigeantes. Entre deux plongées, enrichissez votre collection de cartes
    et dénichez des trésors. Une seule erreur… et l'expédition s'arrête.</p>
    <h3>Choisissez votre plongeur</h3>
    <div class="divers">${divers}</div>
    <div class="row">
      ${hasSave() ? '<button class="btn primary" data-action="continue">Reprendre l’expédition</button>' : ''}
      <button class="btn ${hasSave() ? '' : 'primary'}" data-action="newrun">Nouvelle expédition</button>
      <button class="btn" data-action="rules">Règles</button>
    </div>
    <div class="meta">Expéditions : ${meta.runs} · Victoires : ${meta.wins} · Plus loin : plongée ${meta.bestDive}</div>
    <div class="credit">Inspiré par les mécaniques de cartes partagées de <i>Forêt Mixte</i>, réinventé en solo roguelite sous-marin.</div>
  </div>`;
}

// ── Écran de plongée ────────────────────────────────────────
function renderDive() {
  const { run, dive: d, ui } = S;
  const sc = E.computeScore(run, d);
  const drawing = d.taken > 0;
  const idle = ui.m === 'idle' && !d.ended;
  const eff = ui.m === 'effect' ? ui.queue[0] : null;

  // HUD
  const mods = d.mods.map((k) => `<span class="chip mod" title="${esc(MODIFIERS[k].text)}">${MODIFIERS[k].emoji} ${MODIFIERS[k].name}</span>`).join('');
  const tides = Array.from({ length: d.tidesNeeded }, (_, i) => `<span class="tide ${i < d.tides ? 'on' : ''}">🌊</span>`).join('');
  const pct = Math.min(100, (sc.total / d.target) * 100);
  const hud = `<header class="hud">
    <div class="h-left"><div class="dname">Plongée ${run.diveIndex + 1}/${DIVES.length} · ${d.cfg.name}</div>
      <div class="mods">${mods}</div></div>
    <div class="h-score"><div class="bar"><div class="fill ${sc.total >= d.target ? 'ok' : ''}" style="width:${pct}%"></div></div>
      <div class="sc"><b>${sc.total}</b> / ${d.target} pts</div></div>
    <div class="h-right">
      <div class="tides" title="Quand toutes les Marées sont montées, la plongée se termine.">${tides}</div>
      <div class="stats"><span title="Cartes restantes dans la pioche">🂠 ${d.drawPile.length}</span>
        <span title="Perles">🦪 ${run.pearls}</span> <span title="Tour">⏱ ${d.turn}</span></div>
      <div class="treasures">${run.treasures.map(treasureChip).join('')}</div>
      <div class="row small"><button class="btn tiny" data-action="rules">?</button>
      <button class="btn tiny" data-action="collection">Collection</button>
      <button class="btn tiny" data-action="quit">Menu</button></div>
    </div></header>`;

  // Courant
  const pickCourant = eff && (eff.type === 'takeCourant' || eff.type === 'epaveCourant');
  const canTake = (idle || drawing) && E.canTake(d);
  const courantCards = d.courant.map((c) => cardHTML(c, {
    small: true, d,
    pick: (canTake || pickCourant),
    chosen: pickCourant && ui.chosen.includes(c.uid),
    action: pickCourant ? 'effpick' : canTake ? 'takecourant' : '',
  })).join('');
  const courant = `<section class="courant">
    <div class="zone-label">Courant <span class="muted">${d.courant.length}/${d.courantMax} — déborde à ${d.courantMax}</span></div>
    <div class="courant-row">
      <div class="pile ${canTake && d.drawPile.length ? 'pick' : ''}" data-action="takedeck" title="Piocher la première carte">
        <div class="pile-face">🌊<br><span>${d.drawPile.length}</span></div></div>
      ${courantCards || '<div class="empty-note">Le Courant est vide.</div>'}
    </div></section>`;

  // Récif
  const targets = ui.m === 'target' ? E.validTargets(d, d.hand.find((c) => c.uid === ui.uid), ui.half) : [];
  const isT = (ci, s) => targets.some((t) => t.coral === ci && t.slot === s);
  const slotHTML = (coral, ci, s) => {
    const arr = coral.slots[s];
    const t = isT(ci, s);
    let inner = '';
    if (arr.length) {
      const sp = SPECIES[arr[0].sp];
      const pts = arr.reduce((a, p) => a + (sc.per.get(p.card.uid) || 0), 0);
      inner = `<span class="em">${sp.emoji}</span><span class="nm">${sp.name}${arr.length > 1 ? ` ×${arr.length}` : ''}</span><span class="pts">${pts}</span>`;
    } else inner = `<span class="ph">${s === 'top' ? '⬆' : s === 'bottom' ? '⬇' : s === 'left' ? '⬅' : '➡'}</span>`;
    return `<div class="slot s-${s} ${arr.length ? 'full' : ''} ${t ? 'target' : ''}" ${t ? `data-action="target" data-coral="${ci}" data-slot="${s}"` : ''}
      title="${arr.length ? esc(SPECIES[arr[0].sp].name + ' — ' + SPECIES[arr[0].sp].text) : ''}">${inner}</div>`;
  };
  const corals = d.reef.map((coral, ci) => {
    const c = CORALS[coral.type];
    return `<div class="coral" style="--fam:${c.color}">
      ${slotHTML(coral, ci, 'top')}${slotHTML(coral, ci, 'left')}
      <div class="core" title="${esc(c.name + ' — ' + c.text)}"><div class="em">🪸</div><div class="nm">${c.name}</div><div class="pts">${sc.per.get(coral.card.uid) || 0}</div></div>
      ${slotHTML(coral, ci, 'right')}${slotHTML(coral, ci, 'bottom')}</div>`;
  }).join('');
  const epave = `<div class="epave" title="Chaque carte de l'Épave rapporte des points en fin de plongée.">⚓ Épave<br><b>${d.epave.length}</b></div>`;
  const reef = `<section class="reef"><div class="zone-label">Votre récif <span class="muted">${d.reef.length} corail${d.reef.length > 1 ? 's' : ''}</span></div>
    <div class="reef-row">${corals || '<div class="empty-note">Plantez un premier corail pour accueillir des créatures.</div>'}${epave}</div></section>`;

  // Barre d'action
  const bar = `<section class="actionbar">${actionBar()}</section>`;

  // Main
  const pickHand = eff && eff.type === 'epaveHand';
  const hand = d.hand.map((c) => {
    const playable = idle && (c.kind === 'coral' ? E.canPlay(d, c, 0) : (E.canPlay(d, c, 0) || E.canPlay(d, c, 1)));
    const sel = (ui.m === 'selected' || ui.m === 'target' || ui.m === 'pay') && ui.uid === c.uid;
    const payable = ui.m === 'pay' && ui.uid !== c.uid;
    let action = '';
    if (idle || ui.m === 'selected') action = 'select';
    if (payable) action = 'paypick';
    if (pickHand) action = 'effpick';
    return cardHTML(c, {
      d, playable, selected: sel, halfSel: sel && ui.half !== undefined ? ui.half : undefined,
      pick: payable || pickHand, chosen: (payable || pickHand) && ui.chosen.includes(c.uid),
      dim: drawing, action,
    });
  }).join('');
  const handSec = `<section class="hand"><div class="zone-label">Votre main <span class="muted">${d.hand.length}/${d.handMax}</span></div>
    <div class="hand-row">${hand || '<div class="empty-note">Main vide — piochez !</div>'}</div></section>`;

  const logSec = `<details class="log"><summary>Journal</summary>${d.log.map((l) => `<div>${esc(l)}</div>`).join('')}</details>`;

  app.innerHTML = `<div class="dive">${hud}${courant}${reef}${bar}${handSec}${logSec}</div>${d.ended ? endDiveModal(sc) : ''}`;
}

function actionBar() {
  const { dive: d, ui } = S;
  if (d.ended) return `<div class="msg">La plongée est terminée.</div>`;
  if (d.taken > 0) {
    return `<div class="msg">Pioche : <b>${d.taken}/${d.drawLimit}</b> — prenez une carte de la pioche ou du Courant.</div>
      <button class="btn" data-action="finishdraw">Arrêter de piocher</button>`;
  }
  const extra = d.actions > 1 ? ` <span class="badge">+${d.actions - 1} action</span>` : '';
  if (ui.m === 'idle') {
    return `<div class="msg">Tour ${d.turn}${extra} — <b>Piochez ${d.drawLimit} cartes</b> (pioche ou Courant) <i>ou</i> <b>jouez une carte</b> de votre main.</div>
      <button class="btn ghost" data-action="pass" title="Passer cette action">Passer</button>`;
  }
  const card = d.hand.find((c) => c.uid === ui.uid);
  if (ui.m === 'selected') {
    let opts;
    if (card.kind === 'coral') {
      const ok = E.canPlay(d, card, 0);
      opts = `<button class="btn primary" data-action="choosehalf" data-half="0" ${ok ? '' : 'disabled'}>🪸 Planter (coût ${E.cardCost(d, card, 0)})</button>`;
    } else {
      opts = card.halves.map((h, i) => {
        const sp = SPECIES[h];
        const ok = E.canPlay(d, card, i);
        const why = ok ? '' : (!d.reef.length ? ' — il faut un corail' : E.cardCost(d, card, i) > d.hand.length - 1 ? ' — pas assez de cartes' : ' — aucun emplacement');
        return `<button class="btn ${ok ? 'primary' : ''}" data-action="choosehalf" data-half="${i}" ${ok ? '' : 'disabled'}>${sp.emoji} ${sp.name} · ${POS_LABEL[sp.pos]} (coût ${E.cardCost(d, card, i)})${why}</button>`;
      }).join('');
    }
    return `<div class="msg">Que voulez-vous jouer ?</div>${opts}<button class="btn ghost" data-action="cancel">Annuler</button>`;
  }
  if (ui.m === 'target') {
    return `<div class="msg">Choisissez un emplacement <span class="glow">en surbrillance</span> sur votre récif.</div>
      <button class="btn ghost" data-action="cancel">Annuler</button>`;
  }
  if (ui.m === 'pay') {
    return `<div class="msg">Payez en défaussant <b>${ui.need}</b> carte${ui.need > 1 ? 's' : ''} de votre main dans le Courant (${ui.chosen.length}/${ui.need}).</div>
      <button class="btn primary" data-action="confirmpay" ${ui.chosen.length === ui.need ? '' : 'disabled'}>Confirmer</button>
      <button class="btn ghost" data-action="cancel">Annuler</button>`;
  }
  if (ui.m === 'effect') {
    const e = ui.queue[0];
    const txt = {
      takeCourant: `Prenez jusqu'à <b>${e.n}</b> carte(s) du Courant.`,
      epaveCourant: `Choisissez jusqu'à <b>${e.n}</b> carte(s) du Courant à couler dans l'Épave.`,
      epaveHand: `Choisissez jusqu'à <b>${e.n}</b> carte(s) de votre main à couler dans l'Épave.`,
    }[e.type];
    return `<div class="msg">Effet : ${txt} (${ui.chosen.length}/${e.n})</div>
      <button class="btn primary" data-action="effok">Valider</button>`;
  }
  return '';
}

function endDiveModal(sc) {
  const d = S.dive;
  const ok = sc.total >= d.target;
  const lines = E.summarize(sc.lines).map((l) => `<div class="line"><span>${esc(l.label)}${l.n > 1 ? ` ×${l.n}` : ''}</span><b>${l.pts}</b></div>`).join('');
  return `<div class="modal-bg"><div class="modal">
    <h2>${ok ? '🎉 Plongée réussie !' : '💀 Plongée ratée…'}</h2>
    <p class="muted">${esc(d.endReason)}</p>
    <div class="bigscore ${ok ? 'ok' : 'ko'}">${sc.total} <span>/ ${d.target}</span></div>
    <div class="lines">${lines || '<div class="muted">Aucun point.</div>'}</div>
    <button class="btn primary" data-action="conclude">${ok ? 'Remonter à la surface' : 'Fin de l’expédition'}</button>
  </div></div>`;
}

// ── Récompense ──────────────────────────────────────────────
function renderReward() {
  const r = S.reward;
  app.innerHTML = `<div class="between">
    <h2>Récompense de plongée</h2>
    <p>Score <b>${S.result.total}</b> — vous gagnez <b>🦪 ${S.result.pearls} perles</b>. Choisissez une carte à ajouter à votre collection :</p>
    <div class="offer">${r.cards.map((c) => `<div class="offer-item">${cardHTML(c, { action: 'rewardpick' })}</div>`).join('')}</div>
    <button class="btn" data-action="rewardskip">Passer (+2 perles)</button>
  </div>`;
}

// ── Boutique (le Comptoir) ──────────────────────────────────
function renderShop() {
  const { run, shop } = S;
  const next = DIVES[run.diveIndex];
  const cards = shop.cards.map((c, i) => {
    if (!c) return `<div class="offer-item sold">Vendu</div>`;
    const p = E.cardPrice(c);
    return `<div class="offer-item">${cardHTML(c)}<button class="btn ${run.pearls >= p ? 'primary' : ''}" data-action="buycard" data-i="${i}" ${run.pearls >= p ? '' : 'disabled'}>Acheter · 🦪 ${p}</button></div>`;
  }).join('');
  const trs = shop.treasures.map((t, i) => {
    if (!t) return `<div class="treasure sold">Vendu</div>`;
    const x = TREASURES[t];
    return `<div class="treasure"><div class="em">${x.emoji}</div><div class="nm">${x.name}</div><div class="tx">${x.text}</div>
      <button class="btn ${run.pearls >= x.price ? 'primary' : ''}" data-action="buytreasure" data-i="${i}" ${run.pearls >= x.price ? '' : 'disabled'}>Acheter · 🦪 ${x.price}</button></div>`;
  }).join('');
  app.innerHTML = `<div class="between">
    <h2>⚓ Le Comptoir du port</h2>
    <div class="purse">Vos perles : <b>🦪 ${run.pearls}</b> · Collection : ${run.collection.length} cartes · Trésors : ${run.treasures.map(treasureChip).join('') || '—'}</div>
    <h3>Cartes</h3><div class="offer">${cards}</div>
    <h3>Trésors</h3><div class="treasures-shop">${trs || '<div class="muted">Plus de trésors à vendre.</div>'}</div>
    <h3>Services</h3>
    <div class="row"><button class="btn" data-action="removeopen" ${run.pearls >= run.removeCost ? '' : 'disabled'}>Retirer une carte de la collection · 🦪 ${run.removeCost}</button>
      <button class="btn" data-action="collection">Voir la collection</button></div>
    <div class="next">Prochaine plongée : <b>${next.name}</b> — objectif <b>${next.target} pts</b>${next.mods ? ` · ${next.mods} condition${next.mods > 1 ? 's' : ''} aléatoire${next.mods > 1 ? 's' : ''}` : ''}${next.boss ? ' · <b>plongée finale</b>' : ''}</div>
    <button class="btn primary big" data-action="nextdive">Plonger !</button>
  </div>`;
}

// ── Fin d'expédition ────────────────────────────────────────
function renderEnd() {
  const { run } = S;
  const win = run.diveIndex >= DIVES.length;
  const scores = run.scores.map((s, i) => `<div class="line"><span>${DIVES[i].name}</span><b>${s} / ${DIVES[i].target}</b></div>`).join('');
  app.innerHTML = `<div class="between end">
    <div class="logo">${win ? '🏆' : '🫧'}</div>
    <h2>${win ? 'Le Grand Récif est à vous !' : 'L’expédition s’achève'}</h2>
    <p>${win ? 'Six plongées réussies : votre récif restera dans les légendes.' : `Vous avez atteint la plongée ${run.diveIndex + 1} sur ${DIVES.length}.`}</p>
    <div class="lines">${scores}</div>
    <div class="row"><button class="btn primary" data-action="totitle">Retour au menu</button></div>
  </div>`;
}

// ── Fenêtres ────────────────────────────────────────────────
function modalHTML() {
  if (!S.modal) return '';
  if (S.modal === 'rules') {
    return `<div class="modal-bg" data-action="closemodal"><div class="modal rules" data-stop>
      <h2>Règles de Krazy Sea</h2>
      <h4>But</h4><p>Enchaîner six plongées. À chaque plongée, atteignez l'<b>objectif de points</b> avant que les <b>Marées</b> 🌊 ne montent toutes. Votre collection de cartes et vos trésors vous suivent d'une plongée à l'autre.</p>
      <h4>À votre tour</h4><p>Faites <b>une</b> action :</p>
      <ul><li><b>Piocher</b> : prenez 2 cartes, une par une, depuis la pioche et/ou le <b>Courant</b> (les cartes face visible). Main limitée à 10.</li>
      <li><b>Jouer une carte</b> : payez son coût en défaussant autant de cartes de votre main <b>dans le Courant</b>.</li></ul>
      <p>En fin de tour, la première carte de la pioche rejoint le Courant. S'il atteint 10 cartes, il <b>déborde</b> et tout est emporté.</p>
      <h4>Coraux et créatures</h4>
      <p>Les <b>coraux</b> forment votre récif. Chaque corail a 4 emplacements : <b>Surface</b> ⬆, <b>Fond</b> ⬇ et deux <b>Flancs</b> ⬅➡.</p>
      <p>Les cartes créatures montrent <b>deux créatures</b> : vous en choisissez une seule en jouant la carte. Chaque moitié indique son emplacement, son coût et ses points. Certaines sont <b>empilables</b> sur un emplacement occupé par la même espèce.</p>
      <p><b>Symbiose ✨</b> : le coin coloré d'une carte créature indique une famille de corail. Posez-la sur un corail de cette famille et vous piochez 1 carte.</p>
      <p><b>Épave ⚓</b> : certaines créatures y coulent des cartes ; chacune vaut 1 pt.</p>
      <h4>Fin de plongée</h4><p>Les Marées sont cachées dans le dernier tiers de la pioche. Quand la dernière est piochée ou révélée, la plongée s'arrête immédiatement et le récif est compté. Objectif atteint ? Vous gagnez des perles (davantage si vous dépassez l'objectif), une carte, puis faites vos emplettes au Comptoir.</p>
      <button class="btn primary" data-action="closemodal">Compris !</button></div></div>`;
  }
  if (S.modal === 'collection' || S.modal === 'remove') {
    const rm = S.modal === 'remove';
    const cards = S.run.collection.map((c) => cardHTML(c, { small: true, pick: rm, action: rm ? 'removepick' : '' })).join('');
    return `<div class="modal-bg" data-action="closemodal"><div class="modal wide" data-stop>
      <h2>${rm ? `Retirer une carte (🦪 ${S.run.removeCost})` : `Collection (${S.run.collection.length} cartes)`}</h2>
      <div class="coll">${cards}</div>
      <button class="btn" data-action="closemodal">Fermer</button></div></div>`;
  }
  return '';
}

// ── Rendu ───────────────────────────────────────────────────
function render() {
  ({ title: renderTitle, dive: renderDive, reward: renderReward, shop: renderShop, end: renderEnd })[S.screen]();
  if (S.modal) app.insertAdjacentHTML('beforeend', modalHTML());
  save();
}

// ── Logique d'interaction ───────────────────────────────────
function startNewRun() {
  clearSave();
  S.run = E.newRun(S.diver);
  meta.runs++; saveJSON(META_KEY, meta);
  beginDive();
}
function beginDive() {
  S.dive = E.startDive(S.run);
  S.ui = { m: 'idle' };
  S.screen = 'dive';
  meta.bestDive = Math.max(meta.bestDive, S.run.diveIndex + 1); saveJSON(META_KEY, meta);
}

function startPlay(card, half) {
  const d = S.dive;
  const targets = E.validTargets(d, card, half);
  S.ui = { m: 'target', uid: card.uid, half };
  if (targets.length === 1) chooseTarget(targets[0]);
}
function chooseTarget(target) {
  const d = S.dive;
  const card = d.hand.find((c) => c.uid === S.ui.uid);
  const need = E.cardCost(d, card, S.ui.half);
  S.ui = { ...S.ui, m: 'pay', target, need, chosen: [] };
  if (need === 0) executePlay();
}
function executePlay() {
  const d = S.dive;
  const { uid, half, target, chosen } = S.ui;
  const pending = E.playCard(S.run, d, uid, half, target, chosen);
  if (!pending) { S.ui = { m: 'idle' }; return; }
  S.ui = { m: 'effect', queue: pending, chosen: [] };
  nextEffect();
}
function nextEffect() {
  const d = S.dive;
  S.ui.queue = S.ui.queue.filter((e) => E.isEffectUseful(d, e));
  S.ui.chosen = [];
  if (!S.ui.queue.length) { S.ui = { m: 'idle' }; E.finishPlay(d); }
}

const handlers = {
  diver: (el) => { S.diver = el.dataset.k; },
  newrun: () => startNewRun(),
  continue: () => { if (!loadSave()) S.screen = 'title'; },
  rules: () => { S.modal = 'rules'; },
  collection: () => { S.modal = 'collection'; },
  closemodal: () => { S.modal = null; },
  quit: () => { S.screen = 'title'; },
  totitle: () => { S.screen = 'title'; S.run = null; },

  takedeck: () => {
    const d = S.dive;
    if (S.ui.m !== 'idle') S.ui = { m: 'idle' };
    E.takeFromDeck(d);
  },
  takecourant: (el) => {
    if (S.ui.m !== 'idle') S.ui = { m: 'idle' };
    E.takeFromCourant(S.dive, +el.dataset.uid);
  },
  finishdraw: () => E.finishDraw(S.dive),
  pass: () => { S.ui = { m: 'idle' }; E.passAction(S.dive); },

  select: (el, ev) => {
    const d = S.dive;
    const uid = +el.dataset.uid;
    const card = d.hand.find((c) => c.uid === uid);
    if (!card || d.taken > 0) return;
    if (S.ui.m === 'selected' && S.ui.uid === uid) {
      // Clic direct sur une moitié = choix rapide
      const hEl = ev.target.closest('[data-half]');
      if (hEl && card.kind === 'species' && E.canPlay(d, card, +hEl.dataset.half)) return startPlay(card, +hEl.dataset.half);
      if (card.kind === 'coral' && E.canPlay(d, card, 0)) return startPlay(card, 0);
      S.ui = { m: 'idle' }; return;
    }
    S.ui = { m: 'selected', uid };
  },
  choosehalf: (el) => {
    const card = S.dive.hand.find((c) => c.uid === S.ui.uid);
    startPlay(card, +el.dataset.half);
  },
  target: (el) => chooseTarget({ coral: +el.dataset.coral, slot: el.dataset.slot }),
  paypick: (el) => {
    const u = +el.dataset.uid;
    const ch = S.ui.chosen;
    if (ch.includes(u)) S.ui.chosen = ch.filter((x) => x !== u);
    else if (ch.length < S.ui.need) ch.push(u);
  },
  confirmpay: () => { if (S.ui.chosen.length === S.ui.need) executePlay(); },
  cancel: () => { S.ui = { m: 'idle' }; },

  effpick: (el) => {
    const u = +el.dataset.uid;
    const e = S.ui.queue[0];
    const ch = S.ui.chosen;
    let lim = e.n;
    if (e.type === 'takeCourant') lim = Math.min(e.n, S.dive.handMax - S.dive.hand.length);
    if (ch.includes(u)) S.ui.chosen = ch.filter((x) => x !== u);
    else if (ch.length < lim) ch.push(u);
  },
  effok: () => {
    E.resolveEffect(S.dive, S.ui.queue[0], S.ui.chosen);
    S.ui.queue.shift();
    nextEffect();
  },

  conclude: () => {
    const res = E.concludeDive(S.run, S.dive);
    S.result = res;
    meta.bestTotal = Math.max(meta.bestTotal, res.total);
    if (!res.success) { S.screen = 'end'; clearSave(); }
    else if (res.last) { meta.wins++; S.screen = 'end'; clearSave(); }
    else {
      S.reward = { cards: [E.randomOffer(), E.randomOffer(), E.randomOffer(0.6)] };
      S.screen = 'reward';
    }
    saveJSON(META_KEY, meta);
  },
  rewardpick: (el) => {
    const c = S.reward.cards.find((x) => x.id === +el.dataset.uid);
    if (c) S.run.collection.push(c);
    toShop();
  },
  rewardskip: () => { S.run.pearls += 2; toShop(); },
  buycard: (el) => {
    const i = +el.dataset.i; const c = S.shop.cards[i];
    if (!c || S.run.pearls < E.cardPrice(c)) return;
    S.run.pearls -= E.cardPrice(c); S.run.collection.push(c); S.shop.cards[i] = null;
  },
  buytreasure: (el) => {
    const i = +el.dataset.i; const t = S.shop.treasures[i];
    if (!t || S.run.pearls < TREASURES[t].price) return;
    S.run.pearls -= TREASURES[t].price; S.run.treasures.push(t); S.shop.treasures[i] = null;
  },
  removeopen: () => { S.modal = 'remove'; },
  removepick: (el) => {
    const id = +el.dataset.uid;
    if (S.run.pearls < S.run.removeCost || S.run.collection.length <= 20) return;
    S.run.collection = S.run.collection.filter((c) => c.id !== id);
    S.run.pearls -= S.run.removeCost; S.run.removeCost += 1; S.modal = null;
  },
  nextdive: () => beginDive(),
};

function toShop() { S.shop = E.makeShop(S.run); S.screen = 'shop'; }

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  // Clic à l'intérieur d'une fenêtre sans action propre : ne pas la fermer.
  if (el.dataset.action === 'closemodal' && el.classList.contains('modal-bg') && ev.target.closest('[data-stop]')) return;
  const h = handlers[el.dataset.action];
  if (!h || el.disabled) return;
  h(el, ev);
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { S, E, render });

render();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (S.modal) S.modal = null;
    else if (S.screen === 'dive' && ['selected', 'target', 'pay'].includes(S.ui.m)) S.ui = { m: 'idle' };
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { S, E, render });

render();
  }
});

if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { S, E, render });

render();
