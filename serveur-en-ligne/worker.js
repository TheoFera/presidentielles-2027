// Serveur de salons en ligne, hébergé gratuitement sur Cloudflare Workers.
//   GET /        → vérifie que le serveur répond
//   GET /ice     → adresses STUN/TURN (identifiants TURN temporaires, 24 h)
//   GET /salon   → WebSocket de mise en relation (?action=create|join|resume)
// Un seul Durable Object (« standard ») garde tous les salons en mémoire.
import { SignalHub } from './signal-hub.js';

const STUN_ONLY = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

function allowedOrigin(request, env) {
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  // Liste vide : tout le monde est accepté. Pas d’en-tête Origin : outil en ligne de commande.
  return !list.length || !origin || list.includes(origin);
}
function corsHeaders(request) {
  return { 'Access-Control-Allow-Origin': request.headers.get('Origin') || '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin' };
}
function json(request, value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(request) } });
}

// Identifiants TURN Cloudflare : la clé reste secrète ici, le téléphone ne reçoit
// qu’un identifiant temporaire. Sans clé configurée, seul STUN est proposé.
async function iceServers(env) {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return STUN_ONLY;
  try {
    const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!response.ok) throw new Error(`TURN ${response.status}`);
    const data = await response.json();
    // Les navigateurs refusent le port 53 : on retire ces adresses par précaution.
    const servers = (Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers]).filter(Boolean)
      .map(server => ({ ...server, urls: [].concat(server.urls).filter(url => !/:53(\?|$)/.test(url)) }))
      .filter(server => server.urls.length);
    return servers.length ? servers : STUN_ONLY;
  } catch (error) {
    console.error('Identifiants TURN indisponibles :', error.message);
    return STUN_ONLY;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (!allowedOrigin(request, env)) return new Response('Origine refusée.', { status: 403 });
    if (url.pathname === '/') return json(request, { available: true, game: 'Présidentielle 2027 : Le Jeu' });
    if (url.pathname === '/ice') return json(request, { iceServers: await iceServers(env) });
    if (url.pathname === '/salon') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu.', { status: 426 });
      return env.SALONS.get(env.SALONS.idFromName('standard')).fetch(request);
    }
    return new Response('Introuvable.', { status: 404 });
  },
};

export class Salons {
  constructor() {
    this.hub = new SignalHub();
    this.sweep = setInterval(() => this.hub.sweep(), 60000);
  }
  async fetch(request) {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const socket = { send: text => server.send(text), close: (code, reason) => server.close(code, reason) };
    server.addEventListener('message', event => this.hub.message(socket, typeof event.data === 'string' ? event.data : ''));
    server.addEventListener('close', () => this.hub.closed(socket));
    server.addEventListener('error', () => this.hub.closed(socket));
    this.hub.open(socket, params);
    return new Response(null, { status: 101, webSocket: client });
  }
}
