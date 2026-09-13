import { CAMPAIGN_STYLES } from '../simulation/campaign-styles.js';
import { visualManifest } from './visual-manifest.js';

export const styleSpriteId = id => `character-style-${id.replaceAll('_', '-')}`;
export function specialCharacterAssetId(entity, state) {
  if (entity.role === 'HOLOGRAMME') return styleSpriteId('melenchon_universaliste');
  if (entity.role === 'ZEMMOUR') return 'character-ultimate-zemmour';
  if (entity.role === 'ENCAPUCHONNE') return 'character-ultimate-encapuchonne';
  if (entity.role !== 'CANDIDAT') return null;
  if (entity.bardella_form) return 'character-ultimate-bardella';
  if (entity.ultimate_effect?.expires_tick > state.tick) {
    if (entity.ultimate_effect.kind === 'EUROPE') return 'character-ultimate-philippe-super-europeiste';
    if (entity.ultimate_effect.kind === 'FIRE') return 'character-ultimate-melenchon-gilet-jaune';
  }
  return CAMPAIGN_STYLES[entity.faction_id]?.some(s => s.id === entity.current_campaign_style)
    ? styleSpriteId(entity.current_campaign_style) : null;
}

// The same generated PNG is used for the candidate and the card. No costume overlay.
export function paintStylePortrait(canvas, _config, _faction, style) {
  const ctx = canvas.getContext('2d'), image = new Image();
  const assetId = styleSpriteId(style.id);
  canvas.dataset && (canvas.dataset.spriteId = assetId);
  image.onload = () => {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .7);
    glow.addColorStop(0, style.skin.accent + '99'); glow.addColorStop(1, '#0b132600');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    const ch = Math.min(h * .97, w * .92 * image.naturalHeight / image.naturalWidth), cw = ch * image.naturalWidth / image.naturalHeight;
    ctx.drawImage(image, (w - cw) / 2, h - ch, cw, ch);
    canvas.dataset && (canvas.dataset.loaded = 'true');
  };
  image.onerror = () => { canvas.dataset && (canvas.dataset.loaded = 'error'); };
  image.src = visualManifest[assetId]?.file || '';
}
