import { animateQr, scanQr } from './qr-camera.js';
import { copySignal } from './copy-signal.js';

export function showQrInvitations(menu, session, back, textMode) {
  const slots = [2, 3];
  menu.page('qr-invite', 'Invitez vos amis', `<p class="menu-intro">Hôte : joueur 1. Un QR par ami. Vous choisirez vos candidats une fois connectés.</p><div class="qr-invitations">${slots.map(slot => `<article class="qr-card" data-qr-slot="${slot}"><h2>Joueur ${slot}</h2><div class="qr-display"><p>Préparation…</p></div><p class="qr-player-status" role="status">Place libre</p><div class="qr-card-actions"><button type="button" class="qr-enlarge" disabled>Agrandir</button><button type="button" class="qr-copy" disabled>Copier l’invitation</button></div></article>`).join('')}</div><p id="qr-host-status" class="menu-status" role="status">Chacun choisit un QR différent.</p><footer class="qr-actions"><button id="scan-answers" class="menu-primary">Scanner une réponse</button><button id="qr-back-lobby">Voir le salon</button><button id="text-invite">Mode texte</button></footer>`, back);
  const generation = menu.generation, stops = new Map();
  let stopScanner, closeZoom;
  menu.cleanup = () => { stops.forEach(stop => stop()); stopScanner?.(); closeZoom?.(); menu.roomUpdate = null; };
  const status = menu.element.querySelector('#qr-host-status');
  menu.roomUpdate = () => {
    for (const slot of slots) {
      const connected = session.room.players.some(p => p.slot === slot);
      const card = menu.element.querySelector(`[data-qr-slot="${slot}"]`);
      if (connected) {
        stops.get(slot)?.(); stops.delete(slot);
        card.querySelector('.qr-display').innerHTML = '<strong class="qr-connected">✓ Connecté</strong>';
        card.querySelector('.qr-enlarge').disabled = true;
        card.querySelector('.qr-copy').disabled = true;
        card.querySelector('.qr-player-status').textContent = 'Prêt à rejoindre la partie';
      }
    }
    const full = session.room.players.length === 3;
    menu.element.querySelector('#scan-answers').disabled = full;
    status.textContent = full ? '3/3 joueurs connectés ! Ouvrez le salon pour lancer.' : `${session.room.players.length}/3 joueurs connectés · Scannez les réponses dans l’ordre de votre choix.`;
  };
  menu.element.querySelector('#scan-answers').onclick = () => {
    stopScanner = scanQr({ title: 'Scannez la réponse d’un ami', accept: async value => {
      await session.accept(value);
      if (menu.generation === generation) status.textContent = 'Réponse lue. Connexion au joueur…';
    } });
  };
  menu.element.querySelector('#qr-back-lobby').onclick = back;
  menu.element.querySelector('#text-invite').onclick = textMode;
  for (const slot of slots) {
    if (session.room.players.some(p => p.slot === slot)) continue;
    const card = menu.element.querySelector(`[data-qr-slot="${slot}"]`);
    void session.invite(slot).then(code => {
      if (menu.generation !== generation || session.room.players.some(p => p.slot === slot)) return;
      stops.set(slot, animateQr(card.querySelector('.qr-display'), code));
      const copy = card.querySelector('.qr-copy'); copy.disabled = false;
      copy.onclick = () => copySignal(code, status);
      const enlarge = card.querySelector('.qr-enlarge'); enlarge.disabled = false;
      enlarge.onclick = () => {
        const dialog = document.createElement('dialog'); dialog.className = 'qr-zoom';
        dialog.innerHTML = '<h2></h2><div class="qr-display"></div><button>Fermer</button>';
        dialog.querySelector('h2').textContent = `Invitation du joueur ${slot}`;
        document.body.append(dialog); dialog.showModal();
        const stop = animateQr(dialog.querySelector('.qr-display'), code);
        closeZoom = () => { stop(); dialog.close(); dialog.remove(); };
        dialog.querySelector('button').onclick = closeZoom;
        dialog.oncancel = event => { event.preventDefault(); closeZoom(); };
      };
    }).catch(error => { if (menu.generation === generation) card.querySelector('.qr-player-status').textContent = error.message; });
  }
  menu.roomUpdate();
}

export function showQrAnswer(menu, session, leave, textMode) {
  menu.page('qr-answer', 'Montrez votre réponse', '<p class="menu-intro">L’hôte scanne votre QR ou colle votre réponse en mode texte.</p><article class="qr-answer-card"><div class="qr-display"></div></article><p id="qr-copy-status" class="menu-status" role="status">Gardez cet écran ouvert. Le salon s’ouvrira automatiquement.</p><footer class="qr-actions"><button id="copy-answer" class="menu-primary">Copier la réponse</button><button id="text-answer">Mode texte</button></footer>', leave);
  menu.cleanup = animateQr(menu.element.querySelector('.qr-display'), session.answer);
  menu.element.querySelector('#text-answer').onclick = textMode;
  menu.element.querySelector('#copy-answer').onclick = () => copySignal(session.answer, menu.element.querySelector('#qr-copy-status'));
}
