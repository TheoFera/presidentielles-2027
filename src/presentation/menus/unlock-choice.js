// Fin de campagne solo : le joueur CHOISIT le candidat qu'il débloque parmi ceux qu'il a mis K.-O.
// - victoire : 1 au choix gratuitement, puis 1 de plus s'il regarde une pub récompensée ;
// - défaite (« seconde chance ») : 1 au choix, s'il regarde une pub récompensée.
// Les nombres viennent de unlockOffer() (src/simulation/unlock-catalog.js).
// C'est une étape du parcours des résultats : l'écran s'ouvre au clic sur « Voir le bilan », avant le bilan.
// En haut, un emplacement par déblocage possible (🎁 gratuit, 🎬 contre une pub) : la carte choisie y passe,
// puis reçoit le tampon « Débloqué » seulement quand l'enregistrement est confirmé.
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

/** Textes de l'écran : le titre dit l'étape, les emplacements montrent le reste (pas de doublon). */
function texts(offer, step, save, picked) {
  const n = offer.choices.length;
  const kicker = offer.won ? 'Victoire !' : 'Élection perdue';
  if (step === 'free') return { kicker, title: 'Choisis ton candidat', text: `Tu as mis K.-O. ${n} candidats. Choisis celui que tu débloques.` };
  if (step === 'ad') return { kicker, title: offer.won ? 'Un 2ᵉ candidat ?' : 'Seconde chance',
    text: 'Regarde une pub jusqu’au bout pour en débloquer un.' };
  // Récapitulatif : le tampon des emplacements dit « Débloqué », le titre donne les noms.
  if (save === 'failed') return { kicker, title: 'Pas enregistré', text: '' };
  return { kicker, title: picked.map(id => { const { name, style } = unlockLabel(id); return style ? `${name} ${style}` : name; }).join(' + '), text: '' };
}

function card(id) {
  const { name, style } = unlockLabel(id);
  return `<button type="button" class="unlock-card" role="radio" aria-checked="false" data-id="${escape(id)}">
    ${portraitFace(id)}<strong>${escape(name)}</strong>${style ? `<small>${escape(style)}</small>` : ''}</button>`;
}

/**
 * Prépare l'écran de choix, caché au départ. Renvoie { done, reveal } :
 * done : promesse { ids, saved } à la fermeture ; reveal() : affiche l'écran.
 * getAd() : renvoie (ou promet) une offre de pub récompensée { available, show() } (voir ads.js).
 * ad : première offre déjà obtenue (facultatif).
 * save(ids) : enregistre les candidats choisis ; promesse rejetée avec { message, retry } en cas d'échec.
 * onBack() : « ← Résultats », l'écran se cache sans rien perdre. sound() : son du tampon.
 */
export function openUnlockChoice({ offer, getAd, ad: firstAd = null, save = async () => {}, onBack = null, sound = null, parent = document.body }) {
  const picks = { free: [], rewarded: [] };
  // Pub récompensée : 'waiting' (la régie répond), 'ready' (show() disponible) ou 'none'.
  let ad = { state: 'none' }, asks = 0, failed = false, playing = false, selected = null, closed = false, finish;
  // Enregistrement : null (choix en cours), 'saving', 'saved' ou 'failed' (retry : un nouvel essai a un sens).
  let saveState = null, retry = false;
  const done = new Promise(resolve => { finish = resolve; });
  const slots = Array.from({ length: offer.free + offer.rewarded }, (_, i) => i < offer.free ? 'free' : 'ad');
  const root = document.createElement('div');
  root.className = 'unlock-choice';
  root.hidden = true;
  root.innerHTML = `<div class="unlock-choice-panel" role="dialog" aria-modal="true" aria-labelledby="unlock-choice-title" aria-describedby="unlock-choice-text">
      <p class="unlock-choice-kicker"></p><h2 id="unlock-choice-title"></h2>
      <div class="unlock-slots">${slots.map(kind => `<span class="unlock-slot" data-kind="${kind}"><i class="unlock-slot-icon" aria-hidden="true">${kind === 'free' ? '🎁' : '🎬'}</i></span>`).join('')}</div>
      <p class="unlock-choice-text" id="unlock-choice-text"></p>
      <div class="unlock-choice-cards" role="radiogroup" aria-labelledby="unlock-choice-title">${offer.choices.map(card).join('')}</div>
      <p class="unlock-choice-status" role="status"></p>
      <div class="unlock-choice-actions"><button type="button" class="unlock-choice-secondary"></button><button type="button" class="unlock-choice-primary"></button></div>
      <button type="button" class="unlock-choice-later">← Résultats</button>
    </div>`;
  const $ = selector => root.querySelector(selector);
  const cards = [...root.querySelectorAll('.unlock-card')], slotEls = [...root.querySelectorAll('.unlock-slot')];
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

  /** Emplacements du haut : vide (icône), visé par l'étape en cours, rempli par un portrait, puis tamponné. */
  function renderSlots(now) {
    const ids = all();
    slotEls.forEach((el, i) => {
      const id = ids[i] ?? null;
      if ((el.dataset.id ?? '') !== (id ?? '')) {
        if (id) {
          el.dataset.id = id;
          el.insertAdjacentHTML('beforeend', `<span class="unlock-slot-face">${portraitFace(id)}</span><b class="unlock-slot-stamp">Débloqué</b>`);
          hydrateMedallions(el);
        } else { delete el.dataset.id; el.querySelectorAll('.unlock-slot-face, .unlock-slot-stamp').forEach(x => x.remove()); }
      }
      const target = !id && saveState === null && (now === 'free' ? el.dataset.kind === 'free' : now === 'ad' && el.dataset.kind === 'ad') && i === ids.length;
      el.dataset.state = id ? saveState ?? 'filled' : target ? 'next' : 'empty';
    });
  }

  function render() {
    if (closed) return;
    let now = saveState ? 'done' : step();
    // Victoire, choix gratuit fait, pas de pub à l'ouverture : la régie a pu en charger une depuis (un seul nouvel essai).
    if (!saveState && now === 'done' && ad.state === 'none' && asks < 2 && picks.free.length >= offer.free
      && picks.rewarded.length < offer.rewarded && all().length < offer.choices.length) { askAd(); now = step(); }
    if (now === 'done' && !saveState) {
      if (!all().length) { close(); return; }
      void record();
      return;
    }
    const remaining = offer.choices.filter(id => !all().includes(id));
    if (!remaining.includes(selected)) selected = remaining.length === 1 ? remaining[0] : null;
    const t = texts(offer, now, saveState, all());
    $('.unlock-choice-kicker').textContent = t.kicker;
    $('h2').textContent = t.title;
    $('.unlock-choice-text').textContent = t.text;
    $('.unlock-choice-text').hidden = !t.text;
    renderSlots(now);
    // Les cartes choisies quittent la grille : elles sont dans leur emplacement, en haut.
    $('.unlock-choice-cards').hidden = !!saveState;
    for (const el of cards) {
      el.hidden = all().includes(el.dataset.id);
      el.disabled = playing;
      el.setAttribute('aria-checked', String(el.dataset.id === selected));
    }
    $('.unlock-choice-later').hidden = !onBack || !!saveState;
    const name = selected ? unlockLabel(selected).name : '';
    secondary.hidden = now !== 'ad';
    secondary.disabled = playing;
    secondary.textContent = ad.state === 'none' ? 'Continuer' : 'Non merci';
    if (saveState) {
      primary.textContent = saveState === 'saving' ? '…' : saveState === 'failed' && retry ? 'Réessayer' : 'Voir le bilan ➜';
      primary.disabled = saveState === 'saving';
    } else if (now === 'free') {
      primary.textContent = selected ? `🎁 Débloquer ${name}` : 'Choisis un candidat';
      primary.disabled = !selected;
    } else if (ad.state !== 'ready') {
      primary.textContent = ad.state === 'waiting' ? 'Recherche d’une pub…' : 'Pas de pub pour le moment';
      primary.disabled = true;
    } else {
      primary.textContent = playing ? 'Pub en cours…' : selected ? `🎬 Débloquer ${name}` : 'Choisis un candidat';
      primary.disabled = playing || !selected;
    }
  }

  /** Enregistre les choix ; le tampon et les confettis ne viennent qu'une fois l'enregistrement confirmé. */
  async function record() {
    saveState = 'saving'; status.textContent = ''; render();
    try {
      await save(all());
      saveState = 'saved';
      sound?.();
      if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) confetti();
    } catch (error) {
      saveState = 'failed';
      retry = !!error?.retry;
      status.textContent = error?.message || 'Déblocage non enregistré.';
    }
    render();
    if (!closed) primary.focus({ preventScroll: true });
  }

  function confetti() {
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('i');
      piece.className = 'ko-reveal-confetti';
      piece.setAttribute('aria-hidden', 'true');
      piece.style.left = `${Math.round(Math.random() * 100)}%`;
      piece.style.background = ['#ffd75e', '#63edff', '#ff5d8f', '#a9ff7a'][i % 4];
      piece.style.setProperty('--drift', `${Math.round(Math.random() * 120 - 60)}px`);
      piece.style.animationDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
      root.append(piece);
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    root.remove();
    finish({ ids: all(), saved: saveState === 'saved' });
  }

  cards.forEach(el => { el.onclick = () => { if (!el.disabled) { selected = el.dataset.id; status.textContent = ''; render(); } }; });
  primary.onclick = async () => {
    if (primary.disabled) return;
    if (saveState) { if (saveState === 'failed' && retry) void record(); else close(); return; }
    if (!selected) return;
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
  // « Non merci » : on garde ce qui est déjà choisi (enregistré puis tamponné), ou on ferme s'il n'y a rien.
  secondary.onclick = () => {
    if (playing) return;
    offer = { ...offer, rewarded: picks.rewarded.length };
    render();
  };

  let timer = 0;
  function focus() { if (!closed) (cards.find(el => !el.disabled && !el.hidden) || primary).focus({ preventScroll: true }); }
  function reveal() {
    if (closed) return;
    root.hidden = false;
    clearTimeout(timer); timer = setTimeout(focus, 0);
  }
  // « ← Résultats » : l'écran se cache sans rien perdre ; « Voir le bilan » le rouvre.
  $('.unlock-choice-later').onclick = () => {
    if (closed || playing || saveState) return;
    root.hidden = true;
    onBack?.();
  };
  if (offer.rewarded) askAd(firstAd);
  render();
  if (!closed) { parent.append(root); hydrateMedallions(root); }
  return { done, reveal };
}
