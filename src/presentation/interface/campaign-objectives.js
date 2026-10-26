// Objectifs des deux premières parties : un post-it à gauche de l'écran, trois objectifs à la fois (quatre séries).
// Les progrès sont lus dans l'état de la partie (quelques fois par seconde, jamais à chaque image) ;
// le post-it ne change que lorsqu'un objectif avance.

const GROUPS = [
  [
    { id: 'billets', label: 'Ramasser 3 billets', goal: 3 },
    { id: 'habitants', label: 'Convaincre 3 habitants', goal: 3 },
    { id: 'permanence', label: 'Prendre une permanence', goal: 1 },
  ],
  [
    { id: 'militant', label: 'Recruter votre premier militant', goal: 1 },
    { id: 'ko', label: 'Mettre K.-O. un candidat adverse', goal: 1 },
    { id: 'batiment', label: 'Prendre un autre bâtiment', goal: 1 },
  ],
  [
    { id: 'sympathisants', label: 'Mettre K.-O. 3 sympathisants adverses', goal: 3 },
    { id: 'fermeture', label: 'Fermer un bâtiment adverse', goal: 1 },
    { id: 'permanence2', label: 'Prendre une autre permanence', goal: 1 },
  ],
  [
    { id: 'meeting', label: 'Tenir un meeting', goal: 1 },
    { id: 'garage', label: 'Débloquer un garage', goal: 1 },
    { id: 'sondage', label: 'Acheter un sondage', goal: 1 },
  ],
];
const CHECK_SECONDS = 0.25, NEXT_GROUP_SECONDS = 1.3;
const SUPPORTERS = new Set(['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE']);
const feat = (state, faction, key) => state.campaign_feats?.[faction]?.[key] || 0;


/** Progrès de chaque objectif, d'après l'état de la partie (sauf les billets, comptés à part). */
export function objectiveProgress(state, faction, pickups = 0) {
  const local = state.candidates.find(c => c.id === state.local_candidate_id);
  let supporters = 0, militant = 0;
  for (const npc of state.npcs) {
    if (npc.faction_id !== faction || !SUPPORTERS.has(npc.role)) continue;
    supporters++;
    if (npc.role === 'MILITANT') militant = 1;
  }
  let owned = 0, permanences = 0, garage = 0, meeting = 0;
  for (const b of state.buildings) {
    if (b.meeting_faction_id === faction) meeting = 1;
    if (b.owner_id !== faction || b.state !== 'ACTIVE') continue;
    owned++;
    if (b.type === 'permanence') permanences++;
    if (b.type === 'garage_velo' || b.type === 'garage_scooter') garage = 1;
  }
  return {
    billets: pickups, habitants: supporters, permanence: local?.headquarters_site_id ? 1 : 0, militant,
    ko: (state.knockouts || []).some(k => k?.by_faction === faction) ? 1 : 0, batiment: owned >= 2 ? 1 : 0,
    sympathisants: feat(state, faction, 'supporters_ko'), fermeture: feat(state, faction, 'buildings_closed'),
    permanence2: permanences >= 2 ? 1 : 0, meeting, garage, sondage: state.polls?.[faction]?.lastPollSnapshot ? 1 : 0,
  };
}

export class CampaignObjectives {
  constructor(game, { farewellSeconds = 7 } = {}) {
    this.farewellSeconds = farewellSeconds;
    this.root = document.createElement('aside'); this.root.id = 'campaign-objectives'; this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Objectifs');
    this.root.innerHTML = '<div class="postit"><h2>Objectifs</h2><ul></ul><p class="postit-note"></p></div>';
    this.note = this.root.querySelector('.postit'); this.title = this.root.querySelector('h2');
    this.list = this.root.querySelector('ul'); this.message = this.root.querySelector('.postit-note');
    game.append(this.root);
    this.reset(false);
  }

  /** Nouvelle partie : `active` pour les deux premières parties du joueur. */
  reset(active) {
    this.active = active; this.group = 0; this.best = {}; this.pickups = 0; this.lastEvent = null;
    this.wait = 0; this.nextIn = null; this.doneAt = null; this.key = '';
    this.root.classList.remove('postit-done');
    this.title.textContent = 'Objectifs'; this.message.textContent = '';
    this.render();
    // Affiché par update(), une fois le menu et l'écran de chargement refermés.
    this.root.hidden = true;
  }

  update(state, elapsed, hidden = false) {
    if (!this.active) return;
    const show = !hidden && state.phase === 'CAMPAIGN';
    if (this.root.hidden === show) this.root.hidden = !show;
    const local = state.candidates.find(c => c.id === state.local_candidate_id), faction = local?.faction_id;
    this.countPickups(state.events, state.local_candidate_id);
    if (this.doneAt !== null) {
      // « Bravo ! » reste affiché un moment, puis le post-it s'en va pour de bon.
      if ((this.doneAt += elapsed) >= this.farewellSeconds) { this.active = false; this.root.hidden = true; }
      return;
    }
    if (this.nextIn !== null) {
      if ((this.nextIn -= elapsed) <= 0) { this.nextIn = null; this.nextGroup(); }
      return;
    }
    if ((this.wait -= elapsed) > 0 || !faction) return;
    this.wait = CHECK_SECONDS;
    const progress = objectiveProgress(state, faction, this.pickups);
    // Un objectif atteint le reste : perdre un soutien ne décoche rien.
    for (const [id, value] of Object.entries(progress)) this.best[id] = Math.max(this.best[id] || 0, value);
    this.render();
    if (GROUPS[this.group].every(o => this.best[o.id] >= o.goal)) this.nextIn = NEXT_GROUP_SECONDS;
  }

  /** Billets ramassés par le joueur : lus dans les nouveaux événements de la partie. */
  countPickups(events = [], localId) {
    let newest = this.lastEvent ?? -1;
    for (const event of events) {
      const number = Number(String(event.id).slice(6));
      if (!(number > (this.lastEvent ?? -1))) continue;
      newest = Math.max(newest, number);
      if (event.type === 'MoneyPickedUp' && event.candidate_id === localId) this.pickups++;
    }
    this.lastEvent = newest;
  }

  nextGroup() {
    if (this.group + 1 < GROUPS.length) {
      this.group++; this.render(true);
      if (GROUPS[this.group].every(o => this.best[o.id] >= o.goal)) this.nextIn = NEXT_GROUP_SECONDS;
      return;
    }
    this.doneAt = 0; this.key = 'done';
    this.root.classList.add('postit-done');
    this.title.textContent = 'Bravo !';
    this.list.replaceChildren();
    this.message.textContent = 'Maintenant, gagnez l’élection en convainquant le plus d’habitants possible.';
    this.stick();
  }

  /** Le post-it ne change que si un objectif a avancé. */
  render(fresh = false) {
    const items = GROUPS[this.group].map(o => {
      const value = Math.min(o.goal, this.best[o.id] || 0);
      return { ...o, value, done: value >= o.goal };
    });
    const key = `${this.group}:${items.map(o => o.value).join(',')}`;
    if (key === this.key) return;
    // Valeurs affichées juste avant, pour faire claquer la coche d'un objectif qui vient d'être atteint.
    const [group, values] = this.key.split(':'), before = Number(group) === this.group && values ? values.split(',').map(Number) : null;
    this.key = key;
    this.list.replaceChildren(...items.map((o, index) => {
      const li = document.createElement('li');
      li.className = o.done ? (before && before[index] < o.goal ? 'done just-done' : 'done') : '';
      li.textContent = o.label;
      if (o.goal > 1 && !o.done) { const count = document.createElement('small'); count.textContent = ` ${o.value}/${o.goal}`; li.append(count); }
      return li;
    }));
    if (fresh) this.stick();
  }

  /** Nouveau post-it collé : petite arrivée en biais (transformation seulement). */
  stick() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.note.animate([{ transform: 'translateY(-30%) rotate(-9deg)', opacity: 0 }, { transform: 'rotate(-1.5deg)', opacity: 1 }],
      { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  }
}
