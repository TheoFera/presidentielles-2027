import { visualManifest } from './visual-manifest.js';

export const CANDIDATES = [
  { id: 'melenchon', name: 'Jean-Luc Mélenchon', description: 'Rassemblez vos sympathisants et implantez votre campagne.' },
  { id: 'le_pen', name: 'Marine Le Pen', description: 'Mobilisez votre camp et partez à la conquête des territoires.' },
  { id: 'philippe', name: 'Édouard Philippe', description: 'Développez votre implantation et financez votre progression.' },
];

export class StartMenu {
  constructor({ prepare, play, multiplayer }) {
    Object.assign(this, { prepare, play, multiplayer, selected: 'melenchon', generation: 0 });
    this.element = document.getElementById('start-menu');
    this.game = document.getElementById('game');
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.screen !== 'home') { event.preventDefault(); this.home(); }
      event.stopPropagation();
    });
    this.home();
  }
  get active() { return !this.element.hidden; }
  page(screen, title, content, back = () => this.home()) {
    this.screen = screen; this.generation++;
    this.element.hidden = false; this.game.inert = true;
    this.element.innerHTML = `<div class="menu-shell"><header class="menu-header"><span class="menu-brand">Présidentielles 2027</span>${screen !== 'home' ? '<button id="menu-back">← Retour</button>' : '<span class="menu-brand">La campagne est à vous</span>'}</header>${title ? `<h1 tabindex="-1">${title}</h1>` : ''}${content}</div>`;
    this.element.querySelector('#menu-back')?.addEventListener('click', back);
    (this.element.querySelector('h1') || this.element.querySelector('button'))?.focus({ preventScroll: true });
    this.element.scrollTop = 0;
  }
  home() {
    this.leave?.();
    this.page('home', '', `<div class="menu-home"><span class="eyebrow">UN PAYS. TROIS CANDIDATS. UNE PRÉSIDENCE.</span><h1 tabindex="-1">Chaque voix compte.<span>À vous de convaincre.</span></h1><p class="menu-intro">Parcourez la France, rassemblez vos soutiens et faites la différence jusqu’au dernier jour de campagne.</p><div class="mode-grid"><button class="mode-card" id="solo"><strong>Solo →</strong><small>Choisissez votre candidat et affrontez deux adversaires contrôlés par l’ordinateur.</small></button><button class="mode-card" id="multiplayer"><strong>Multijoueur →</strong><small>Faites campagne avec d’autres joueurs et disputez-vous la présidence.</small></button></div><p class="menu-note">Clavier ou commandes tactiles · Le guide vous attend avant le départ.</p></div>`);
    this.element.querySelector('#solo').onclick = () => this.candidates();
    this.element.querySelector('#multiplayer').onclick = () => this.multiplayer(this);
  }
  candidates() {
    this.page('candidates', 'Choisissez votre candidat.', `<span class="eyebrow">SOLO · VOTRE CAMPAGNE COMMENCE ICI</span><p class="menu-intro">Vous incarnez un candidat. L’ordinateur joue les deux autres.</p><div class="candidate-grid">${CANDIDATES.map(c => `<button class="candidate-card" data-candidate="${c.id}" aria-pressed="${c.id === this.selected}"><span class="candidate-badge">${c.id === this.selected ? 'Votre candidat' : 'Sélectionner'}</span><img src="${visualManifest[`character-${c.id}`].file}" alt="" draggable="false"><strong>${c.name}</strong><small>${c.description}</small></button>`).join('')}</div><footer class="menu-footer"><span class="menu-note">Vos styles de campagne se choisissent ensuite au QG.</span><button id="prepare-game" class="menu-primary">Continuer →</button></footer>`);
    this.element.querySelectorAll('[data-candidate]').forEach(button => {
      button.onclick = () => {
        this.selected = button.dataset.candidate;
        this.element.querySelectorAll('[data-candidate]').forEach(card => {
          const selected = card.dataset.candidate === this.selected;
          card.setAttribute('aria-pressed', String(selected)); card.querySelector('.candidate-badge').textContent = selected ? 'Votre candidat' : 'Sélectionner';
        });
      };
    });
    this.element.querySelector('#prepare-game').onclick = () => this.loading();
  }
  async loading({ multiplayer = false, ready = null } = {}) {
    const candidate = CANDIDATES.find(c => c.id === this.selected);
    this.page('loading', 'Préparez votre campagne.', `<span class="eyebrow">SOLO · ${candidate.name}</span><p class="menu-intro">Gagnez les élections présidentielles en parcourant la France pour récolter le plus de voix. Mais attention aux autres candidats !</p><div class="tutorial-grid"><article class="tutorial-card"><h2>Sur le terrain</h2><p><strong>Convaincre les passants</strong><br>Arrêtez-vous près d’un passant neutre et restez devant lui : vous le convaincrez automatiquement.</p><p><strong>Interagir avec les bâtiments</strong><br>Restez devant leur repère pour interagir. Les achats se déclenchent après un court délai si vous avez assez d’argent et de soutiens.</p><p><strong>Gardez un œil sur vos rivaux.</strong><br>Eux aussi recrutent, se développent et peuvent vous attaquer.</p></article><article class="tutorial-card"><h2>Les contrôles</h2><dl><dt>← → / Q D / A D</dt><dd>Marcher</dd><dt>Espace / J</dt><dd>Frapper</dd><dt>Double appui directionnel</dt><dd>Esquiver</dd><dt>R</dt><dd>Activer l’ultime chargé</dd><dt>E maintenu devant le QG</dt><dd>Changer de style</dd><dt>Échap / P / H</dt><dd>Pause et aide</dd></dl><p class="menu-note">Sur téléphone : maintenez les flèches et touchez « Frapper » ou « Ultime ». Relâchez les flèches pour convaincre. Le mode paysage est conseillé.</p></article></div><progress class="menu-loading" aria-label="Chargement de la campagne"></progress><p id="loading-status" class="menu-status" role="status">Chargement du monde et des personnages…</p><footer class="menu-footer"><span class="menu-note">Prenez le temps de lire. La partie attend votre départ.</span><button id="start-campaign" class="menu-primary" disabled>Chargement…</button></footer>`, () => this.candidates());
    if (multiplayer) {
      this.element.querySelector('.eyebrow').textContent = `MULTIJOUEUR · ${candidate.name}`;
      this.element.querySelector('#menu-back').onclick = () => this.home();
      this.element.querySelector('.menu-footer .menu-note').textContent = 'Départ quand tout le monde est prêt. Les styles débloqués de l’hôte sont partagés pour cette partie.';
    }
    const generation = this.generation;
    try {
      await Promise.all([this.prepare(`candidate:${this.selected}`), new Promise(resolve => setTimeout(resolve, 1800))]);
      if (generation !== this.generation) return;
      const progress = this.element.querySelector('progress'); progress.max = 1; progress.value = 1;
      this.element.querySelector('#loading-status').textContent = 'Tout est prêt. À vous de faire campagne !';
      const button = this.element.querySelector('#start-campaign'); button.disabled = false; button.textContent = 'Commencer la campagne →';
      button.onclick = async () => {
        if (!ready) { this.close(); this.play(); return; }
        button.disabled = true; button.textContent = 'En attente des autres joueurs…';
        try { await ready(); } catch (error) {
          if (generation !== this.generation) return;
          button.disabled = false; button.textContent = 'Réessayer'; this.element.querySelector('#loading-status').textContent = error.message;
        }
      };
      if (multiplayer) button.textContent = 'Je suis prêt →';
    } catch {
      if (generation === this.generation) this.element.querySelector('#loading-status').textContent = 'La préparation a échoué. Revenez à la sélection pour réessayer.';
    }
  }
  close() { this.generation++; this.element.hidden = true; this.game.inert = false; }
}
