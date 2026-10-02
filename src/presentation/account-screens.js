// Écrans du compte PartageTonJeu, dans les menus du jeu (mêmes cartes et boutons).
// Le solo n'est jamais derrière ces écrans : seuls le multijoueur et le classement
// demandent un compte.
import { NEWSLETTER_TEXT, NEWSLETTER_NOTE } from '../network/account-config.js';
import { availableProviders, accountsConfigured, nativeProviders, nativeReauthorize, AuthCancelled } from '../network/auth-providers.js';
import { cleanNickname, DEFAULT_NICKNAME } from './player-profile.js';

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

/** Case des actualités, dessinée dans le style du jeu (jamais cochée d'avance). */
const optIn = checked => `<label class="account-optin" for="account-newsletter"><input type="checkbox" id="account-newsletter" ${checked ? 'checked' : ''}>
  <span class="account-optin-box" aria-hidden="true"></span><span class="account-optin-text"><strong>${esc(NEWSLETTER_TEXT)}</strong><small>${esc(NEWSLETTER_NOTE)}</small></span></label>`;

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

function identityLine(identity) {
  const email = identity.email_is_private_relay ? 'Adresse masquée (relais Apple)' : identity.email ? esc(identity.email) : 'E-mail non communiqué';
  return `<li data-provider="${esc(identity.provider)}"><strong>${esc(PROVIDER_NAMES[identity.provider] || identity.provider)}</strong><span>${email}</span></li>`;
}

/** Paramètres → Compte : pseudo, connexions liées, actualités, déconnexion, suppression. */
export function showAccountSettings(menu, accounts, { back, signedOut = back } = {}) {
  if (!accounts.signedIn) { signedOut(); return; }
  const me = accounts.me;
  const linked = me.identities.map(i => i.provider);
  const linkable = availableProviders().filter(p => !linked.includes(p.id));
  menu.page('account', 'Mon compte PartageTonJeu', `<div class="account-settings">
    <form id="account-name" class="tutorial-card"><h2>Pseudo</h2>
      <label class="account-field" for="account-username">Pseudo affiché<input id="account-username" value="${esc(me.user.username)}" maxlength="16" autocomplete="nickname" autocapitalize="off" spellcheck="false" required></label>
      <button type="submit" class="menu-primary">Enregistrer</button><p id="name-status" class="menu-status" role="status"></p></form>
    <section class="tutorial-card"><h2>Connexion</h2><ul class="account-identities">${me.identities.map(identityLine).join('')}</ul>
      ${linkable.length ? `<p class="menu-note">Lier un autre moyen de connexion au même compte :</p><div class="auth-buttons" id="account-link"></div>` : ''}
      ${linked.length > 1 ? `<div class="account-unlink">${linked.map(p => `<button type="button" class="menu-link" data-unlink="${esc(p)}">Délier ${esc(PROVIDER_NAMES[p] || p)}</button>`).join('')}</div>` : ''}
      <p id="link-status" class="menu-status" role="status"></p></section>
    <section class="tutorial-card account-consent"><h2>E-mails</h2>
      ${optIn(me.newsletter.granted)}
      <p class="menu-note">L’e-mail du compte sert à la connexion ; il n’est utilisé pour ces informations que si la case est cochée.</p>
      <p id="newsletter-status" class="menu-status" role="status"></p></section>
    <section class="tutorial-card account-danger"><h2>Session</h2>
      <div class="account-actions"><button type="button" id="account-logout" class="menu-primary">Se déconnecter</button><button type="button" id="account-logout-all">Déconnecter tous mes appareils</button></div>
      <button type="button" id="account-delete" class="account-delete">Supprimer mon compte…</button>
      <p id="session-status" class="menu-status" role="status"></p></section>
  </div>`, back);
  const generation = menu.generation, root = menu.element;
  const say = (id, text, tone = '') => { if (generation !== menu.generation) return; const el = root.querySelector(id); el.textContent = text; el.dataset.tone = tone; };
  const failText = failure => failure.offline ? 'Pas de connexion Internet. Réessayez plus tard.' : failure.message;
  root.querySelector('#account-name').onsubmit = async event => {
    event.preventDefault();
    try { await accounts.updateProfile({ username: root.querySelector('#account-username').value }); say('#name-status', '✓ Pseudo enregistré.', 'ok'); }
    catch (failure) { say('#name-status', failText(failure), 'error'); }
  };
  root.querySelector('#account-newsletter').onchange = async event => {
    const wanted = event.target.checked;
    try { await accounts.updateProfile({ newsletter: wanted }); say('#newsletter-status', wanted ? '✓ Inscription enregistrée.' : '✓ Vous ne recevrez plus nos actualités.', 'ok'); }
    catch (failure) { event.target.checked = !wanted; say('#newsletter-status', failText(failure), 'error'); }
  };
  const linkBox = root.querySelector('#account-link');
  if (linkBox) void mountProviders(linkBox, accounts, { purpose: 'link', exclude: linked, fail: failure => say('#link-status', failText(failure), 'error'),
    done: async (provider, proof) => {
      try { await accounts.link(provider, proof); if (generation === menu.generation) showAccountSettings(menu, accounts, { back, signedOut }); }
      catch (failure) { say('#link-status', failText(failure), 'error'); }
    } });
  root.querySelectorAll('[data-unlink]').forEach(button => button.onclick = async () => {
    try { await accounts.unlink(button.dataset.unlink); showAccountSettings(menu, accounts, { back, signedOut }); }
    catch (failure) { say('#link-status', failText(failure), 'error'); }
  });
  root.querySelector('#account-logout').onclick = async () => { await accounts.logout(); showAccountToast('Vous êtes déconnecté. Le solo reste disponible.'); signedOut(); };
  root.querySelector('#account-logout-all').onclick = async () => {
    try { await accounts.logoutAll(); showAccountToast('Tous vos appareils sont déconnectés.'); signedOut(); }
    catch (failure) { say('#session-status', failText(failure), 'error'); }
  };
  root.querySelector('#account-delete').onclick = () => showDeleteAccount(menu, accounts, { back: () => showAccountSettings(menu, accounts, { back, signedOut }), deleted: signedOut });
}

/** Paramètres → Compte → Supprimer mon compte, avec confirmation explicite. */
export function showDeleteAccount(menu, accounts, { back, deleted }) {
  menu.page('account-delete', 'Supprimer mon compte', `<form id="delete-form" class="tutorial-card account-delete-card" novalidate><h2>Action définitive</h2>
    <p>Seront effacés : ton pseudo, tes moyens de connexion et e-mails, tes choix d’e-mails, tes candidats débloqués, tes statistiques et ton classement. Toutes tes sessions seront fermées.</p>
    <p class="menu-note">Les parties déjà jouées restent dans les statistiques des autres joueurs, sous une forme anonyme qui ne permet plus de te retrouver. Ta progression sur cet appareil (hors compte) n’est pas touchée.</p>
    <label class="account-field" for="delete-confirm">Pour confirmer, écris SUPPRIMER<input id="delete-confirm" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>
    <footer class="account-actions"><button type="button" id="delete-cancel" class="menu-primary">Annuler</button><button type="submit" id="delete-account" class="account-delete" disabled>Supprimer définitivement</button></footer>
    <p id="delete-status" class="menu-status" role="alert"></p></form>`, back);
  const generation = menu.generation, root = menu.element, input = root.querySelector('#delete-confirm'), button = root.querySelector('#delete-account');
  input.oninput = () => { button.disabled = input.value.trim().toUpperCase() !== 'SUPPRIMER'; };
  root.querySelector('#delete-cancel').onclick = back;
  root.querySelector('#delete-form').onsubmit = async event => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    const status = root.querySelector('#delete-status');
    status.textContent = 'Suppression…';
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
      if (generation !== menu.generation || failure instanceof AuthCancelled) return;
      status.textContent = failure.offline ? 'Pas de connexion Internet : la suppression n’a pas pu être faite. Réessayez plus tard.' : failure.message;
      button.disabled = false;
    }
  };
}

/** Classement global et rang personnel, par mode de jeu. */
export async function showLeaderboard(menu, accounts, { back, ladder = 'campaign' } = {}) {
  menu.page('leaderboard', 'Classement', `<div class="leaderboard">
    <div class="leaderboard-tabs" role="tablist">${LADDERS.map(([id, label]) => `<button type="button" role="tab" data-ladder="${id}" aria-selected="${id === ladder}">${label}</button>`).join('')}</div>
    <section class="tutorial-card leaderboard-me" aria-live="polite"><p class="menu-note">Chargement…</p></section>
    <ol class="leaderboard-list" aria-label="Meilleurs joueurs"></ol>
    <p class="menu-note leaderboard-help">Classement Elo : battre un joueur mieux classé rapporte plus de points. Parties en ligne seulement.</p>
  </div>`, back);
  const generation = menu.generation, root = menu.element;
  root.querySelectorAll('[data-ladder]').forEach(tab => tab.onclick = () => showLeaderboard(menu, accounts, { back, ladder: tab.dataset.ladder }));
  const meBox = root.querySelector('.leaderboard-me'), list = root.querySelector('.leaderboard-list');
  try {
    const [board, mine] = await Promise.all([accounts.leaderboard(ladder), accounts.ready ? accounts.myRank(ladder) : null]);
    if (generation !== menu.generation) return;
    meBox.innerHTML = !accounts.ready
      ? '<p>Connecte-toi pour apparaître dans le classement.</p><button type="button" id="leaderboard-login" class="menu-primary">Se connecter</button>'
      : mine.ranked
        ? `<p class="leaderboard-rank"><strong>${format(mine.rank)}<sup>${mine.rank === 1 ? 'er' : 'e'}</sup></strong><span>${esc(accounts.username)}</span></p>
           <dl class="leaderboard-stats"><div><dt>Elo</dt><dd>${format(mine.rating)}</dd></div><div><dt>Parties</dt><dd>${format(mine.games)}</dd></div><div><dt>Victoires</dt><dd>${format(mine.wins)}</dd></div><div><dt>Défaites</dt><dd>${format(mine.losses)}</dd></div><div><dt>Taux</dt><dd>${format(mine.win_rate)} %</dd></div></dl>`
        : `<p>${esc(accounts.username)} : pas encore de partie classée dans ce mode. Joue une partie en ligne pour entrer au classement (départ à 1 000).</p>`;
    meBox.querySelector('#leaderboard-login')?.addEventListener('click', () => requireAccount(menu, accounts, { resume: () => showLeaderboard(menu, accounts, { back, ladder }), back }));
    list.innerHTML = board.entries.length ? board.entries.map(e => `<li data-me="${e.is_me}"><span class="leaderboard-pos">${format(e.rank)}</span><strong>${esc(e.username)}</strong>
      <span class="leaderboard-elo">${format(e.rating)}</span><small>${format(e.wins)} V · ${format(e.losses)} D · ${format(e.win_rate)} %</small></li>`).join('')
      : '<li class="leaderboard-empty">Personne n’est encore classé. À toi de jouer !</li>';
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
  if (!accountsConfigured()) { box.innerHTML = `<button type="button" id="profile-leaderboard">Classement</button>`; }
  else if (accounts.ready) box.innerHTML = '<button type="button" id="profile-account" class="menu-primary">Mon compte</button><button type="button" id="profile-leaderboard">Classement</button>';
  else box.innerHTML = '<button type="button" id="profile-login" class="menu-primary">Se connecter</button><button type="button" id="profile-leaderboard">Classement</button>';
  box.querySelector('#profile-account')?.addEventListener('click', () => showAccountSettings(menu, accounts, { back: reopen, signedOut: reopen }));
  box.querySelector('#profile-login')?.addEventListener('click', () => requireAccount(menu, accounts, { resume: reopen, back: reopen, suggestion: menu.account?.get()?.nickname }));
  box.querySelector('#profile-leaderboard')?.addEventListener('click', () => showLeaderboard(menu, accounts, { back: reopen }));
}
