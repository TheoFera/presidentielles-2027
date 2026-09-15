import { campaignStyles, isCampaignStyleUnlocked, nearCampaignHQ, styleSettings } from '../simulation/campaign-styles.js';
import { paintStylePortrait } from './campaign-style-art.js';

export class CampaignStylesDisplay {
  constructor(config, profile, dispatch, resetInput) {
    Object.assign(this, { config, profile, dispatch, resetInput, key: null, state: null });
    this.dialog = document.createElement('dialog'); this.dialog.id = 'campaign-styles';
    this.dialog.setAttribute('aria-labelledby', 'campaign-styles-title');
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); this.cancel(); });
    this.dialog.addEventListener('keydown', e => e.stopPropagation());
    this.dialog.addEventListener('close', () => { if (this.state?.campaign_style_selection?.candidate_id === this.state?.local_candidate_id) this.dialog.showModal(); });
    this.hold = document.createElement('button'); this.hold.id = 'change-campaign-style'; this.hold.type = 'button'; this.hold.hidden = true;
    this.label = document.createElement('span'); this.label.textContent = 'CHANGER DE STYLE';
    const help = document.createElement('small'); help.textContent = `Maintenir E ou ici · ${styleSettings(config).hold_seconds.toLocaleString('fr-FR')} s`;
    this.progress = document.createElement('progress'); this.progress.max = 1; this.progress.value = 0; this.progress.setAttribute('aria-label', 'Changement de style');
    this.hold.append(this.label, help, this.progress);
    this.hold.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); this.hold.setPointerCapture(e.pointerId); this.setHeld(true); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.hold.addEventListener(type, () => this.setHeld(false));
    this.hold.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'e' && !e.repeat && !this.dialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); this.setHeld(true); } });
    window.addEventListener('keyup', e => { if (e.key.toLowerCase() === 'e') this.setHeld(false); });
    window.addEventListener('blur', () => this.setHeld(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.setHeld(false); });
    document.body.append(this.dialog); (document.getElementById('game') || document.body).append(this.hold);
  }
  setHeld(active) {
    if (!this.state || active && this.hold.hidden) return;
    this.dispatch({ type: 'HoldCampaignStyle', candidateId: this.state.local_candidate_id, active });
  }
  cancel() {
    if (!this.state?.campaign_style_selection?.mandatory) this.dispatch({ type: 'CancelCampaignStyle', candidateId: this.state.local_candidate_id });
  }
  update(state) {
    this.state = state;
    const c = state.candidates.find(c => c.id === state.local_candidate_id), selection = state.campaign_style_selection?.candidate_id === state.local_candidate_id ? state.campaign_style_selection : null;
    this.hold.hidden = !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase) || !!state.campaign_style_selection || !c.current_campaign_style || c.is_ko || c.eliminated || c.campaign_arena_id || c.crisis_meeting_id || !nearCampaignHQ(state, this.config, c);
    this.progress.value = c.style_hold ? Math.min(1, (state.tick - c.style_hold.start_tick) / (styleSettings(this.config).hold_seconds * this.config.balance.simulation_architecture.fixed_tick_hz)) : 0;
    if (!selection) { if (this.dialog.open) { this.dialog.close(); this.resetInput(); document.getElementById('world')?.focus(); } this.key = null; return; }
    const key = JSON.stringify([selection, c.current_campaign_style, this.profile.unlocked_campaign_styles]);
    if (key === this.key) return;
    this.key = key; this.resetInput();
    const title = document.createElement('h1'); title.id = 'campaign-styles-title'; title.textContent = 'CHOISISSEZ VOTRE STYLE';
    const subtitle = document.createElement('p'); subtitle.textContent = selection.mandatory ? 'QG établi. Choisissez votre première façon de faire campagne.' : 'Un seul style actif. Changer remet la charge de l’ultime à zéro.';
    const grid = document.createElement('div'); grid.className = 'campaign-style-grid';
    for (const style of campaignStyles(this.config, c.faction_id)) {
      const unlocked = isCampaignStyleUnlocked(this.profile, c.faction_id, style.id), current = style.id === c.current_campaign_style;
      const card = document.createElement('button'); card.type = 'button'; card.className = 'campaign-style-card'; card.disabled = !unlocked; card.dataset.styleId = style.id;
      card.classList.toggle('current', current); card.style.setProperty('--style-accent', style.skin.accent);
      const status = document.createElement('span'); status.className = 'campaign-style-status'; status.textContent = current ? 'ACTUEL' : unlocked ? 'SÉLECTIONNABLE' : '🔒 VERROUILLÉ';
      const portrait = document.createElement('canvas'); portrait.width = 420; portrait.height = 500; portrait.setAttribute('role', 'img'); portrait.setAttribute('aria-label', `Portrait : ${style.name}`); paintStylePortrait(portrait, this.config, c.faction_id, style);
      const name = document.createElement('h2'); name.textContent = style.name;
      const biome = document.createElement('strong'); biome.className = 'campaign-style-biome'; biome.textContent = this.config.layout.biomes.find(b => b.id === style.primary_biome).display_name;
      const summary = document.createElement('p'); summary.textContent = style.summary;
      const ultimate = document.createElement('span'); ultimate.className = 'campaign-style-ultimate'; ultimate.textContent = `✦ ${style.ultimate.name}`;
      const mode = document.createElement('small'); mode.textContent = style.ultimate.kind === 'BARDELLA' ? 'Bouton Ultime : armer la relève au prochain KO' : 'Chargez en touchant · Activez avec Ultime';
      card.append(status, portrait, name, biome, summary, ultimate, mode);
      card.addEventListener('click', () => this.dispatch({ type: 'SelectCampaignStyle', candidateId: c.id, styleId: style.id })); grid.append(card);
    }
    this.dialog.replaceChildren(title, subtitle, grid);
    if (!selection.mandatory) { const close = document.createElement('button'); close.type = 'button'; close.className = 'campaign-style-cancel'; close.textContent = 'Annuler · Échap'; close.onclick = () => this.cancel(); this.dialog.append(close); }
    if (!this.dialog.open) this.dialog.showModal();
    grid.querySelector('button:not(:disabled)')?.focus();
  }
}
