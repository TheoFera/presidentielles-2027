import { CANDIDATES } from './arcade-content.js';
import { formatCarriedMoney } from '../carte/money.js';

/* Bilan de fin de partie : courbe des électeurs de chaque camp sur toute la partie, en % de l'électorat
   (nombre d'électeurs entre parenthèses), puis trois chiffres clés par camp. S'ouvre depuis la soirée électorale du second tour. */
const CAMPAIGN_SHARE = 0.8; // Part de la largeur du graphique réservée à la campagne ; le reste montre le sprint.
const CHART = { width: 640, height: 250, left: 40, right: 92, top: 14, bottom: 30 };
const FEMININE = new Set(['le_pen']);
// Nom et couleur des petits candidats (reprend l'accent de leur tenue, voir minor-characters.js).
const MINORS = {
  glucksmann: { name: 'Glucksmann', color: '#d9719f' }, roussel: { name: 'Roussel', color: '#d8404b' },
  arthaud: { name: 'Arthaud', color: '#b3342c' }, dupont_aignan: { name: 'Dupont-Aignan', color: '#9a7cc9' },
  retailleau: { name: 'Retailleau', color: '#2d8fcf' }, attal: { name: 'Attal', color: '#ee9322' },
};
const person = id => CANDIDATES.find(c => c.id === id);
const escape = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const whole = n => Math.round(n).toLocaleString('fr-FR');
const percent = n => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const support = (p, f) => p.support?.[f] || 0, voters = (p, f) => p.voters?.[f] || 0;

// Graduation lisible : 10, 15, 20, 25, 50, 100…
export function niceMax(value) {
  if (!(value > 0)) return 5;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 1.5, 2, 2.5, 5, 10].map(step => step * power).find(step => step >= value);
}

export function summaryModel(state) {
  const history = Array.isArray(state.match_history) ? state.match_history : [];
  // Le bilan retrace la course des trois candidats principaux.
  const factions = state.candidates.filter(c => !c.minor).map(c => c.faction_id);
  const ranking = state.result ? [state.result.winner, state.result.second, state.eliminated_faction].filter(Boolean) : factions;
  const order = [...ranking, ...factions.filter(f => !ranking.includes(f))];
  const campaign = history.filter(p => !p.sprint), sprint = history.filter(p => p.sprint);
  const start = history[0]?.tick ?? 0, j0 = campaign.at(-1)?.tick ?? start, end = history.at(-1)?.tick ?? j0;
  const share = sprint.length ? CAMPAIGN_SHARE : 1;
  const x = point => point.sprint
    ? share + (1 - share) * (end > j0 ? (point.tick - j0) / (end - j0) : 1)
    : share * (j0 > start ? (point.tick - start) / (j0 - start) : 0);
  // Petits candidats : une courbe fine jusqu'au premier tour (ils se retirent ensuite), classés par score final.
  const minors = state.candidates.filter(c => c.minor).map(c => c.faction_id)
    .sort((a, b) => support(campaign.at(-1) || {}, b) - support(campaign.at(-1) || {}, a));
  const max = Math.min(100, niceMax(Math.max(0, ...history.flatMap(p => [...factions, ...minors].map(f => support(p, f))))));
  const line = (faction, points) => ({ faction, points: points.map(p => ({ x: x(p), y: support(p, faction) / max, value: support(p, faction), voters: voters(p, faction) })) });
  const series = order.map(faction => {
    // Le camp éliminé s'arrête au début du sprint, quand ses électeurs redeviennent neutres.
    const points = history.filter((p, i) => faction !== state.eliminated_faction || !p.sprint || !history.slice(0, i).some(q => q.sprint));
    return line(faction, points);
  });
  const minorSeries = minors.map(faction => ({ ...line(faction, campaign), minor: true }));
  const moment = p => p.sprint ? 'au second tour' : p.days_remaining > 0 ? `à J-${p.days_remaining}` : 'le jour du premier tour';
  const camps = order.map((faction, index) => {
    const candidate = state.candidates.find(c => c.faction_id === faction);
    const peak = history.reduce((best, p) => !best || support(p, faction) > support(best, faction) ? p : best, null);
    const status = !state.result ? '' : index === 0 ? `Élu${FEMININE.has(faction) ? 'e' : ''}` : faction === state.eliminated_faction ? 'Éliminé au 1er tour' : '2e du second tour';
    return { faction, local: candidate?.id === state.local_candidate_id, status,
      peak: peak ? support(peak, faction) : 0, peakVoters: peak ? voters(peak, faction) : 0, peakMoment: peak ? moment(peak) : '',
      earned: candidate?.total_earned || 0, spent: candidate?.total_spent || 0 };
  });
  const ticks = [];
  // Trois repères de jours arrondis, adaptés à la durée de la campagne (J-30 ou J-365…).
  const first = campaign[0]?.days_remaining || 0, round = d => first >= 60 ? Math.round(d / 10) * 10 : Math.round(d);
  for (const days of [...new Set([first, round(first * 2 / 3), round(first / 3)])].filter(d => d > 0)) {
    const point = campaign.find(p => p.days_remaining <= days);
    if (point && !ticks.some(t => Math.abs(t.x - x(point)) < 0.08)) ticks.push({ x: x(point), label: `J-${days}` });
  }
  if (campaign.length) ticks.push({ x: share, label: '1er tour' });
  if (sprint.length) ticks.push({ x: 1, label: 'Fin' });
  return { series, minorSeries, camps, max, ticks, eliminated: state.eliminated_faction ?? null, sprintStart: sprint.length ? share : null, empty: history.length < 2 };
}

function chart(model) {
  const { width, height, left, right, top, bottom } = CHART;
  const w = width - left - right, h = height - top - bottom;
  const px = x => (left + x * w).toFixed(1), py = y => (top + (1 - y) * h).toFixed(1);
  const grid = [0, 0.5, 1].map(y => `<line x1="${left}" x2="${left + w}" y1="${py(y)}" y2="${py(y)}"/><text class="summary-axis" x="${left - 6}" y="${py(y)}" dy="4" text-anchor="end">${percent(model.max * y)}</text>`).join('');
  const sprint = model.sprintStart == null ? '' : `<rect class="summary-sprint" x="${px(model.sprintStart)}" y="${top}" width="${(w * (1 - model.sprintStart)).toFixed(1)}" height="${h}"/><text class="summary-sprint-label" x="${px((1 + model.sprintStart) / 2)}" y="${top + 14}" text-anchor="middle">2nd tour</text>`;
  const ticks = model.ticks.map(t => `<text class="summary-axis" x="${px(t.x)}" y="${height - 8}" text-anchor="${t.x === 0 ? 'start' : t.x === 1 ? 'end' : 'middle'}">${t.label}</text>`).join('');
  // Les étiquettes de fin de courbe sont écartées si elles se chevauchent ; le camp éliminé n'en a pas.
  const labels = model.series.filter(s => s.faction !== model.eliminated).map(s => ({ s, last: s.points.at(-1) })).filter(l => l.last).map(l => ({ ...l, y: Number(py(l.last.y)) })).sort((a, b) => a.y - b.y);
  labels.forEach((l, i) => { if (i && l.y - labels[i - 1].y < 15) l.y = labels[i - 1].y + 15; });
  const lines = [...model.series].reverse().map((s, index) => {
    if (s.points.length < 2) return '';
    const path = s.points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x)} ${py(p.y)}`).join(' ');
    const local = model.camps.find(c => c.faction === s.faction)?.local;
    const area = local ? `<path class="summary-area" d="${path} L${px(s.points.at(-1).x)} ${py(0)} L${px(s.points[0].x)} ${py(0)} Z"/>` : '';
    return `<g data-faction="${s.faction}" class="summary-series${local ? ' is-you' : ''}" style="--delay:${index * 0.18}s">${area}<path class="summary-line" pathLength="1" d="${path}"/><circle class="summary-dot" cx="${px(s.points.at(-1).x)}" cy="${py(s.points.at(-1).y)}" r="${local ? 5 : 4}"/></g>`;
  }).join('');
  const minorLines = model.minorSeries.map(s => s.points.length < 2 ? '' : `<g data-faction="${s.faction}" class="summary-series is-minor" style="--party:${MINORS[s.faction]?.color || '#9fb3cc'};--delay:0s"><path class="summary-line" pathLength="1" d="${s.points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x)} ${py(p.y)}`).join(' ')}"/></g>`).join('');
  const ends = labels.map(l => `<text data-faction="${l.s.faction}" class="summary-end" x="${Number(px(l.last.x)) + 9}" y="${l.y}" dy="4">${percent(l.last.value)} (${whole(l.last.voters)})</text>`).join('');
  const description = model.series.map(s => `${person(s.faction)?.short} : ${percent(s.points.at(-1)?.value ?? 0)} (${whole(s.points.at(-1)?.voters ?? 0)} électeurs) à la fin`).join(', ');
  return `<svg class="summary-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution des électeurs de chaque camp, en pourcentage de l’électorat. ${escape(description)}.">
    ${sprint}<g class="summary-grid">${grid}</g>${minorLines}${lines}${ends}${ticks}</svg>`;
}

// Légende des petits candidats : leur score au premier tour (nombre d'électeurs).
function minorLegend(model) {
  if (!model.minorSeries.length) return '';
  const items = model.minorSeries.map(s => {
    const last = s.points.at(-1);
    return `<li style="--party:${MINORS[s.faction]?.color || '#9fb3cc'}"><i aria-hidden="true"></i>${escape(MINORS[s.faction]?.name || s.faction)} <b>${percent(last?.value ?? 0)}</b> <small>(${whole(last?.voters ?? 0)})</small></li>`;
  }).join('');
  return `<ul class="summary-minors" aria-label="Petits candidats au premier tour">${items}</ul>`;
}

function card(camp) {
  const c = person(camp.faction);
  return `<article class="summary-camp${camp.local ? ' is-you' : ''}" data-faction="${camp.faction}">
    <header><span class="election-avatar" aria-hidden="true"><span class="election-art"></span></span>
      <div><strong>${escape(c?.short || camp.faction)}</strong>${camp.status ? `<small>${camp.status}</small>` : ''}</div>${camp.local ? '<b class="election-you">Vous</b>' : ''}</header>
    <dl>
      <div><dt>Meilleur score</dt><dd>${percent(camp.peak)}<small>(${whole(camp.peakVoters)}) ${camp.peakMoment}</small></dd></div>
      <div><dt>Fonds récoltés</dt><dd>${formatCarriedMoney(camp.earned)}</dd></div>
      <div><dt>Dépenses</dt><dd>${formatCarriedMoney(camp.spent)}</dd></div>
    </dl></article>`;
}

export function summaryMarkup(model) {
  return `<div class="match-summary-panel">
    <header class="match-summary-head"><div><p>Soirée électorale · Bilan</p><h2 id="match-summary-title" tabindex="-1">Bilan de la partie</h2></div>
      <button type="button" data-summary="close">← Résultats</button></header>
    <section class="summary-chart-card"><h3>Électeurs de chaque camp <small>en % de l’électorat · (nombre d’électeurs)</small></h3>
      ${model.empty ? '<p class="summary-empty">Pas assez de relevés pour tracer l’évolution de cette partie.</p>' : chart(model) + minorLegend(model)}</section>
    <div class="summary-camps">${model.camps.map(card).join('')}</div></div>`;
}

export class MatchSummary {
  constructor(host) { this.host = host; this.element = null; }
  open(state, onClose) {
    this.close();
    const element = document.createElement('div');
    element.className = 'match-summary'; element.setAttribute('role', 'dialog'); element.setAttribute('aria-modal', 'true'); element.setAttribute('aria-labelledby', 'match-summary-title');
    element.innerHTML = summaryMarkup(summaryModel(state));
    element.querySelector('[data-summary="close"]').onclick = () => { this.close(); onClose?.(); };
    element.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); this.close(); onClose?.(); } });
    this.host.append(element); this.element = element;
    element.querySelector('h2').focus({ preventScroll: true });
  }
  close() { this.element?.remove(); this.element = null; }
}
