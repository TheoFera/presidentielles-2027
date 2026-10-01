/** Plateaux peints complets : décors et plateformes appartiennent à la même illustration. */
export const DEBATE_ARENAS = {
  elysee: { asset: 'debate-elysee', title: 'Tribune de l’Élysée' },
  face_a_face: { asset: 'debate-face-a-face', title: 'Face-à-face' },
  remue_menage: { asset: 'debate-remue-menage', title: 'Remue-ménage' },
  ecologie: { asset: 'debate-ecologie', title: 'Éco-débat' },
};

export function arenaSupportHeight(state, x, height) {
  const support = state.platforms.filter(p => Math.abs(x - p.x) <= p.half_width && p.height <= height + 1e-6)
    .sort((a, b) => b.height - a.height)[0];
  return support?.height ?? null;
}

export function drawDebateArena(renderer, state) {
  const { ctx, width, height } = renderer;
  const asset = DEBATE_ARENAS[state.map_id].asset;
  const image = renderer.assets.get(asset);
  // L’image entière occupe le studio : pas de fenêtres, de voile noir ou de
  // plateformes géométriques ajoutées par-dessus les plateformes peintes.
  if (image) ctx.drawImage(image, 0, 0, width, height);
  else {
    ctx.fillStyle = '#254d83'; ctx.fillRect(0, 0, width, height);
    void renderer.assets.load(asset);
  }
}
