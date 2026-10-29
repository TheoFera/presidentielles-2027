// Tutoriel : un post-it à gauche de l'écran, une série de trois ou quatre objectifs à la fois.
// Il revient à chaque partie tant que tous les objectifs ne sont pas atteints ; ceux déjà atteints
// (enregistrés dans le profil) ne sont pas à refaire. Au départ, chaque appui fait défiler les séries
// terminées jusqu'à la série en cours.
// Les progrès sont lus dans l'état de la partie (quelques fois par seconde, jamais à chaque image) ;
// le post-it ne change que lorsqu'un objectif avance.
import { siteVariant } from '../../simulation/building-rules.js';

// Bases, développement, combat, puis fin de campagne : chaque série prépare la suivante.
// La série de combat suit le bâtiment du camp : service d'ordre et raid (Mélenchon, Le Pen), ou cabinet (Philippe).
// `help` : l'explication affichée sous l'objectif quand le post-it est en grand (départ, pause).
const SERVICE_ORDER = ['melenchon', 'le_pen'];
const GROUPS = [
  [
    { id: 'billets', label: 'Ramasser 3 billets', goal: 3,
      help: 'Passez sur les liasses pour les ramasser. L’argent sert à prendre des bâtiments ou à faire des actions, comme imprimer des tracts.' },
    { id: 'habitants', label: 'Convaincre 3 habitants', goal: 3,
      help: 'Arrêtez-vous près d’un habitant neutre pour le convaincre : il deviendra votre sympathisant. Chaque sympathisant est une voix pour vous le jour du vote.' },
    { id: 'permanence', label: 'Créer votre permanence QG', goal: 1,
      help: 'Pour acquérir une permanence, réunissez l’argent demandé et 2 sympathisants proches, puis placez-vous devant. Votre première permanence vous permet de choisir votre style de campagne parmi ceux débloqués.' },
  ],
  [
    { id: 'militant', label: 'Recruter votre premier militant', goal: 1,
      help: 'Arrêtez-vous devant une permanence pour imprimer des tracts. Vos sympathisants viendront les chercher et deviendront militants. Un militant peut convaincre d’autres habitants neutres.' },
    { id: 'sympathisants', label: 'Mettre K.-O. 3 sympathisants adverses', goal: 3,
      help: 'Frappez les sympathisants d’un adversaire : mis K.-O., ils redeviennent neutres, prêts à être convaincus.' },
    { id: 'permanence2', label: 'Prendre une deuxième permanence', goal: 1,
      help: 'Prendre un bâtiment, comme une permanence, permet de contrôler sa zone : vos soutiens y résistent mieux et vos adversaires y convainquent plus lentement.' },
  ],
  [
    { id: 'ko', label: 'Mettre K.-O. un candidat adverse', goal: 1,
      help: 'Une fois mis K.-O., un candidat lâche une partie de son argent et ne réapparaît qu’après plusieurs secondes.' },
    { id: 'local', label: faction => faction === 'philippe' ? 'Prendre un cabinet administratif' : 'Acheter un local pour votre service d’ordre', goal: 1,
      help: faction => faction === 'philippe'
        ? 'Le cabinet administratif permet de lancer des procédures qui font fermer les bâtiments de vos adversaires.'
        : 'Le local du service d’ordre recrute des gros bras parmi vos sympathisants pour défendre votre territoire. Il permet aussi de lancer des raids.' },
    { id: 'raid', label: 'Lancer un raid', goal: 1, factions: SERVICE_ORDER,
      help: 'Depuis votre local du service d’ordre, lancez un « RAID » : trois de vos sympathisants iront provoquer la fermeture des bâtiments adverses.' },
    { id: 'fermeture', label: 'Fermer un bâtiment adverse', goal: 1,
      help: faction => faction === 'philippe'
        ? 'Fermer un bâtiment adverse grâce au cabinet permet ensuite de le reconquérir.'
        : 'Fermer un bâtiment adverse grâce à un raid permet ensuite de le reconquérir.' },
  ],
  [
    { id: 'sondage', label: 'Acheter un sondage', goal: 1,
      help: 'Payez un institut de sondage pour connaître les intentions de vote : la carte vous montre aussi qui tient chaque zone.' },
    { id: 'meeting', label: 'Tenir un meeting', goal: 1,
      help: 'Lancez un meeting depuis une estrade et restez-y jusqu’au bout : les habitants neutres de la zone vous rejoignent, les sympathisants adverses redeviennent neutres.' },
    { id: 'garage', label: 'Acheter un garage', goal: 1,
      help: 'Une fois le garage acheté, revenez-y autant que vous voulez pour récupérer un véhicule bien plus rapide qu’à pied.' },
  ],
];

/** Objectifs de chaque série pour ce camp (libellés et explications adaptés, raid seulement avec un service d'ordre). */
export const objectiveGroups = faction => GROUPS.map(group => group.filter(o => !o.factions || o.factions.includes(faction))
  .map(o => ({ ...o, label: typeof o.label === 'function' ? o.label(faction) : o.label, help: typeof o.help === 'function' ? o.help(faction) : o.help })));

/**
 * Où en est le tutoriel de ce camp, d'après les objectifs déjà atteints (`done`, identifiants) :
 * `target` est la première série pas terminée ; `complete` quand il n'en reste aucune.
 */
export function tutorialProgress(faction, done = []) {
  const reached = new Set(done), groups = objectiveGroups(faction);
  const target = groups.findIndex(group => !group.every(o => reached.has(o.id)));
  return { groups, target: target < 0 ? groups.length : target, complete: target < 0 };
}
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
  let factionSite = 0, permanences = 0, garage = 0, meeting = 0;
  for (const b of state.buildings) {
    if (b.meeting_faction_id === faction) meeting = 1;
    if (b.owner_id !== faction || b.state !== 'ACTIVE') continue;
    // Le local demandé dépend du camp ; la carte fixe la fonction de chaque local (service d'ordre ou cabinet).
    if (b.type === 'faction' && siteVariant(b) === (faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre')) factionSite = 1;
    if (b.type === 'permanence') permanences++;
    if (b.type === 'garage_velo' || b.type === 'garage_scooter') garage = 1;
  }
  return {
    billets: pickups, habitants: supporters, permanence: local?.headquarters_site_id ? 1 : 0, militant,
    ko: (state.knockouts || []).some(k => k?.by_faction === faction) ? 1 : 0, local: factionSite,
    sympathisants: feat(state, faction, 'supporters_ko'), fermeture: feat(state, faction, 'buildings_closed'),
    permanence2: permanences >= 2 ? 1 : 0, meeting, garage, raid: feat(state, faction, 'raids'), sondage: state.polls?.[faction]?.lastPollSnapshot ? 1 : 0,
  };
}

export class CampaignObjectives {
  /** `onDone(ids)` : un objectif vient d'être atteint ; `ids` liste tous ceux atteints, à garder dans le profil. */
  constructor(game, { farewellSeconds = 7, onDone = () => {} } = {}) {
    this.farewellSeconds = farewellSeconds; this.onDone = onDone;
    this.root = document.createElement('aside'); this.root.id = 'campaign-objectives'; this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Objectifs');
    this.root.innerHTML = '<div class="postit"><h2>Objectifs <small></small></h2><ul></ul><p class="postit-note"></p></div>';
    this.note = this.root.querySelector('.postit'); this.title = this.root.querySelector('h2');
    this.counter = this.title.querySelector('small');
    this.list = this.root.querySelector('ul'); this.message = this.root.querySelector('.postit-note');
    game.append(this.root);
    this.reset(false);
  }

  /**
   * Nouvelle partie : `active` tant que le tutoriel n'est pas terminé. `done` : objectifs déjà atteints
   * dans les parties précédentes. Le post-it part de la première série : `advance()` le fait défiler.
   */
  reset(active, { done = [], faction = null } = {}) {
    this.active = active; this.done = new Set(done); this.best = {}; this.pickups = 0; this.lastEvent = null;
    this.browsing = active; this.group = 0; this.faction = undefined; this.setFaction(faction);
    this.wait = 0; this.nextIn = null; this.doneAt = null; this.key = '';
    this.root.classList.remove('postit-done');
    this.title.firstChild.textContent = 'Objectifs '; this.message.textContent = '';
    this.render();
    // Affiché par update(), une fois le menu et l'écran de chargement refermés.
    this.root.hidden = true;
  }

  /** Camp du joueur : objectifs adaptés, ceux déjà atteints cochés, série en cours. */
  setFaction(faction) {
    if (this.faction === faction) return;
    this.faction = faction;
    const { groups, target } = tutorialProgress(faction, [...this.done]);
    this.groups = groups; this.target = Math.min(target, groups.length - 1); this.key = '';
    for (const o of groups.flat()) if (this.done.has(o.id)) this.best[o.id] = Math.max(this.best[o.id] || 0, o.goal);
    if (!this.browsing) this.group = this.target;
  }

  /** Départ : un appui passe à la série suivante, jusqu'à la série en cours. Rend `false` quand il n'y a plus rien à faire défiler. */
  advance() {
    if (!this.active || !this.browsing || this.group >= this.target) return false;
    this.group++; this.render(true);
    return true;
  }
  /** Fin du défilement : le post-it se range sur la série en cours. */
  stopBrowsing() {
    if (!this.browsing) return;
    this.browsing = false;
    if (this.group !== this.target) { this.group = this.target; this.render(true); }
  }

  /** Post-it en grand (départ, pause) : explication sous chaque objectif. */
  setExplain(on) { this.root.classList.toggle('postit-explain', on); }
  get visible() { return !this.root.hidden; }

  update(state, elapsed, hidden = false) {
    if (!this.active) return;
    // La campagne a commencé : plus de défilement, la série en cours s'affiche.
    if (this.browsing && !state.campaign_intro && state.phase === 'CAMPAIGN') this.stopBrowsing();
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
    this.setFaction(faction);
    const progress = objectiveProgress(state, faction, this.pickups);
    // Un objectif atteint le reste : perdre un soutien ne décoche rien.
    for (const [id, value] of Object.entries(progress)) this.best[id] = Math.max(this.best[id] || 0, value);
    this.remember();
    this.render();
    if (!this.browsing && this.groups[this.group].every(o => this.best[o.id] >= o.goal)) this.nextIn = NEXT_GROUP_SECONDS;
  }

  /** Objectifs atteints (même ceux d'une série suivante) : gardés pour les parties suivantes. */
  remember() {
    let changed = false;
    for (const o of this.groups.flat()) if (this.best[o.id] >= o.goal && !this.done.has(o.id)) { this.done.add(o.id); changed = true; }
    if (changed) this.onDone([...this.done]);
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
    if (this.group + 1 < this.groups.length) {
      this.group++; this.target = this.group; this.render(true);
      if (this.groups[this.group].every(o => this.best[o.id] >= o.goal)) this.nextIn = NEXT_GROUP_SECONDS;
      return;
    }
    this.doneAt = 0; this.key = 'done';
    this.root.classList.add('postit-done');
    this.title.firstChild.textContent = 'Bravo ! '; this.counter.textContent = '';
    this.list.replaceChildren();
    this.message.textContent = 'Maintenant, gagnez l’élection en convainquant le plus d’habitants possible.';
    this.stick();
  }

  /** Le post-it ne change que si un objectif a avancé. */
  render(fresh = false) {
    const items = this.groups[this.group].map(o => {
      const value = Math.min(o.goal, this.best[o.id] || 0);
      return { ...o, value, done: value >= o.goal };
    });
    const key = `${this.group}:${items.map(o => o.value).join(',')}`;
    if (key === this.key) return;
    // Valeurs affichées juste avant, pour faire claquer la coche d'un objectif qui vient d'être atteint.
    const [group, values] = this.key.split(':'), before = Number(group) === this.group && values ? values.split(',').map(Number) : null;
    this.key = key;
    this.counter.textContent = `${this.group + 1}/${this.groups.length}`;
    this.list.replaceChildren(...items.map((o, index) => {
      const li = document.createElement('li');
      li.className = o.done ? (before && before[index] < o.goal ? 'done just-done' : 'done') : '';
      const label = document.createElement('span'); label.className = 'postit-label'; label.textContent = o.label;
      li.append(label);
      if (o.goal > 1 && !o.done) { const count = document.createElement('small'); count.textContent = ` ${o.value}/${o.goal}`; label.append(count); }
      const help = document.createElement('span'); help.className = 'postit-help'; help.textContent = o.help;
      li.append(help);
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
