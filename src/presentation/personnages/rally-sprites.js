const ASSET = 'rally-placards';
const SYMBOL_ASSET = 'rally-biome-placards';
const SLOGANS = {
  paris_19e: 'SOLIDARITÉ', banlieue: 'JUSTICE', periurbain_usine: 'TRAVAIL',
  campagne: 'COLÈRE', quartiers_riches: 'Simplification',
};

// Rectangle mesuré dans pancartes-v1.png ; le manche est dessiné séparément
// pour rejoindre la main sans agrandir le carton au-dessus du personnage.
const TEXT_BOARD = { x: 26, y: 95, width: 486, height: 385, handleX: 239 };
// Les cinq pancartes et le bouquet de pancartes-biomes-v2.png.
const SYMBOL_BOARDS = {
  paris_19e: { x: 30, y: 121, width: 480, height: 360 },
  banlieue: { x: 535, y: 118, width: 473, height: 366 },
  periurbain_usine: { x: 1033, y: 120, width: 483, height: 365 },
  campagne: { x: 32, y: 542, width: 478, height: 368 },
  retraites: { x: 542, y: 499, width: 450, height: 480 },
  quartiers_riches: { x: 1029, y: 549, width: 488, height: 360 },
};
const labels = new WeakMap();

/** Porteurs stables : un slogan par cortège, plus ÉCOLOGIE à Paris si trois pancartes tiennent. */
export function rallyPlacard(entity, state) {
  if (!entity.rally_event_id || !Number.isInteger(entity.rally_index)) return null;
  const event = state.campaign_events.find(e => e.id === entity.rally_event_id && e.status === 'ACTIVE');
  if (!event?.march) return null;
  const biome = SYMBOL_BOARDS[event.target_biome_id] ? event.target_biome_id : 'paris_19e';
  // Marche en hommage : chaque participant tient des fleurs, sans pancarte ni inscription.
  if (biome === 'retraites') return { variant: 2, slogan: null, biome };
  const count = event.march.participant_ids.length;
  // Même un petit cortège garde un dessin à côté du texte dès qu'il compte deux personnes.
  const smallSymbol = count > 1 && count <= 5 && entity.rally_index === count - 1;
  if (entity.rally_index % 5 && !smallSymbol) return null;
  const sloganIndex = Math.floor((count - 1) / 10) * 5;
  const ecologyIndex = biome === 'paris_19e' && count > 10 ? sloganIndex - 5 : -1;
  const slogan = entity.rally_index === sloganIndex ? SLOGANS[biome]
    : entity.rally_index === ecologyIndex ? 'ÉCOLOGIE' : null;
  return { variant: slogan ? 0 : 1, slogan, biome };
}

// Le slogan est peint une fois sur le carton, puis réutilisé comme un sprite.
function labeledBoard(source, text) {
  let cache = labels.get(source);
  if (!cache) { cache = new Map(); labels.set(source, cache); }
  if (cache.has(text)) return cache.get(text);
  const frame = TEXT_BOARD, canvas = document.createElement('canvas');
  canvas.width = frame.width; canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  ctx.fillStyle = '#343b38'; ctx.font = '900 55px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 244, 207, 410);
  cache.set(text, canvas);
  return canvas;
}

/** Manches derrière le corps, bouquets devant le torse. Texte jamais inversé. */
export function drawRallyAccessories(renderer, entity, x, feetY, height, width, state, motion, foreground = false) {
  const placard = rallyPlacard(entity, state);
  if (!placard || entity.is_ko || entity.combat?.stun_ticks > 0) return;
  const bouquet = placard.variant === 2;
  if (bouquet !== foreground) return;
  const { ctx } = renderer;
  const time = state.tick / renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const side = entity.facing < 0 ? -1 : 1;
  if (bouquet) {
    const flowers = renderer.assets.get(SYMBOL_ASSET);
    if (!flowers) { void renderer.assets.load(SYMBOL_ASSET); return; }
    const frame = SYMBOL_BOARDS.retraites;
    const h = height * 0.46, w = h * frame.width / frame.height;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.translate(x + side * width * 0.28, feetY - height * 0.28);
    ctx.rotate(side * motion.stride * 0.025);
    ctx.drawImage(flowers, frame.x, frame.y, frame.width, frame.height, -w / 2, -h * 0.82, w, h);
    ctx.restore(); return;
  }
  const source = renderer.assets.get(ASSET);
  if (!source) { void renderer.assets.load(ASSET); return; }
  const symbols = placard.slogan ? null : renderer.assets.get(SYMBOL_ASSET);
  if (!placard.slogan && !symbols) { void renderer.assets.load(SYMBOL_ASSET); return; }
  const frame = placard.slogan ? TEXT_BOARD : SYMBOL_BOARDS[placard.biome];
  // Un carton un peu plus large rend le mot Simplification lisible sur téléphone.
  const scale = height * (placard.biome === 'quartiers_riches' ? 0.82 : 0.60) / frame.width;
  const handleHeight = height * 0.70;
  const handleScale = height * 0.60 / TEXT_BOARD.width;
  const handleCenter = placard.slogan ? TEXT_BOARD.handleX + 29 - TEXT_BOARD.x : frame.width / 2;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.translate(x + side * width * 0.36, feetY - height * 0.28);
  ctx.rotate(side * motion.stride * 0.025 + Math.sin(time * 2.2 + entity.rally_index) * 0.025);
  ctx.drawImage(source, TEXT_BOARD.handleX, 480, 58, 464, -29 * handleScale, -handleHeight, 58 * handleScale, handleHeight + height * 0.04);
  const top = -handleHeight - frame.height * scale;
  if (placard.slogan) {
    ctx.drawImage(labeledBoard(source, placard.slogan), -handleCenter * scale, top, frame.width * scale, frame.height * scale);
  } else {
    ctx.drawImage(symbols, frame.x, frame.y, frame.width, frame.height,
      -handleCenter * scale, top, frame.width * scale, frame.height * scale);
  }
  ctx.restore();
}
