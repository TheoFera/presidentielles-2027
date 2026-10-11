// Fin de campagne solo : le joueur CHOISIT le candidat qu'il débloque parmi ceux qu'il a mis K.-O.
// - victoire : 1 au choix gratuitement, puis 1 de plus s'il regarde une pub récompensée ;
// - défaite (« seconde chance ») : 1 au choix, s'il regarde une pub récompensée.
// Les nombres viennent de unlockOffer() (src/simulation/unlock-catalog.js). Les résultats restent visibles
// aussi longtemps que le joueur le veut : l'écran s'ouvre par le bouton ajouté aux résultats (« 🎁 Choisir
// mon candidat »), ou au clic sur « Rejouer » / « Retour au menu », pour ne pas oublier le déblocage.
import { hydrateMedallions, portraitFace } from './player-card.js';
import { unlockLabel } from '../interface/knockout-reveal.js';

const escape = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/**
 * Étape suivante de l'écran : 'free' (choix gratuit), 'ad' (choix contre une pub) ou 'done'.
 * adAvailable : true, false, ou null tant que la régie n'a pas répondu.
 */
export function choiceStep(offer, { free = 0, rewarded = 0 } = {}, adAvailable = null) {
  const left = offer.choices.length - free - rewarded;
  if (left <= 0) return 'done';
  if (free < offer.free) return 'free';
  if (rewarded < offer.rewarded && adAvailable !== false) return 'ad';
  return 'done';
}

/** Textes de l'écran, selon l'étape et le résultat de l'élection. */
function texts(offer, step, picked) {
  const n = offer.choices.length;
  if (step === 'free') return { kicker: 'Victoire !', title: 'Choisis ton candidat',
    text: `Tu as mis K.-O. ${n} candidats pendant la campagne. Choisis celui que tu débloques.` };
  if (offer.won) return { kicker: `${unlockLabel(picked[0]).name} débloqué !`, title: 'Un 2ᵉ candidat ?',
    text: 'Regarde une courte pub jusqu’au bout pour débloquer aussi un des autres candidats.' };
  return { kicker: 'Élection perdue', title: 'Seconde chance',
    text: n > 1 ? `Tu as quand même mis K.-O. ${n} candidats. Regarde une courte pub jusqu’au bout pour en débloquer un.`
      : 'Tu as quand même mis ce candidat K.-O. Regarde une courte pub jusqu’au bout pour le débloquer.' };
}

function card(id) {
  const { name, style } = unlockLabel(id);
  return `<button type="button" class="unlock-card" role="radio" aria-checked="false" data-id="${escape(id)}">
    ${portraitFace(id)}<strong>${escape(name)}</strong>${style ? `<small>${escape(style)}</small>` : ''}
    <span class="unlock-card-badge" hidden>Débloqué ✓</span></button>`;
}

/**
 * Prépare l'écran de choix, caché au départ. Renvoie { done, reveal } :
 * done : promesse des identifiants choisis (dans l'ordre) ; reveal() : affiche l'écran.
 * getAd() : renvoie (ou promet) une offre de pub récompensée { available, show() } (voir ads.js).
 * ad : première offre déjà obtenue (facultatif). launcher : conteneur où poser le bouton d'ouverture
 * (barre des résultats) ; sans lui, l'écran s'ouvre tout de suite.
 */
export function openUnlockChoice({ offer, getAd, ad: firstAd = null, launcher = null, parent = document.body }) {
  const picks = { free: [], rewarded: [] };
  // Pub récompensée : 'waiting' (la régie répond), 'ready' (show() disponible) ou 'none'.
  let ad = { state: 'none' }, asks = 0, failed = false, playing = false, selected = null, closed = false, finish;
  const done = new Promise(resolve => { finish = resolve; });
  const root = document.createElement('div');
  root.className = 'unlock-choice';
  root.hidden = !!launcher;
  root.innerHTML = `<div class="unlock-choice-panel" role="dialog" aria-modal="true" aria-labelledby="unlock-choice-title" aria-describedby="unlock-choice-text">
      <p class="unlock-choice-kicker"></p><h2 id="unlock-choice-title"></h2><p class="unlock-choice-text" id="unlock-choice-text"></p>
      <div class="unlock-choice-cards" role="radiogroup" aria-labelledby="unlock-choice-title">${offer.choices.map(card).join('')}</div>
      <p class="unlock-choice-status" role="status"></p>
      <div class="unlock-choice-actions"><button type="button" class="unlock-choice-primary"></button><button type="button" class="unlock-choice-secondary"></button></div>
      <button type="button" class="unlock-choice-later">Revoir les résultats</button>
    </div>`;
  const $ = selector => root.querySelector(selector);
  const cards = [...root.querySelectorAll('.unlock-card')];
  const primary = $('.unlock-choice-primary'), secondary = $('.unlock-choice-secondary'), status = $('.unlock-choice-status');
  // Bouton des résultats qui ouvre l'écran : il reste tant que le choix n'est pas terminé.
  const opener = launcher ? Object.assign(document.createElement('button'), { type: 'button', className: 'unlock-choice-launcher' }) : null;
  const all = () => [...picks.free, ...picks.rewarded];
  // Une pub ratée garde l'étape « pub » ouverte (message, nouvel essai) au lieu de fermer l'écran.
  const step = () => choiceStep(offer, { free: picks.free.length, rewarded: picks.rewarded.length },
    ad.state === 'waiting' ? null : ad.state === 'ready' || failed);

  function askAd(first = null) {
    asks++;
    const asked = ad = { state: 'waiting' };
    Promise.resolve(first ?? getAd?.()).catch(() => null).then(result => {
      if (ad !== asked) return;
      ad = result?.available ? { state: 'ready', show: result.show } : { state: 'none' };
      render();
    });
  }

  function render() {
    if (closed) return;
    let now = step();
    // Victoire, choix gratuit fait, pas de pub à l'ouverture : la régie a pu en charger une depuis (un seul nouvel essai).
    if (now === 'done' && ad.state === 'none' && asks < 2 && picks.free.length >= offer.free
      && picks.rewarded.length < offer.rewarded && all().length < offer.choices.length) { askAd(); now = step(); }
    if (now === 'done') { close(); return; }
    const remaining = offer.choices.filter(id => !all().includes(id));
    if (!remaining.includes(selected)) selected = remaining.length === 1 ? remaining[0] : null;
    const t = texts(offer, now, all());
    $('.unlock-choice-kicker').textContent = t.kicker;
    $('h2').textContent = t.title;
    $('.unlock-choice-text').textContent = now === 'free' && offer.rewarded && ad.state === 'ready'
      ? `${t.text} Bonus : une courte pub te permettra d’en débloquer un 2ᵉ.` : t.text;
    for (const el of cards) {
      const picked = all().includes(el.dataset.id);
      el.dataset.state = picked ? 'picked' : 'choice';
      el.disabled = picked || playing;
      el.setAttribute('aria-checked', String(el.dataset.id === selected));
      el.querySelector('.unlock-card-badge').hidden = !picked;
    }
    if (opener) opener.textContent = now === 'free' ? '🎁 Choisir mon candidat' : offer.won ? '🎬 Un 2ᵉ candidat ?' : '🎬 Seconde chance';
    const name = selected ? unlockLabel(selected).name : '';
    secondary.hidden = now !== 'ad';
    secondary.disabled = playing;
    secondary.textContent = ad.state === 'none' ? 'Fermer' : 'Non merci';
    if (now === 'free') {
      primary.textContent = selected ? `Débloquer ${name}` : 'Choisis un candidat';
      primary.disabled = !selected;
    } else if (ad.state !== 'ready') {
      primary.textContent = ad.state === 'waiting' ? 'Recherche d’une pub…' : 'Pas de pub disponible pour le moment';
      primary.disabled = true;
    } else {
      primary.textContent = playing ? 'Pub en cours…' : selected ? `🎬 Regarder une pub et débloquer ${name}` : 'Choisis un candidat';
      primary.disabled = playing || !selected;
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    root.remove();
    opener?.remove();
    finish(all());
  }

  cards.forEach(el => { el.onclick = () => { if (!el.disabled) { selected = el.dataset.id; status.textContent = ''; render(); } }; });
  primary.onclick = async () => {
    if (!selected || primary.disabled) return;
    if (step() === 'free') { picks.free.push(selected); selected = null; render(); return; }
    playing = true; status.textContent = ''; render();
    // show() part dans ce clic : le site exige un geste du joueur pour lancer la pub.
    const earned = await ad.show().catch(() => false);
    playing = false;
    if (earned) { picks.rewarded.push(selected); selected = null; failed = false; }
    else { failed = true; status.textContent = 'Pub fermée avant la fin ou indisponible : pas de déblocage. Tu peux réessayer.'; }
    // Une pub ne sert qu'une fois : on en redemande une si un autre choix reste possible.
    if (picks.rewarded.length < offer.rewarded && all().length < offer.choices.length) askAd();
    render();
  };
  secondary.onclick = () => { if (!playing) close(); };

  let timer = 0;
  function focus() { if (!closed) (cards.find(el => !el.disabled) || primary).focus({ preventScroll: true }); }
  function reveal() {
    if (closed) return;
    root.hidden = false;
    clearTimeout(timer); timer = setTimeout(focus, 0);
  }
  // « Revoir les résultats » : l'écran se cache sans rien perdre ; le bouton des résultats le rouvre.
  function hide() {
    if (closed || playing || !opener?.isConnected) return;
    root.hidden = true;
    opener.focus({ preventScroll: true });
  }
  $('.unlock-choice-later').hidden = !opener;
  $('.unlock-choice-later').onclick = hide;
  if (offer.rewarded) askAd(firstAd);
  render();
  if (!closed) {
    parent.append(root);
    hydrateMedallions(root);
    if (opener) { opener.onclick = reveal; launcher.prepend(opener); } else reveal();
  }
  return { done, reveal };
}
