import { CANDIDATES } from './arcade-content.js';
import { MINOR_FACTIONS } from '../../simulation/world.js';
import { MINOR_LOOKS } from '../personnages/minor-characters.js';

/* Soirée électorale façon « 20 h » : compte à rebours, portraits en studio, scores qui défilent. */
const FEMININE = new Set(['le_pen']);
// Moments clés de l’annonce, en millisecondes (les délais CSS suivent les mêmes valeurs).
// `hold` : temps pendant lequel le résultat complet reste affiché avant que les boutons répondent.
const TIMELINE = { count: 1900, countDuration: 1300, stamp: 3200, end: 3700, confettiLife: 6500, hold: 3000 };
// Boutons qui quittent l’écran : verrouillés tant que le résultat n’a pas été vu quelques secondes.
const LEAVING = ['continue', 'summary'];
const CONFETTI_COUNT = 90;
const CONFETTI_COLORS = ['#2457d6', '#ffffff', '#e5333b', '#ffd35a'];
const format = (n, digits = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const person = id => CANDIDATES.find(c => c.id === id);
// Portraits du face-à-face (fonds CSS) : chargés pendant la campagne pour apparaître dès 20 h, puis gardés en mémoire.
const PORTRAITS = [
  new URL('../../../assets/images/resultats/portrait-melenchon.png', import.meta.url).href,
  new URL('../../../assets/images/resultats/portrait-le-pen.png', import.meta.url).href,
  new URL('../../../assets/images/resultats/portrait-philippe.png', import.meta.url).href,
];
const warmedPortraits = [];
export function warmElectionPortraits() {
  if (warmedPortraits.length) return;
  for (const src of PORTRAITS) {
    const image = new Image(); image.decoding = 'async'; image.src = src;
    image.decode?.().catch(() => { /* Hors ligne : l’écran chargera l’image à l’affichage. */ });
    warmedPortraits.push(image);
  }
}
const fem = id => FEMININE.has(id) ? 'e' : '';

export function expressedScores(scores, factions) {
  const total = factions.reduce((sum, f) => sum + scores[f], 0);
  if (!total) return null;
  const parts = factions.map((f, i) => ({ f, i, exact: scores[f] / total * 10000 }));
  for (const part of parts) part.units = Math.floor(part.exact);
  const missing = 10000 - parts.reduce((sum, part) => sum + part.units, 0);
  const ranked = [...parts].sort((a, b) => (b.exact - b.units) - (a.exact - a.units) || a.i - b.i);
  for (let i = 0; i < missing; i++) ranked[i].units++;
  return Object.fromEntries(parts.map(p => [p.f, p.units / 100]));
}

export function electionModel(state) {
  const first = state.phase === 'FIRST_ROUND_RESULTS';
  const result = first ? state.first_round_result : state.result;
  // Élu dès le premier tour (plus de 50 % des voix exprimées) : pas de second tour.
  const direct = !first && !!result.first_round;
  const ranking = first ? result.ranking : direct ? state.first_round_result.ranking : [result.winner, result.second];
  const local = state.local_candidate_id.split(':')[1];
  const earlier = !first && !direct && state.first_round_result;
  // Premier tour : les pourcentages portent sur toutes les voix exprimées, autres candidats compris.
  const minors = first || direct ? MINOR_FACTIONS.filter(f => Number.isFinite(result.scores[f])) : [];
  const scores = expressedScores(result.scores, [...ranking, ...minors]);
  return { first, direct, ranking, scores, neutral: result.scores.neutral,
    minors: minors.map(f => ({ f, name: MINOR_LOOKS[f].fullName, value: scores?.[f] ?? null })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.f.localeCompare(b.f)),
    eliminated: first ? ranking[2] : direct ? null : state.eliminated_faction ?? null,
    firstRound: earlier ? { ranking: earlier.ranking, scores: expressedScores(earlier.scores, earlier.ranking) } : null,
    success: first ? ranking.slice(0, 2).includes(local) : result.winner === local,
    local, tie: !!result.tie_break };
}

// Titre unique de l’annonce : le joueur sait quel candidat il joue, inutile de le répéter ailleurs.
function verdict(m) {
  const g = fem(m.local);
  if (m.first) return m.success ? `Qualifié${g} !` : `Éliminé${g}`;
  return m.success ? 'Victoire !' : 'Défaite';
}

// Bandeau du bas : tous les autres candidats à la suite, puis l’abstention.
function tickerItems(m) {
  if (!m.scores) return ['Aucune voix exprimée'];
  const items = [];
  if (m.first || m.direct) items.push(...m.ranking.slice(2).map(f => `${person(f).name} ${format(m.scores[f])} %`), ...m.minors.map(x => `${x.name} ${format(x.value)} %`));
  if (m.firstRound?.scores) items.push(`Rappel du premier tour : ${m.firstRound.ranking.map(f => `${person(f).short} ${format(m.firstRound.scores[f])} %`).join(' · ')}`);
  items.push(`<b>Abstention et votes blancs ${format(m.neutral)} %</b>`);
  if (m.tie) items.push(tieText(m));
  return items;
}
const tieText = m => m.first ? 'Égalité de qualification départagée selon la graine de la partie' : 'Égalité départagée : score du premier tour, puis graine de la partie';

// Une décimale, comme les soirs d’élection ; deux si les deux finalistes seraient sinon affichés à égalité.
function digits(m) {
  const [a, b] = m.ranking.slice(0, 2).map(f => m.scores?.[f] ?? 0);
  return a !== b && format(a) === format(b) ? 2 : 1;
}
const scoreHtml = (value, d) => { const [whole, decimals] = format(value, d).split(','); return `${whole}<small>,${decimals}</small>`; };

// Une moitié du face-à-face : portrait côté extérieur, score et nom côté ligne centrale.
function half(m, f, index) {
  const c = person(f), winner = !m.first && index === 0, value = m.scores?.[f], d = digits(m);
  const classes = ['election-candidate', winner && 'is-winner', !m.first && !winner && 'is-loser'].filter(Boolean).join(' ');
  // L’étiquette garde sa place des deux côtés : scores et noms restent alignés de part et d’autre de la ligne.
  return `<article class="${classes}" data-faction="${f}" data-side="${index ? 'right' : 'left'}">
    <div class="election-portrait" role="img" aria-label="${c.name}"></div>
    <div class="election-info">
      <span class="election-stamp"${winner ? '' : ' aria-hidden="true"'}>${winner ? `<span aria-hidden="true">♛</span> Élu${fem(f)}` : '&nbsp;'}</span>
      <p class="election-score"><span data-value="${value ?? ''}" data-digits="${d}">${value == null ? '—' : scoreHtml(value, d)}</span>${value == null ? '' : '<small>%</small>'}</p>
      <h2><small>${c.name.slice(0, -c.short.length).trim()}</small>${c.short}</h2>
    </div></article>`;
}

// Parcours imposé : premier tour → second tour, puis résultat final → bilan (où se trouvent Rejouer et le menu).
function actions(m, { host }) {
  if (!m.first) return '<button class="election-primary" data-action="summary">Voir le bilan <span aria-hidden="true">➜</span></button>';
  return host ? '<button class="election-primary" data-action="continue">Continuer <span aria-hidden="true">➜</span></button>' : '<span class="election-waiting">En attente de l’hôte…</span>';
}

function markup(m, options) {
  const items = tickerItems(m), ticker = items.map(t => `<span>${t}</span>`).join('');
  const firstRound = m.first || m.direct;
  return `<div class="election-stage" data-round="${m.first ? 'first' : 'second'}" data-outcome="${m.success ? 'success' : 'failure'}">
    <div class="election-backdrop" aria-hidden="true"></div>
    <div class="election-screen">
      <header class="election-top">
        <span class="election-brand"><i class="election-flag" aria-hidden="true"></i><b>Présidentielle</b> <strong>2027</strong></span>
        <span class="election-live"><b><i aria-hidden="true"></i>${options.preview ? 'Données fictives' : 'En direct'}</b><time>20:00</time></span>
      </header>
      <div class="election-duel">
        ${half(m, m.ranking[0], 0)}
        ${half(m, m.ranking[1], 1)}
        <span class="election-divider" aria-hidden="true"></span>
        <div class="election-heading"><p>${firstRound ? 'Résultats du premier tour' : 'Résultats du second tour'}</p>
          <h1 class="election-verdict" tabindex="-1" role="status">${verdict(m)}</h1></div>
      </div>
      <footer class="election-footer">
        <div class="election-ticker"><b>Résultats</b><div class="election-ticker-window"><p class="election-ticker-track" style="--items:${items.length}">${ticker}<span aria-hidden="true" class="election-ticker-copy">${ticker}</span></p></div></div>
        <div class="election-actions">${actions(m, options)}</div>
      </footer>
    </div>
    <div class="election-countdown" aria-hidden="true"><p>Estimations</p><strong>19:59:57</strong><span>Présidentielle <b>2027</b></span></div>
    <div class="election-wipe" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="election-flash" aria-hidden="true"></div>
    <div class="election-confetti" aria-hidden="true"></div>
  </div>`;
}

export class ElectionResults {
  constructor(element) { this.element = element; this.timers = []; this.frame = 0; this.stage = null; }
  stop() { this.timers.forEach(clearTimeout); this.timers = []; cancelAnimationFrame(this.frame); this.frame = 0; }
  clear() { this.stop(); this.stage = null; this.element.replaceChildren(); }
  later(ms, callback) { this.timers.push(setTimeout(callback, ms)); }
  values() { return [...this.stage.querySelectorAll('[data-value]:not([data-value=""])')]; }
  leavingButtons() { return LEAVING.map(action => this.stage.querySelector(`[data-action="${action}"]`)).filter(Boolean); }
  render(model, { preview = false, host = true, multiplayer = false, animate = true, onContinue, onSummary } = {}) {
    this.clear(); this.model = model; this.celebrated = false;
    this.element.innerHTML = markup(model, { preview, host, multiplayer });
    this.stage = this.element.querySelector('.election-stage');
    for (const [action, callback] of Object.entries({ continue: onContinue, summary: onSummary })) {
      const button = this.element.querySelector(`[data-action="${action}"]`);
      if (button) { button.hidden = !callback; button.onclick = callback; }
    }
    // Les boutons existent dès l’ouverture (même invisibles pendant l’animation) : un clic ou un appui
    // hérité de la campagne pourrait sinon quitter la partie avant que le joueur ait lu son résultat.
    for (const button of this.leavingButtons()) button.disabled = true;
    this.element.querySelector('.election-actions').classList.add('is-locked');
    // Le titre reçoit le focus : une touche tenue pendant la campagne ne valide pas un bouton par erreur.
    this.element.querySelector('h1').focus({ preventScroll: true });
    if (!animate || reducedMotion()) { this.finish(); this.celebrate(); return; }
    this.stage.classList.add('is-playing');
    for (const el of this.values()) el.innerHTML = scoreHtml(0, Number(el.dataset.digits));
    const clock = this.stage.querySelector('.election-countdown strong');
    ['19:59:58', '19:59:59', '20:00:00'].forEach((time, i) => this.later(300 * (i + 1), () => { clock.textContent = time; }));
    this.later(TIMELINE.count, () => this.countUp());
    this.later(TIMELINE.stamp, () => this.celebrate());
    this.later(TIMELINE.end, () => this.finish());
    // Un clic sur le plateau passe directement au résultat complet.
    this.stage.addEventListener('pointerdown', event => {
      if (this.stage?.classList.contains('is-playing') && !event.target.closest('button')) this.skip();
    });
  }
  countUp() {
    const values = this.values(), start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / TIMELINE.countDuration), eased = 1 - (1 - t) ** 3;
      for (const el of values) el.innerHTML = scoreHtml(Number(el.dataset.value) * eased, Number(el.dataset.digits));
      this.frame = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.frame = requestAnimationFrame(tick);
  }
  finish() {
    cancelAnimationFrame(this.frame); this.frame = 0;
    for (const el of this.values()) el.innerHTML = scoreHtml(Number(el.dataset.value), Number(el.dataset.digits));
    this.stage.classList.remove('is-playing');
    // Le résultat complet est visible : le compte à rebours de déverrouillage commence maintenant.
    const actions = this.stage.querySelector('.election-actions');
    actions.style.setProperty('--hold', `${TIMELINE.hold}ms`);
    actions.classList.add('is-holding');
    this.later(TIMELINE.hold, () => {
      for (const button of this.leavingButtons()) button.disabled = false;
      actions.classList.remove('is-locked', 'is-holding');
    });
  }
  skip() { this.stop(); this.finish(); this.celebrate(); }
  celebrate() {
    if (this.celebrated || !this.model.success || reducedMotion()) return;
    this.celebrated = true;
    const layer = this.stage.querySelector('.election-confetti');
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const piece = document.createElement('i');
      piece.className = ['', 'is-ribbon', 'is-round'][i % 3];
      piece.style.cssText = `--x:${(i * 37) % 100}%;--drift:${(i * 53) % 21 - 10}cqw;--delay:${(i % 15) * .08}s;--fall:${2.8 + (i % 5) * .35}s;--turn:${i % 2 ? 720 : -640}deg;--c:${CONFETTI_COLORS[i % 4]}`;
      layer.append(piece);
    }
    this.later(TIMELINE.confettiLife, () => layer.replaceChildren());
  }
}
