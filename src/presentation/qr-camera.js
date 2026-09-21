import qrcode from '../vendor/qrcode.js';
import '../vendor/jsqr.js';
import { qrFrames, QrCollector } from '../network/qr-transfer.js';

export function animateQr(container, text) {
  let stopped = false, timer;
  container.innerHTML = '<div class="qr-image"></div><small class="qr-step">Préparation…</small>';
  const image = container.querySelector('.qr-image'), step = container.querySelector('.qr-step');
  qrFrames(text).then(frames => {
    if (stopped) return;
    const pictures = frames.map(frame => {
      const qr = qrcode(0, 'M'); qr.addData(frame, 'Byte'); qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
    });
    let index = 0;
    const draw = () => {
      image.innerHTML = pictures[index];
      image.querySelector('svg').setAttribute('preserveAspectRatio', 'xMidYMid meet');
      step.textContent = pictures.length > 1 ? `Gardez le cadre · ${index + 1}/${pictures.length}` : 'Prêt à scanner';
      index = (index + 1) % pictures.length;
    };
    draw(); if (pictures.length > 1) timer = setInterval(draw, 650);
  }).catch(error => { if (!stopped) step.textContent = error.message; });
  return () => { stopped = true; clearInterval(timer); };
}

// All decoding runs on the device. Camera images are never uploaded.
export function scanQr({ title, accept, done = () => {} }) {
  const dialog = document.createElement('dialog'); dialog.className = 'qr-scanner';
  dialog.innerHTML = '<h2></h2><video autoplay muted playsinline></video><p role="status">Autorisez la caméra, puis visez un seul QR code.</p><div><button type="button" class="qr-switch">Changer de caméra</button><button type="button" class="qr-close">Annuler</button></div>';
  dialog.querySelector('h2').textContent = title;
  document.body.append(dialog); dialog.showModal();
  const video = dialog.querySelector('video'), status = dialog.querySelector('p'), canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const collector = new QrCollector();
  const controller = new AbortController();
  let stream, timer, closed = false, facing = 'environment', generation = 0;
  function stopStream() { stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null; clearTimeout(timer); }
  function close() {
    if (closed) return;
    closed = true; generation++; controller.abort(); stopStream(); dialog.close(); dialog.remove();
    document.removeEventListener('visibilitychange', hidden); done();
  }
  function hidden() { if (document.hidden) close(); }
  document.addEventListener('visibilitychange', hidden);
  dialog.oncancel = event => { event.preventDefault(); close(); };
  dialog.querySelector('.qr-close').onclick = close;
  async function read(current = generation) {
    if (closed || !stream || current !== generation) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = globalThis.jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      if (result) {
        try {
          const progress = await collector.add(result.data);
          if (closed || current !== generation) return;
          status.textContent = `Lecture : ${progress.read}/${progress.total} · Gardez le cadre.`;
          if (progress.value) { status.textContent = 'QR lu. Préparation de la connexion…'; await accept(progress.value, controller.signal); close(); return; }
        } catch (error) { if (!closed) status.textContent = error.message; }
      }
    }
    if (!closed && current === generation) timer = setTimeout(() => read(current), 120);
  }
  async function start() {
    const current = ++generation; stopStream();
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'La caméra nécessite le site en HTTPS. Ouvrez le site publié, ou utilisez le mode texte.'; return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (closed || current !== generation) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media; video.srcObject = media; await video.play();
      if (!closed && current === generation) { status.textContent = 'Visez un seul QR code et gardez le cadre quelques secondes.'; void read(); }
    } catch (error) {
      if (closed || current !== generation) return;
      stopStream();
      status.textContent = error.name === 'NotAllowedError' ? 'Caméra refusée. Autorisez-la dans le navigateur ou utilisez le mode texte.' : 'Caméra indisponible. Fermez les autres applications qui l’utilisent, ou utilisez le mode texte.';
    }
  }
  dialog.querySelector('.qr-switch').onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; void start(); };
  void start(); return close;
}
