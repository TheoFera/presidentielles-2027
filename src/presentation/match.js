import { GamePhase } from '../simulation/phases.js';
import { drawCombatEffects } from './combat-effects.js';

export function drawArena(renderer, state, previous, alpha) {
  const { ctx, canvas, width, height } = renderer;
  const original = renderer.metrics;
  renderer.metrics = { ...original, groundY: height * 0.79, pixelsPerUnit: width / renderer.config.balance.first_round_arena.width_units };
  const m = renderer.metrics;
  renderer.screenX = x => x * m.pixelsPerUnit;
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#242d3c'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#364354'; ctx.fillRect(width * 0.08, height * 0.28, width * 0.84, height * 0.47);
  ctx.strokeStyle = '#778496'; ctx.lineWidth = 2; ctx.strokeRect(width * 0.08, height * 0.28, width * 0.84, height * 0.47);
  ctx.textAlign = 'center'; ctx.fillStyle = '#e3e8e6'; ctx.font = '600 22px system-ui';
  ctx.fillText('PREMIER TOUR · PLATEAU MÉDIATIQUE', width / 2, height * 0.37);
  ctx.font = '14px system-ui'; ctx.fillStyle = '#bdc9cf'; ctx.fillText('Le premier candidat à 0 est éliminé.', width / 2, height * 0.43);
  ctx.fillStyle = '#b9c5c7'; ctx.fillRect(width * 0.025, m.groundY, width * 0.95, 9);
  ctx.fillStyle = '#657280'; ctx.fillRect(width * 0.025, m.groundY + 9, width * 0.95, 48);
  for (const edge of [state.arena_bounds.min, state.arena_bounds.max]) {
    ctx.fillStyle = '#d3d8c8'; ctx.fillRect(renderer.screenX(edge) - 3, m.groundY - 20, 6, 20);
  }
  for (const entity of [...state.temporary_units, ...state.candidates]) {
    const old = [...(previous?.candidates || []), ...(previous?.temporary_units || [])].find(c => c.id === entity.id) || entity;
    const x = renderer.screenX(old.x + (entity.x - old.x) * alpha);
    renderer.drawPerson(entity, x, state);
    if (entity.role === 'CANDIDAT') {
      ctx.fillStyle = '#eef0df'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(renderer.p.factions[entity.faction_id].name, x, m.groundY - m.characterHeight - 20);
    }
  }
  drawCombatEffects(renderer, state, false);
  ctx.fillStyle = '#bdc9cf'; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('← → / Q D : marcher     Espace / J : léger → léger → fort     Yeux étoilés : pouvoir prêt', width / 2, height * 0.94);
  renderer.metrics = original;
}

export class MatchDisplay {
  constructor(config, callbacks) {
    this.config = config; this.callbacks = callbacks;
    this.hud = document.getElementById('arena-hud'); this.results = document.getElementById('results');
    this.banner = document.getElementById('phase-banner'); this.spectator = document.getElementById('spectator');
    this.cards = new Map(); this.phase = null; this.extensions = 0; this.followId = null;
    const select = document.getElementById('spectator-follow');
    select.addEventListener('change', () => { this.followId = select.value; callbacks.follow(); });
    document.getElementById('replay').addEventListener('click', callbacks.replay);
    document.getElementById('return').addEventListener('click', callbacks.return);
  }
  viewedCandidate(state) {
    const local = state.candidates.find(c => c.id === state.local_candidate_id);
    return local.eliminated ? state.candidates.find(c => c.id === this.followId && !c.eliminated) || state.candidates.find(c => !c.eliminated) : local;
  }
  reset() { this.phase = null; this.extensions = 0; this.followId = null; this.resultSignature = null; }
  update(state) {
    const names = this.config.prototype.presentation.factions;
    const arena = state.phase === GamePhase.FIRST_ROUND_ARENA; const sprint = state.phase === GamePhase.SECOND_ROUND_SPRINT;
    const finished = state.phase === GamePhase.RESULTS;
    this.hud.hidden = !arena; this.results.hidden = !finished;
    const eliminated = state.candidates.find(c => c.id === state.local_candidate_id).eliminated;
    this.spectator.hidden = !sprint || !eliminated;
    if (this.phase !== state.phase || this.extensions !== state.extensions) {
      this.banner.textContent = arena ? 'J0 · Premier tour' : sprint ? state.extensions > this.extensions ? `+${this.config.balance.second_round.extension_seconds} s · Égalité` : `Élimination de ${names[state.eliminated_faction].name} · Influence ×${this.config.balance.time.second_round_influence_multiplier}` : '';
      if (this.phase !== state.phase) {
        const fade = document.getElementById('phase-fade');
        fade.getAnimations().forEach(a => a.cancel());
        if (this.phase !== null) fade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: this.config.balance.first_round_arena.transition_seconds * 1000 });
      }
      this.phase = state.phase; this.extensions = state.extensions;
      if (arena) {
        this.hud.replaceChildren(); this.cards.clear();
        for (const c of state.arena.candidates) {
          const card = document.createElement('div'); card.className = 'arena-card'; card.style.setProperty('--camp-color', names[c.faction_id].color);
          const name = document.createElement('span'); const value = document.createElement('output'); const bar = document.createElement('div'); const fill = document.createElement('i');
          bar.className = 'arena-bar'; bar.append(fill); card.append(name, value, bar); this.hud.append(card);
          this.cards.set(c.id, { name, value, fill });
        }
      }
      if (sprint && eliminated) {
        const select = document.getElementById('spectator-follow'); select.replaceChildren();
        for (const c of state.candidates.filter(c => !c.eliminated)) select.add(new Option(names[c.faction_id].name, c.id));
        this.followId = select.value;
        document.getElementById('spectator-label').textContent = `Élimination de ${names[state.eliminated_faction].name} · Spectateur`;
      }
    }
    this.banner.hidden = !this.banner.textContent || state.match_tick - state.phase_started_match_tick > this.config.balance.simulation_architecture.fixed_tick_hz * 4;
    if (arena) for (const c of state.arena.candidates) {
      const card = this.cards.get(c.id);
      card.name.textContent = `${names[c.faction_id].symbol} · ${names[c.faction_id].name}${c.id === state.local_candidate_id ? ' · Vous' : ''}`;
      card.value.textContent = c.arena_hp > 0 && c.arena_hp < 0.1 ? '< 0,1 %' : `${c.arena_hp.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
      card.fill.style.width = `${c.arena_initial_hp ? c.arena_hp / c.arena_initial_hp * 100 : 0}%`;
      card.value.setAttribute('aria-label', `${names[c.faction_id].name} : ${card.value.textContent} de jauge restante`);
    }
    if (finished && this.resultSignature !== JSON.stringify(state.result)) {
      this.resultSignature = JSON.stringify(state.result);
      const r = state.result; const percent = f => `${r.scores[f].toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
      document.getElementById('winner').textContent = names[r.winner].name;
      document.getElementById('winning-score').textContent = percent(r.winner);
      document.getElementById('second-score').textContent = `Second : ${names[r.second].name} · ${percent(r.second)}`;
      document.getElementById('neutral-score').textContent = `Neutres : ${percent('neutral')}`;
      document.getElementById('third-name').textContent = `Troisième : ${names[state.eliminated_faction].name}`;
      document.getElementById('tie-detail').textContent = r.tie_break ? 'Égalité départagée selon la règle configurée : score à J0, puis graine.' : '';
      document.getElementById('replay').focus();
      console.info('Résumé DEBUG de la partie', JSON.stringify(state.telemetry));
    }
  }
}
