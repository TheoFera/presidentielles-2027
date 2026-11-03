/** `?perf` dans l'adresse : affiche les mesures de fluidité (perf-overlay.js, chargé seulement dans ce cas). */
export const perfWanted = (search = globalThis.location?.search || '') => new URLSearchParams(search).has('perf');
