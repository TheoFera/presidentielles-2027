// Browsers that refuse orientation locking retain a clear rotate-device screen.
export const portraitPhone = () => window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)').matches;

export function syncOrientation() {
  const blocked = portraitPhone();
  const menu = document.getElementById('start-menu');
  menu.inert = blocked;
  document.getElementById('game').inert = blocked || !menu.hidden;
  document.getElementById('landscape-gate').hidden = !blocked;
}

export async function enterLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.('landscape');
  } catch { /* Safari and some embedded browsers require physically rotating the phone. */ }
  syncOrientation();
}

export function installLandscape() {
  window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)').addEventListener('change', syncOrientation);
  document.getElementById('landscape-fullscreen').onclick = () => void enterLandscape();
  syncOrientation();
}
