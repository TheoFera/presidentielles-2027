import { CANDIDATES } from './arcade-content.js';

/* Soirée électorale façon « 20 h » : compte à rebours, portraits en studio, scores qui défilent. */
const FEMININE = new Set(['le_pen']);
// Moments clés de l’annonce, en millisecondes (les délais CSS suivent les mêmes valeurs).
const TIMELINE = { count: 1900, countDuration: 1300, stamp: 3200, end: 3700, confettiLife: 6500 };
const CONFETTI_COUNT = 90;
const CONFETTI_COLORS = ['#2457d6', '#ffffff', '#e5333b', '#ffd35a'];
const format = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const person = id => CANDIDATES.find(c => c.id === id);
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
  const ranking = first ? result.ranking : [result.winner, result.second];
  const local = state.local_candidate_id.split(':')[1];
  const earlier = !first && state.first_round_result;
  return { first, ranking, scores: expressedScores(result.scores, ranking), neutral: result.scores.neutral,
    eliminated: first ? ranking[2] : state.eliminated_faction ?? null,
    firstRound: earlier ? { ranking: earlier.ranking, scores: expressedScores(earlier.scores, earlier.ranking) } : null,
    success: first ? ranking.slice(0, 2).includes(local) : result.winner === local,
    local, tie: !!result.tie_break };
}

function verdict(m) {
  const g = fem(m.local), winner = person(m.ranking[0]);
  if (m.first) return m.success ? [`Qualifié${g} !`, 'Cap sur le second tour'] : [`Éliminé${g}`, 'Vous suivrez le second tour en spectateur'];
  if (m.success) return ['Victoire !', `Vous êtes élu${g} président${g} de la République`];
  return ['Défaite', m.ranking.includes(m.local) ? `${winner.short} remporte l’élection` : `Éliminé${g} au premier tour, ${winner.short} l’emporte`];
}

function tickerItems(m) {
  const [a, b, c] = m.ranking, pct = f => m.scores ? `${format(m.scores[f])} %` : '—';
  const items = m.scores ? [] : ['Aucune voix exprimée'];
  if (m.first) items.push(`Second tour : ${person(a).name} face à ${person(b).name}`, `${person(c).name} éliminé${fem(c)} avec ${pct(c)} des voix`);
  else {
    items.push(`${person(a).name} élu${fem(a)} président${fem(a)} avec ${pct(a)} des voix`);
    if (m.firstRound?.scores) items.push(`Rappel du premier tour : ${m.firstRound.ranking.map(f => `${person(f).short} ${format(m.firstRound.scores[f])} %`).join(' · ')}`);
  }
  items.push(`Électeurs neutres : ${format(m.neutral)} % du corps électoral`, 'Pourcentages calculés sur les seules voix attribuées aux candidats');
  if (m.tie) items.push(tieText(m));
  return items;
}
const tieText = m => m.first ? 'Égalité de qualification départagée selon la graine de la partie' : 'Égalité départagée : score du premier tour, puis graine de la partie';

function score(value, tag = 'p', className = 'election-score') {
  return `<${tag} class="${className}"><span data-value="${value ?? ''}">${value == null ? '—' : format(value)}</span>${value == null ? '' : '<small>%</small>'}</${tag}>`;
}

function tile(m, f, index) {
  const c = person(f), you = f === m.local, winner = !m.first && index === 0, value = m.scores?.[f];
  const stamp = m.first ? `Qualifié${fem(f)}` : winner ? `<span aria-hidden="true">♛</span> Élu${fem(f)}` : '';
  const classes = ['election-candidate', winner && 'is-winner', !m.first && !winner && 'is-loser', you && 'is-you'].filter(Boolean).join(' ');
  return `<article class="${classes}" data-faction="${f}" data-side="${index ? 'right' : 'left'}">
    ${winner ? '<span class="election-rays" aria-hidden="true"></span>' : ''}
    <div class="election-portrait" role="img" aria-label="${c.name}"><span class="election-art"></span></div>
    ${stamp ? `<span class="election-stamp">${stamp}</span>` : ''}
    <div class="election-plate">
      <div class="election-name"><span class="election-chips"><b>${index + 1}<sup>${index ? 'e' : 'er'}</sup></b>${you ? '<b class="election-you">Vous</b>' : ''}</span>
        <h2><small>${c.name.slice(0, -c.short.length).trim()}</small>${c.short}</h2>${m.first ? `<span class="election-gauge" style="--p:${value ?? 0}%"><i></i></span>` : ''}</div>
      ${score(value)}
    </div></article>`;
}

function band(m) {
  if (m.first) {
    const f = m.ranking[2], value = m.scores?.[f];
    return `<div class="election-band election-third${f === m.local ? ' is-you' : ''}" data-faction="${f}">
      <span class="election-avatar" aria-hidden="true"><span class="election-art"></span></span>
      <span class="election-out">Éliminé${fem(f)}</span><b class="election-rank">3<sup>e</sup></b><strong>${person(f).name}</strong>${f === m.local ? '<b class="election-you">Vous</b>' : ''}
      <span class="election-gauge" style="--p:${value ?? 0}%"><i></i></span>${score(value, 'span', 'election-third-score')}</div>`;
  }
  const [a, b] = m.ranking;
  return `<div class="election-band election-majority"><span data-faction="${a}">${person(a).short}</span>
    <div class="election-majority-bar" role="img" aria-label="${m.scores ? `${person(a).short} ${format(m.scores[a])} %, ${person(b).short} ${format(m.scores[b])} %` : 'Aucune voix exprimée'}">
      <i data-faction="${a}" style="--p:${m.scores?.[a] ?? 0}%"></i><i data-faction="${b}" style="--p:${m.scores?.[b] ?? 0}%"></i><em>50 %</em></div>
    <span data-faction="${b}">${person(b).short}</span></div>`;
}

function actions(m, { host, multiplayer }) {
  const main = m.first
    ? host ? '<button class="election-primary" data-action="continue">Continuer <span aria-hidden="true">➜</span></button>' : '<span class="election-waiting">En attente de l’hôte…</span>'
    : multiplayer ? '' : '<button class="election-primary" data-action="replay">Rejouer</button>';
  return `${main}<button data-action="return">Retour au menu</button>`;
}

function markup(m, options) {
  const [title, subtitle] = verdict(m), winner = m.ranking[0];
  const items = tickerItems(m), ticker = items.map(t => `<span>${t}</span>`).join('');
  return `<div class="election-stage" data-round="${m.first ? 'first' : 'second'}" data-outcome="${m.success ? 'success' : 'failure'}">
    <div class="election-backdrop" aria-hidden="true"><span class="election-beam"></span><span class="election-beam"></span><span class="election-watermark">2027</span></div>
    <div class="election-screen">
      <header class="election-top">
        <span class="election-brand"><i class="election-flag" aria-hidden="true"></i><b>Présidentielles</b> <strong>2027</strong></span>
        <span class="election-program">Soirée électorale <em>${m.first ? '1<sup>er</sup> tour' : '2<sup>nd</sup> tour'}</em></span>
        <span class="election-live"><b><i aria-hidden="true"></i>${options.preview ? 'Données fictives' : 'En direct'}</b><time>20:00</time></span>
      </header>
      <div class="election-heading"><p>${m.first ? 'Résultats du premier tour' : 'Résultats du second tour'}</p>
        <h1 tabindex="-1">${m.first ? 'Qualifiés pour le second tour' : `${person(winner).name} élu${fem(winner)} président${fem(winner)}`}</h1></div>
      <div class="election-duel">
        ${tile(m, m.ranking[0], 0)}
        <div class="election-center">
          <span class="election-cocarde" aria-hidden="true"></span>
          <span class="election-round">Votre résultat</span>
          <div class="election-verdict" role="status"><strong>${title}</strong><span>${subtitle}</span></div>
          <p class="election-neutral">${m.scores ? 'Électeurs neutres' : 'Aucune voix exprimée'}<b>${m.scores ? `${format(m.neutral)} %` : '—'}</b></p>
          ${m.tie ? `<p class="election-tie">${tieText(m)}.</p>` : ''}
        </div>
        ${tile(m, m.ranking[1], 1)}
      </div>
      ${band(m)}
      <footer class="election-footer">
        <div class="election-ticker"><b>Info</b><div class="election-ticker-window"><p class="election-ticker-track" style="--items:${items.length}">${ticker}<span aria-hidden="true" class="election-ticker-copy">${ticker}</span></p></div></div>
        <div class="election-actions">${actions(m, options)}</div>
      </footer>
    </div>
    <div class="election-countdown" aria-hidden="true"><p>Estimations</p><strong>19:59:57</strong><span>Présidentielles <b>2027</b></span></div>
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
  render(model, { preview = false, host = true, multiplayer = false, animate = true, onContinue, onReplay, onReturn } = {}) {
    this.clear(); this.model = model; this.celebrated = false;
    this.element.innerHTML = markup(model, { preview, host, multiplayer });
    this.stage = this.element.querySelector('.election-stage');
    for (const [action, callback] of Object.entries({ continue: onContinue, replay: onReplay, return: onReturn })) {
      const button = this.element.querySelector(`[data-action="${action}"]`);
      if (button) { button.hidden = !callback; button.onclick = callback; }
    }
    // Le titre reçoit le focus : une touche tenue pendant la campagne ne valide pas un bouton par erreur.
    this.element.querySelector('h1').focus({ preventScroll: true });
    if (!animate || reducedMotion()) { this.finish(); this.celebrate(); return; }
    this.stage.classList.add('is-playing');
    for (const el of this.values()) el.textContent = format(0);
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
      for (const el of values) el.textContent = format(Number(el.dataset.value) * eased);
      this.frame = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.frame = requestAnimationFrame(tick);
  }
  finish() {
    cancelAnimationFrame(this.frame); this.frame = 0;
    for (const el of this.values()) el.textContent = format(Number(el.dataset.value));
    this.stage.classList.remove('is-playing');
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
