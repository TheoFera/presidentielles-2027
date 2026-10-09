// Browsers that refuse orientation locking retain a clear rotate-device screen.
export const portraitPhone = () => window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)').matches;

export function syncOrientation() {
  const blocked = portraitPhone();
  const menu = document.getElementById('start-menu');
  // L'avertissement de l'allumage garde le menu inaccessible tant qu'il n'est pas validé.
  const notice = document.getElementById('legal-notice');
  menu.inert = blocked || !!notice && !notice.hidden && !notice.classList.contains('closing');
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

// Menu button: leaves full screen when already in it (touch menus enter it on their
// own). Returns false when the browser offers no full screen, as on iPhone.
export async function toggleFullscreen() {
  const root = document.documentElement;
  try {
    if (document.fullscreenElement ?? document.webkitFullscreenElement) {
      await (document.exitFullscreen ?? document.webkitExitFullscreen).call(document);
      return true;
    }
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
    if (!request) return false;
    // Some embedded browsers never settle the request: stop waiting after a moment.
    await Promise.race([request.call(root), new Promise(resolve => setTimeout(resolve, 1500))]);
    if (!(document.fullscreenElement ?? document.webkitFullscreenElement)) return false;
    await screen.orientation?.lock?.('landscape')?.catch(() => {});
    return true;
  } catch { return false; } finally { syncOrientation(); }
}

export function installLandscape() {
  window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)').addEventListener('change', syncOrientation);
  document.getElementById('landscape-fullscreen').onclick = () => void enterLandscape();
  syncOrientation();
}
