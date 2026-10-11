// Fin de campagne solo : le joueur CHOISIT le candidat qu'il débloque parmi ceux qu'il a mis K.-O.
// - victoire : 1 au choix gratuitement, puis 1 de plus s'il regarde une pub récompensée ;
// - défaite (« seconde chance ») : 1 au choix, s'il regarde une pub récompensée.
// Les nombres viennent de unlockOffer() (src/simulation/unlock-catalog.js). L'écran attend la fin
// de l'annonce des résultats pour apparaître ; « Rejouer » ou « Retour au menu » le montrent tout de suite.
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
 * Ouvre l'écran de choix. Renvoie { done, reveal } :
 * done : promesse des identifiants choisis (dans l'ordre) ; reveal() : affiche l'écran sans attendre.
 * getAd() : renvoie (ou promet) une offre de pub récompensée { available, show() } (voir ads.js).
 * ad : première offre déjà obtenue (facultatif). delayMs : attente avant l'apparition.
 */
export function openUnlockChoice({ offer, getAd, ad: firstAd = null, delayMs = 0, parent = document.body }) {
  const picks = { free: [], rewarded: [] };
  // Pub récompensée : 'waiting' (la régie répond), 'ready' (show() disponible) ou 'none'.
  let ad = { state: 'none' }, asks = 0, failed = false, playing = false, selected = null, closed = false, finish;
  const done = new Promise(resolve => { finish = resolve; });
  const root = document.createElement('div');
  root.className = 'unlock-choice';
  root.style.setProperty('--unlock-delay', `${Math.max(0, delayMs)}ms`);
  root.innerHTML = `<div class="unlock-choice-panel" role="dialog" aria-modal="true" aria-labelledby="unlock-choice-title" aria-describedby="unlock-choice-text">
      <p class="unlock-choice-kicker"></p><h2 id="unlock-choice-title"></h2><p class="unlock-choice-text" id="unlock-choice-text"></p>
      <div class="unlock-choice-cards" role="radiogroup" aria-labelledby="unlock-choice-title">${offer.choices.map(card).join('')}</div>
      <p class="unlock-choice-status" role="status"></p>
      <div class="unlock-choice-actions"><button type="button" class="unlock-choice-primary"></button><button type="button" class="unlock-choice-secondary"></button></div>
    </div>`;
  const $ = selector => root.querySelector(selector);
  const cards = [...root.querySelectorAll('.unlock-card')];
  const primary = $('.unlock-choice-primary'), secondary = $('.unlock-choice-secondary'), status = $('.unlock-choice-status');
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
  if (offer.rewarded) askAd(firstAd);
  render();
  if (!closed) {
    parent.append(root);
    hydrateMedallions(root);
    timer = setTimeout(focus, Math.max(0, delayMs));
  }
  function focus() { if (!closed) (cards.find(el => !el.disabled) || primary).focus({ preventScroll: true }); }
  return {
    done,
    reveal() { if (closed) return; root.classList.add('is-now'); clearTimeout(timer); timer = setTimeout(focus, 0); },
  };
}
