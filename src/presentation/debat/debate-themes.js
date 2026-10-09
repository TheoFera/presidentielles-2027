// Thèmes des rounds du mode Débat : une couleur et un pictogramme dessiné en traits (grille 24 × 24).
const THEME_LOOK = {
  economie: { color: '#f5b83d', paths: ['M18 7a7 7 0 1 0 0 10', 'M4 10h9', 'M4 14h9'] },
  immigration: { color: '#22c6e0', paths: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M3 12h18', 'M12 3c3 3 3 15 0 18c-3-3-3-15 0-18'] },
  ecologie: { color: '#5fd35a', paths: ['M5 19C5 10 11 5 20 5c0 9-5 14-14 14', 'M5 19l8-8'] },
  securite: { color: '#ff5468', paths: ['M12 3l8 3v6c0 5-4 8-8 9c-4-1-8-4-8-9V6z', 'M9 12l2 2l4-4'] },
  sante: { color: '#2fe0a8', paths: ['M2 12h5l2-5l3 10l2-5h8'] },
  retraites: { color: '#ff8a3d', paths: ['M6 3h12', 'M6 21h12', 'M7 3c0 5 10 7 10 9s-10 4-10 9M17 3c0 5-10 7-10 9s10 4 10 9'] },
  education: { color: '#b79cff', paths: ['M3 5c3-1 6-1 9 1c3-2 6-2 9-1v13c-3-1-6-1-9 1c-3-2-6-2-9-1z', 'M12 6v13'] },
  europe: { color: '#5b7cff', width: 2.8, paths: ['M12 4h0M16 5.07h0M18.93 8h0M20 12h0M18.93 16h0M16 18.93h0M12 20h0M8 18.93h0M5.07 16h0M4 12h0M5.07 8h0M8 5.07h0'] },
  energie: { color: '#e9f04a', paths: ['M13 2L4 14h7l-1 8l9-12h-7z'] },
  logement: { color: '#ff7bb0', paths: ['M3 11l9-7l9 7', 'M5 10v10h14V10', 'M10 20v-6h4v6'] },
  agriculture: { color: '#e0b266', paths: ['M12 21V5', 'M12 8c-3 0-4-2-4-4c3 0 4 2 4 4c0-2 1-4 4-4c0 2-1 4-4 4M12 13c-3 0-4-2-4-4c3 0 4 2 4 4c0-2 1-4 4-4c0 2-1 4-4 4M12 18c-3 0-4-2-4-4c3 0 4 2 4 4c0-2 1-4 4-4c0 2-1 4-4 4'] },
  democratie: { color: '#a9bce0', paths: ['M4 11h16v10H4z', 'M9 11V4h6v7', 'M8 16h8'] },
  // Round bonus : la question du public départage une égalité.
  public: { color: '#ffe36e', paths: ['M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3M8 21h8'] },
};

export const themeColor = id => THEME_LOOK[id]?.color || '#ffe36e';

/** Nom affiché du thème (un seul mot, sauf le round bonus). */
export function themeName(config, id) {
  const mode = config.balance.debate_mode;
  return (mode.themes.find(t => t.id === id) || (mode.bonus_theme.id === id ? mode.bonus_theme : null))?.name || '';
}

/** Pictogramme SVG en ligne ; il prend la couleur du texte (currentColor). */
export function themeIcon(id) {
  const look = THEME_LOOK[id] || THEME_LOOK.public;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${look.width || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${look.paths.map(d => `<path d="${d}"/>`).join('')}</svg>`;
}
