// Publicités interstitielles : une pub plein écran passe APRÈS un clic de fin de partie,
// jamais pendant le jeu ni en multijoueur. Le jeu décide du moment ; la régie affiche la pub :
// - appli Android : AdMob, par le pont natif window.PTJNativeAds (android/…/AdsManager.java) ;
// - site web : Google AdSense, API « H5 Games Ads » (adBreak) ;
// - test sans compte Google : ajouter ?pub=simulation à l'adresse du jeu.
// Si la pub n'est pas prête, le jeu continue aussitôt : le joueur n'attend jamais.
import { ADSENSE_CLIENT, ADSENSE_TEST, AD_RULES } from '../../network/ads-config.js';
import { APP_BUILD } from '../../app-build.js';

export const ADS_STATS_KEY = 'presidentielles2027:pubs:v1';
const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const APP_HOST = 'appassets.androidplatform.net';
/** Pub annoncée mais jamais refermée (régie bloquée) : le jeu reprend quand même. */
const AD_MAX_MS = 90_000;
/** Délai pour que la régie web commence la pub ; au-delà, on continue sans pub. */
const AD_START_MS = 4_000;
/** Statuts qui prouvent qu'une pub a réellement été montrée. */
const SHOWN = new Set(['viewed', 'dismissed']);

/**
 * Raison de NE PAS montrer de pub, ou null si une pub peut passer.
 * `stats` compte déjà la partie qui vient de se terminer.
 * placement : 'campaign' (fin de campagne) ou 'debate' (fin de débat).
 */
export function adBlocker(stats, placement, now, rules = AD_RULES) {
  if (stats.games <= rules.freeGames) return 'parties offertes aux nouveaux joueurs';
  const seconds = (now - (stats.lastAdAt || 0)) / 1000;
  if (seconds < rules.minGapSeconds) return 'pub trop récente';
  if (placement === 'debate') {
    if (stats.debatesSinceAd < rules.debateEvery) return 'pas assez de débats depuis la dernière pub';
    if (seconds < rules.debateGapSeconds) return 'pub trop récente pour un débat';
  }
  return null;
}

/** Ajoute la partie terminée aux compteurs. */
export function countFinishedGame(stats, placement) {
  return { ...stats, games: stats.games + 1, debatesSinceAd: stats.debatesSinceAd + (placement === 'debate' ? 1 : 0) };
}

/** Régie utilisée sur cet appareil, ou null (aucune pub). */
export function adProvider({ location = globalThis.location, native = globalThis.PTJNativeAds, appBuild = APP_BUILD, client = ADSENSE_CLIENT } = {}) {
  if (native && typeof native.show === 'function') return 'android';
  try { if (new URLSearchParams(location?.search || '').get('pub') === 'simulation') return 'simulation'; } catch { /* Adresse illisible : pas de simulation. */ }
  // Le site AdSense n'est jamais chargé dans l'appli (les règles Google l'interdisent dans une WebView).
  if (client && !appBuild && location?.protocol === 'https:' && location.hostname !== APP_HOST) return 'adsense';
  return null;
}

export class InterstitialAds {
  constructor({ audio = null, storage = globalThis.localStorage, now = () => Date.now(), provider = adProvider(), native = globalThis.PTJNativeAds } = {}) {
    this.audio = audio; this.storage = storage; this.now = now; this.provider = provider; this.native = native;
    this.busy = false; this.requests = 0; this.waiting = new Map(); this.webReady = false;
    // En simulation, une pub à chaque fin de partie (campagne ou débat) : on voit chaque placement sans attendre.
    this.rules = provider === 'simulation' ? { freeGames: 0, minGapSeconds: 0, debateEvery: 1, debateGapSeconds: 0 } : AD_RULES;
    if (provider === 'android') {
      globalThis.PTJNativeAdsResult = (id, status) => { this.waiting.get(id)?.(status); this.waiting.delete(id); };
    }
    if (provider === 'adsense') this.loadAdSense();
  }

  stats() {
    try {
      const saved = JSON.parse(this.storage?.getItem(ADS_STATS_KEY) || '{}');
      return { games: Number(saved.games) || 0, debatesSinceAd: Number(saved.debatesSinceAd) || 0, lastAdAt: Number(saved.lastAdAt) || 0 };
    } catch { return { games: 0, debatesSinceAd: 0, lastAdAt: 0 }; }
  }
  save(stats) {
    try { this.storage?.setItem(ADS_STATS_KEY, JSON.stringify(stats)); } catch { /* Stockage indisponible : compteurs pour cette session seulement. */ }
  }

  /**
   * À appeler au clic de fin de partie (Rejouer, Menu, Revanche…) : une pub passe peut-être,
   * puis `next` s'exécute. Un second clic pendant la pub est ignoré.
   */
  async afterGame(placement, next) {
    if (this.busy) return;
    const stats = countFinishedGame(this.stats(), placement);
    this.save(stats);
    const reason = this.provider ? adBlocker(stats, placement, this.now(), this.rules) : 'aucune régie configurée';
    if (reason) { console.info(`[pub] ${placement} : pas de pub (${reason}).`); next(); return; }
    this.busy = true;
    this.audio?.hold?.(true);
    let status = 'error';
    try { status = await this.show(placement); } catch { status = 'error'; }
    finally { this.audio?.hold?.(false); this.busy = false; }
    console.info(`[pub] ${placement} : ${status}.`);
    if (SHOWN.has(status)) this.save({ ...this.stats(), lastAdAt: this.now(), debatesSinceAd: 0 });
    next();
  }

  show(placement) {
    if (this.provider === 'android') return this.showNative();
    if (this.provider === 'adsense') return this.showAdSense(placement);
    if (this.provider === 'simulation') return showSimulatedAd();
    return Promise.resolve('notReady');
  }

  showNative() {
    return new Promise(resolve => {
      const id = `pub-${++this.requests}`;
      let accepted = false;
      const timer = setTimeout(() => { this.waiting.delete(id); resolve('timeout'); }, AD_MAX_MS);
      this.waiting.set(id, status => { clearTimeout(timer); resolve(status); });
      try { accepted = !!this.native.show(id); } catch { accepted = false; }
      // Pas de pub chargée (hors ligne, consentement refusé…) : on continue sans attendre.
      if (!accepted) { clearTimeout(timer); this.waiting.delete(id); resolve('notReady'); }
    });
  }

  loadAdSense() {
    const doc = globalThis.document;
    if (!doc || doc.querySelector(`script[src^="${ADSENSE_SCRIPT}"]`)) return;
    globalThis.adsbygoogle = globalThis.adsbygoogle || [];
    const script = doc.createElement('script');
    script.async = true; script.crossOrigin = 'anonymous';
    script.src = `${ADSENSE_SCRIPT}?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
    script.dataset.adClient = ADSENSE_CLIENT;
    script.dataset.adFrequencyHint = `${AD_RULES.minGapSeconds}s`;
    if (ADSENSE_TEST) script.dataset.adbreakTest = 'on';
    doc.head.append(script);
    // adConfig : précharge la pub suivante pour qu'elle s'affiche sans attente.
    globalThis.adsbygoogle.push({ preloadAdBreaks: 'on', sound: 'on', onReady: () => { this.webReady = true; } });
  }

  showAdSense(placement) {
    // Script bloqué (bloqueur de pubs, hors ligne) : la régie ne répondra jamais, on n'attend pas.
    if (!this.webReady) return Promise.resolve('notReady');
    return new Promise(resolve => {
      let done = false;
      const finish = status => { if (!done) { done = true; clearTimeout(timer); resolve(status); } };
      let timer = setTimeout(() => finish('timeout'), AD_START_MS);
      globalThis.adsbygoogle.push({
        type: 'next', name: placement === 'debate' ? 'fin-debat' : 'fin-campagne',
        beforeAd: () => { clearTimeout(timer); timer = setTimeout(() => finish('timeout'), AD_MAX_MS); },
        adBreakDone: info => finish(info?.breakStatus || 'other'),
      });
    });
  }

  /** Appli Android en Europe : le joueur doit pouvoir modifier ses choix de consentement. */
  privacyRequired() {
    try { return this.provider === 'android' && !!this.native.privacyOptionsRequired?.(); } catch { return false; }
  }
  openPrivacy() {
    try { this.native.showPrivacyOptions?.(); } catch { /* Pont indisponible. */ }
  }
}

/** Fausse pub de 3 secondes, pour vérifier les placements sans compte Google. */
function showSimulatedAd() {
  const doc = globalThis.document;
  if (!doc) return Promise.resolve('notReady');
  return new Promise(resolve => {
    const overlay = doc.createElement('div');
    overlay.id = 'ad-simulation'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Publicité (simulation)');
    overlay.innerHTML = '<p class="ad-simulation-label">Publicité · simulation</p><p class="ad-simulation-text">Ici s’afficherait une pub plein écran Google.</p><button disabled>Fermer dans 3</button>';
    const button = overlay.querySelector('button');
    doc.body.append(overlay);
    let left = 3;
    const tick = setInterval(() => {
      left--;
      if (left > 0) { button.textContent = `Fermer dans ${left}`; return; }
      clearInterval(tick); button.disabled = false; button.textContent = 'Fermer ✕'; button.focus();
    }, 1000);
    button.onclick = () => { overlay.remove(); resolve('viewed'); };
  });
}
