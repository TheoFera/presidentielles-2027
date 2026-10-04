// Écrans du compte PartageTonJeu, dans les menus du jeu (mêmes cartes et boutons).
// Le solo n'est jamais derrière ces écrans : seuls le multijoueur et le classement
// demandent un compte.
import { NEWSLETTER_TEXT, NEWSLETTER_NOTE } from '../network/account-config.js';
import { availableProviders, accountsConfigured, nativeProviders, nativeReauthorize, AuthCancelled } from '../network/auth-providers.js';
import { cleanNickname, DEFAULT_NICKNAME } from './player-profile.js';
import { hydrateMedallions, medallionContent, titleContent } from './player-card.js';
import { cleanAvatar, ratingTier } from '../simulation/player-titles.js';
import { ALL_CANDIDATE_IDS } from '../simulation/unlock-catalog.js';

const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PITCH = 'Crée ton compte PartageTonJeu pour jouer en ligne, retrouver tes statistiques et grimper dans le classement.';
const LADDERS = [['campaign', '★ Campagne'], ['debate', '⚔ Débat télé']];
const PROVIDER_NAMES = { google: 'Google', apple: 'Apple' };
const format = n => Number(n).toLocaleString('fr-FR');

/** Petit message en bas de l'écran (résultat enregistré, déblocage…), aussi pendant la partie. */
export function showAccountToast(text, tone = 'info') {
  document.querySelector('.account-toast')?.remove();
  const toast = document.createElement('p');
  toast.className = 'account-toast'; toast.dataset.tone = tone; toast.setAttribute('role', 'status'); toast.textContent = text;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 6500);
}

/**
 * Point d'entrée des fonctions qui exigent un compte. Connecté : `resume()` aussitôt.
 * Sinon : invitation, connexion, pseudo, puis `resume()` — l'action voulue reprend toute seule.
 */
export async function requireAccount(menu, accounts, { resume, back = () => menu.home(), suggestion = '' }) {
  // Version du jeu sans moyen de connexion configuré : le multijoueur reste ouvert comme avant.
  if (!accountsConfigured()) return resume();
  if (accounts.ready) return resume();
  if (accounts.signedIn && !accounts.me) {
    try { await accounts.refresh(); } catch { /* Session invalide : effacée par le client. */ }
    if (accounts.ready) return resume();
  }
  if (accounts.signedIn && accounts.me?.user?.status === 'pending_profile') return showOnboarding(menu, accounts, { resume, back, suggestion });
  return showAccountGate(menu, accounts, { resume, back, suggestion });
}

/** Boutons des fournisseurs ; `purpose` : 'login' (connexion) ou 'link' (liaison au compte connecté). */
async function mountProviders(container, accounts, { purpose = 'login', exclude = [], done, fail }) {
  let serverProviders = null;
  try { serverProviders = (await accounts.config()).providers; }
  catch (error) { fail(error); return 0; }
  const providers = availableProviders(serverProviders).filter(p => !exclude.includes(p.id));
  container.replaceChildren();
  for (const provider of providers) {
    const slot = document.createElement('div'); slot.className = 'auth-slot';
    container.append(slot);
    Promise.resolve(provider.mount(slot, { purpose, nonce: () => accounts.nonce(purpose), done: proof => done(provider.id, proof), fail })).catch(fail);
  }
  return providers.length;
}

export function showAccountGate(menu, accounts, { resume, back, suggestion = '' }) {
  menu.page('account-gate', 'Compte PartageTonJeu', `<div class="account-gate">
    <section class="tutorial-card account-pitch"><span class="account-brand">PartageTonJeu</span><h2>Jouer en ligne</h2><p>${PITCH}</p>
      <ul class="account-perks"><li><span aria-hidden="true">♟</span>Parties entre amis, en ligne</li><li><span aria-hidden="true">★</span>Statistiques et classement</li><li><span aria-hidden="true">⚑</span>Candidats débloqués retrouvés sur tous tes appareils</li></ul></section>
    <section class="tutorial-card account-providers"><h2>Connexion</h2><div class="auth-buttons" aria-busy="true"><p class="menu-note">Préparation…</p></div>
      <p id="account-error" class="menu-status" role="alert"></p>
      <p class="menu-note">Aucun mot de passe à retenir. Ton e-mail n’est jamais montré aux autres joueurs.</p></section>
  </div><button type="button" id="account-later" class="menu-link">Pas maintenant : le solo reste accessible sans compte</button>`, back);
  const generation = menu.generation, root = menu.element, error = root.querySelector('#account-error');
  root.querySelector('#account-later').onclick = back;
  const fail = failure => {
    if (generation !== menu.generation) return;
    error.textContent = failure?.offline ? 'Pas de connexion Internet : la connexion au compte est impossible pour l’instant. Le solo fonctionne sans Internet.' : failure?.message || 'La connexion a échoué.';
    if (failure?.offline) root.querySelector('.auth-buttons').innerHTML = '<button type="button" id="account-retry" class="menu-primary">Réessayer</button>';
    root.querySelector('#account-retry')?.addEventListener('click', () => showAccountGate(menu, accounts, { resume, back, suggestion }));
  };
  void mountProviders(root.querySelector('.auth-buttons'), accounts, {
    fail,
    done: async (provider, proof) => {
      if (generation !== menu.generation) return;
      error.textContent = 'Connexion…';
      try {
        const result = await accounts.signIn(provider, proof);
        if (generation !== menu.generation) return;
        error.textContent = '';
        if (result.me.user.status === 'active') resume(); else showOnboarding(menu, accounts, { resume, back, suggestion });
      } catch (failure) {
        if (failure.code === 'invalid_nonce') { showAccountGate(menu, accounts, { resume, back, suggestion }); return; }
        fail(failure);
      }
    },
  }).then(count => {
    if (generation !== menu.generation) return;
    root.querySelector('.auth-buttons').removeAttribute('aria-busy');
    if (count === 0 && !error.textContent) error.textContent = 'Aucun moyen de connexion n’est disponible sur cet appareil pour le moment.';
  });
}

/** Case des actualités, dessinée dans le style du jeu (jamais cochée d'avance). La note n'apparaît qu'à l'inscription. */
const optIn = (checked, withNote = true) => `<label class="account-optin" for="account-newsletter"><input type="checkbox" id="account-newsletter" ${checked ? 'checked' : ''}>
  <span class="account-optin-box" aria-hidden="true"></span><span class="account-optin-text"><strong>${esc(NEWSLETTER_TEXT)}</strong>${withNote ? `<small>${esc(NEWSLETTER_NOTE)}</small>` : ''}</span></label>`;

/** Toute première connexion : une seule carte, pseudo → case des actualités → création. */
export function showOnboarding(menu, accounts, { resume, back, suggestion = '' }) {
  const proposed = suggestion && cleanNickname(suggestion) !== DEFAULT_NICKNAME ? cleanNickname(suggestion) : '';
  menu.page('account-onboarding', 'Bienvenue !', `<form id="onboarding-form" class="account-onboarding" novalidate>
    <section class="tutorial-card account-signup"><h2>Choisis ton pseudo</h2>
      <label class="account-field" for="account-username">Pseudo<input id="account-username" value="${esc(proposed)}" maxlength="16" autocomplete="nickname" autocapitalize="off" spellcheck="false" enterkeyhint="done" required></label>
      <p class="menu-note">3 à 16 caractères : lettres, chiffres, « _ », « - » ou « . ». C’est ton nom dans le classement.</p>
      <p id="username-status" class="menu-status" role="status"></p>
      ${optIn(false)}
      <button type="submit" id="account-create" class="menu-primary arcade-button">Créer mon compte <span aria-hidden="true">➜</span></button>
    </section>
  </form>`, back);
  const generation = menu.generation, root = menu.element;
  const input = root.querySelector('#account-username'), status = root.querySelector('#username-status'), button = root.querySelector('#account-create');
  let timer = null, check = 0;
  const verify = () => {
    clearTimeout(timer);
    const value = input.value.trim(), id = ++check;
    status.dataset.tone = '';
    if (value.length < 3) { status.textContent = ''; return; }
    timer = setTimeout(async () => {
      try {
        const result = await accounts.checkUsername(value);
        if (generation !== menu.generation || id !== check) return;
        status.textContent = result.available ? '✓ Pseudo disponible' : result.message; status.dataset.tone = result.available ? 'ok' : 'error';
      } catch { /* La vérification finale se fera à la validation. */ }
    }, 400);
  };
  input.oninput = verify;
  if (proposed) verify();
  root.querySelector('#onboarding-form').onsubmit = async event => {
    event.preventDefault();
    button.disabled = true; status.dataset.tone = ''; status.textContent = 'Création du compte…';
    try {
      // La case n'est jamais cochée par défaut ; un refus n'empêche rien.
      await accounts.updateProfile({ username: input.value, newsletter: root.querySelector('#account-newsletter').checked });
      if (generation !== menu.generation) return;
      showAccountToast(`Compte créé. Bienvenue, ${accounts.username} !`, 'ok');
      resume();
    } catch (failure) {
      if (generation !== menu.generation) return;
      status.textContent = failure.message; status.dataset.tone = 'error'; input.focus();
    } finally { if (generation === menu.generation) button.disabled = false; }
  };
}

const shownEmail = identity => identity.email_is_private_relay ? 'Adresse masquée (Apple)' : identity.email || 'Sans e-mail';

/** Une ligne par compte lié : logo, adresse, et une croix pour le retirer s'il en reste un autre. */
function identityLine(identity, removable) {
  const name = PROVIDER_NAMES[identity.provider] || identity.provider;
  return `<li data-provider="${esc(identity.provider)}"><span class="auth-logo" role="img" aria-label="${esc(name)}"></span><span>${esc(shownEmail(identity))}</span>
    ${removable ? `<button type="button" class="account-unlink" data-unlink="${esc(identity.provider)}" aria-label="Délier ${esc(name)}">×</button>` : ''}</li>`;
}

/** Paramètres → Compte : une seule carte (pseudo, comptes liés, actualités, déconnexion). */
export function showAccountSettings(menu, accounts, { back, signedOut = back } = {}) {
  if (!accounts.signedIn) { signedOut(); return; }
  const me = accounts.me;
  const linked = me.identities.map(i => i.provider);
  const linkable = availableProviders().filter(p => !linked.includes(p.id));
  const emails = me.identities.filter(i => i.email);
  menu.page('account', 'Mon compte', `<div class="account-settings">
    <section class="tutorial-card account-sheet">
      <form id="account-name" class="account-head" novalidate>
        <span class="account-avatar" aria-hidden="true">${esc((me.user.username || '?').charAt(0).toUpperCase())}</span>
        <label class="account-name-field" for="account-username"><span class="visually-hidden">Pseudo</span>
          <input id="account-username" value="${esc(me.user.username)}" maxlength="16" autocomplete="nickname" autocapitalize="off" spellcheck="false" enterkeyhint="done" required>
          <span class="account-edit" aria-hidden="true">✎</span></label>
      </form>
      <p id="name-status" class="menu-status" role="status"></p>
      <ul class="account-identities">${me.identities.map(i => identityLine(i, linked.length > 1)).join('')}</ul>
      ${linkable.length ? '<div class="auth-buttons account-link" id="account-link"></div>' : ''}
      <p id="link-status" class="menu-status" role="status"></p>
      ${optIn(me.newsletter.granted, false)}
      ${emails.length > 1 ? `<select id="newsletter-email" class="account-email" aria-label="Adresse qui reçoit les nouvelles" ${me.newsletter.granted ? '' : 'hidden'}>
        ${emails.map(i => `<option value="${esc(i.provider)}" ${i.provider === me.newsletter.provider ? 'selected' : ''}>✉ ${esc(shownEmail(i))}</option>`).join('')}</select>` : ''}
      <p id="newsletter-status" class="menu-status" role="status"></p>
      <footer class="account-foot"><button type="button" id="account-logout" class="menu-primary">Se déconnecter</button>
        <button type="button" id="account-delete" class="account-delete-link">Supprimer le compte</button></footer>
    </section>
  </div>`, back);
  const generation = menu.generation, root = menu.element;
  const say = (id, text, tone = '') => { if (generation !== menu.generation) return; const el = root.querySelector(id); el.textContent = text; el.dataset.tone = tone; };
  const failText = failure => failure.offline ? 'Pas de connexion Internet. Réessayez plus tard.' : failure.message;
  const reopen = () => { if (generation === menu.generation) showAccountSettings(menu, accounts, { back, signedOut }); };
  // Pseudo : enregistré en validant ou en quittant le champ, sans bouton.
  const nameInput = root.querySelector('#account-username');
  root.querySelector('#account-name').onsubmit = event => { event.preventDefault(); nameInput.blur(); };
  nameInput.onchange = async () => {
    try {
      await accounts.updateProfile({ username: nameInput.value });
      if (generation !== menu.generation) return;
      nameInput.value = accounts.username;
      root.querySelector('.account-avatar').textContent = accounts.username.charAt(0).toUpperCase();
      say('#name-status', '✓', 'ok');
    } catch (failure) { say('#name-status', failText(failure), 'error'); }
  };
  const emailSelect = root.querySelector('#newsletter-email');
  root.querySelector('#account-newsletter').onchange = async event => {
    const wanted = event.target.checked;
    try {
      await accounts.updateProfile({ newsletter: wanted });
      if (emailSelect) emailSelect.hidden = !wanted;
      say('#newsletter-status', '✓', 'ok');
    } catch (failure) { event.target.checked = !wanted; say('#newsletter-status', failText(failure), 'error'); }
  };
  if (emailSelect) emailSelect.onchange = async () => {
    try { await accounts.updateProfile({ newsletter_provider: emailSelect.value }); say('#newsletter-status', '✓', 'ok'); }
    catch (failure) { emailSelect.value = accounts.me.newsletter.provider; say('#newsletter-status', failText(failure), 'error'); }
  };
  const linkBox = root.querySelector('#account-link');
  if (linkBox) void mountProviders(linkBox, accounts, { purpose: 'link', exclude: linked, fail: failure => say('#link-status', failText(failure), 'error'),
    done: async (provider, proof) => {
      try { await accounts.link(provider, proof); reopen(); }
      catch (failure) { say('#link-status', failText(failure), 'error'); }
    } });
  root.querySelectorAll('[data-unlink]').forEach(button => button.onclick = async () => {
    try { await accounts.unlink(button.dataset.unlink); reopen(); }
    catch (failure) { say('#link-status', failText(failure), 'error'); }
  });
  root.querySelector('#account-logout').onclick = async () => { await accounts.logout(); showAccountToast('Vous êtes déconnecté. Le solo reste disponible.'); signedOut(); };
  root.querySelector('#account-delete').onclick = () => showDeleteAccount(menu, accounts, { back: () => showAccountSettings(menu, accounts, { back, signedOut }), deleted: signedOut });
}

const HOLD_MS = 2000;

/** Paramètres → Compte → Supprimer : on garde le doigt appuyé 2 secondes, une jauge se remplit. */
export function showDeleteAccount(menu, accounts, { back, deleted }) {
  menu.page('account-delete', 'Supprimer le compte', `<div class="tutorial-card account-delete-card">
    <p>Ton pseudo, tes connexions, tes déblocages et ton classement seront effacés pour toujours.</p>
    <footer class="account-actions"><button type="button" id="delete-cancel" class="menu-primary">Annuler</button>
      <button type="button" id="delete-account" class="account-delete account-hold"><span>Maintenir pour supprimer</span></button></footer>
    <p id="delete-status" class="menu-status" role="alert"></p></div>`, back);
  const generation = menu.generation, root = menu.element, button = root.querySelector('#delete-account'), status = root.querySelector('#delete-status');
  root.querySelector('#delete-cancel').onclick = back;
  let started = 0, frame = 0, busy = false;
  const setFill = ratio => button.style.setProperty('--hold', ratio.toFixed(3));
  const stop = () => { cancelAnimationFrame(frame); started = 0; if (!busy) setFill(0); };
  const tick = now => {
    if (!started) return;
    const ratio = Math.min(1, (now - started) / HOLD_MS);
    setFill(ratio);
    if (ratio < 1) frame = requestAnimationFrame(tick); else { started = 0; void remove(); }
  };
  const start = () => { if (busy || started) return; started = performance.now(); frame = requestAnimationFrame(tick); };
  button.onpointerdown = event => { try { button.setPointerCapture(event.pointerId); } catch { /* Pointeur déjà relâché. */ } start(); };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = stop;
  button.onkeydown = event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); start(); } };
  button.onkeyup = stop;
  button.oncontextmenu = event => event.preventDefault(); // Appui long sur téléphone : pas de menu.
  async function remove() {
    busy = true; button.disabled = true; status.textContent = 'Suppression…';
    try {
      const extra = {};
      // iOS : Apple exige de révoquer l'autorisation ; on redemande un code à l'appli.
      if (accounts.me?.identities.some(i => i.provider === 'apple') && nativeProviders().includes('apple')) {
        const proof = await nativeReauthorize('apple', await accounts.nonce('delete'));
        if (proof?.authorization_code) extra.apple_authorization_code = proof.authorization_code;
      }
      await accounts.deleteAccount(extra);
      showAccountToast('Ton compte a été supprimé.');
      deleted();
    } catch (failure) {
      if (generation !== menu.generation) return;
      busy = false; button.disabled = false; setFill(0);
      status.textContent = failure instanceof AuthCancelled ? '' : failure.offline ? 'Pas de connexion Internet : la suppression n’a pas pu être faite. Réessayez plus tard.' : failure.message;
    }
  }
}

/** Classement global et rang personnel, par mode de jeu. */
/** Modes où le joueur connecté a au moins une partie classée : le classement ne s'ouvre qu'à partir de là. */
export const rankedLadders = accounts => accounts.ready ? LADDERS.filter(([id]) => accounts.me?.stats?.[id]?.games > 0) : [];

export async function showLeaderboard(menu, accounts, { back, ladder = null } = {}) {
  const ladders = rankedLadders(accounts);
  if (!ladders.length) return back();
  if (!ladders.some(([id]) => id === ladder)) ladder = ladders[0][0];
  menu.page('leaderboard', 'Classement', `<div class="leaderboard">
    <div class="leaderboard-tabs" role="tablist">${ladders.map(([id, label]) => `<button type="button" role="tab" data-ladder="${id}" aria-selected="${id === ladder}">${label}</button>`).join('')}</div>
    <section class="tutorial-card leaderboard-me" aria-live="polite"><p class="menu-note">Chargement…</p></section>
    <ol class="leaderboard-list" aria-label="Meilleurs joueurs"></ol>
  </div>`, back);
  const generation = menu.generation, root = menu.element;
  root.querySelectorAll('[data-ladder]').forEach(tab => tab.onclick = () => showLeaderboard(menu, accounts, { back, ladder: tab.dataset.ladder }));
  const meBox = root.querySelector('.leaderboard-me'), list = root.querySelector('.leaderboard-list');
  try {
    const [board, mine] = await Promise.all([accounts.leaderboard(ladder), accounts.myRank(ladder)]);
    if (generation !== menu.generation) return;
    meBox.innerHTML = mine.ranked
        ? `<p class="leaderboard-rank"><strong>${format(mine.rank)}<sup>${mine.rank === 1 ? 'er' : 'e'}</sup></strong><span>${esc(accounts.username)}</span></p>
           <dl class="leaderboard-stats"><div><dt>Elo</dt><dd>${format(mine.rating)}</dd></div><div><dt>Parties</dt><dd>${format(mine.games)}</dd></div><div><dt>Victoires</dt><dd>${format(mine.wins)}</dd></div><div><dt>Défaites</dt><dd>${format(mine.losses)}</dd></div><div><dt>Taux</dt><dd>${format(mine.win_rate)} %</dd></div></dl>`
        : '';
    // Médaillon (avatar + couleur du meilleur classement) et titre, comme dans le profil.
    const card = e => ({ avatar: cleanAvatar(e.avatar, ALL_CANDIDATE_IDS), title: e.title_rank, tier: ratingTier(e.best_rating ?? e.rating) });
    list.innerHTML = board.entries.length ? board.entries.map(e => `<li data-me="${e.is_me}"><span class="leaderboard-pos">${format(e.rank)}</span><span class="leaderboard-player">${medallionContent(card(e), { size: 'sm' })}<strong>${esc(e.username)}</strong>${titleContent(card(e))}</span>
      <span class="leaderboard-elo">${format(e.rating)}</span><small>${format(e.wins)} V · ${format(e.losses)} D · ${format(e.win_rate)} %</small></li>`).join('') : '';
    hydrateMedallions(list);
  } catch (failure) {
    if (generation !== menu.generation) return;
    meBox.innerHTML = `<p class="menu-status">${failure.offline ? 'Le classement demande une connexion Internet. Le solo reste disponible.' : esc(failure.message)}</p>`;
  }
}

/** Carte « Compte » dans Mon profil : connexion, ou accès au compte et au classement. */
export function decorateProfile(menu, accounts) {
  const box = menu.element.querySelector('.profile-account-actions');
  if (!box) return;
  const reopen = () => menu.profile();
  // Le classement n'apparaît qu'avec au moins une partie classée.
  const leaderboard = rankedLadders(accounts).length ? '<button type="button" id="profile-leaderboard">Classement</button>' : '';
  if (!accountsConfigured()) box.innerHTML = '';
  else if (accounts.ready) box.innerHTML = `<button type="button" id="profile-account" class="menu-primary">Mon compte</button>${leaderboard}`;
  else box.innerHTML = '<button type="button" id="profile-login" class="menu-primary">Se connecter</button>';
  box.querySelector('#profile-account')?.addEventListener('click', () => showAccountSettings(menu, accounts, { back: reopen, signedOut: reopen }));
  box.querySelector('#profile-login')?.addEventListener('click', () => requireAccount(menu, accounts, { resume: reopen, back: reopen, suggestion: menu.account?.get()?.nickname }));
  box.querySelector('#profile-leaderboard')?.addEventListener('click', () => showLeaderboard(menu, accounts, { back: reopen }));
}
