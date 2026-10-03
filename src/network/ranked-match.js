// Parties en ligne classées : lien entre le salon WebRTC existant et le serveur des comptes.
// Rien ne ralentit la partie : chaque appel part en arrière-plan, et un échec rend
// simplement la partie « non classée ».
//   hôte    : au lancement, déclare la partie → { id, key } ajouté au salon (room.match) ;
//   invités : reçoivent room.match par la connexion directe et rejoignent leur place ;
//   tous    : en fin de partie, envoient le résultat qu'ils ont vu (une seule fois).
import { FACTIONS } from '../simulation/world.js';
import { earnedUnlocks } from '../simulation/unlock-catalog.js';
import { debateFighterIds } from '../simulation/debate-mode.js';

/** Corps de déclaration : places du salon (identifiants des joueurs WebRTC). */
export function matchDeclaration(room, hostId) {
  const debate = room.mode === 'debate';
  const players = room.players.map(p => {
    const fighter = debate ? room.debate?.fighters.find(f => f.player === p.id) : null;
    return { seat: p.id, slot: p.slot, faction: fighter?.faction ?? p.faction, style: debate ? fighter?.style ?? p.style ?? null : null };
  });
  const format = debate ? room.debate?.format : 'trio';
  return { mode: debate ? 'debate' : 'campaign', format, host_seat: hostId, seats: players };
}

/** Ordre d'arrivée d'une campagne : élu, finaliste, éliminé au 1er tour. */
export function campaignPlacements(room, state) {
  if (state?.phase !== 'RESULTS' || !state.result) return null;
  const order = [state.result.winner, state.result.second, ...FACTIONS.filter(f => f !== state.result.winner && f !== state.result.second)];
  const seats = order.map(f => room.players.find(p => p.faction === f)?.id).filter(Boolean);
  return seats.length === room.players.length ? seats : null;
}
/** Candidats mis K.-O. par chaque joueur, gagnés à la fin de la campagne. */
export function campaignKnockouts(room, state) {
  return room.players.flatMap(p => earnedUnlocks(state, p.faction).map(candidate_id => ({ seat: p.id, candidate_id })));
}
/** Ordre d'arrivée d'un débat : classement en rounds gagnés (sinon vainqueur, puis K.-O. du dernier au premier), IA ignorée. */
export function debatePlacements(room, state) {
  const setup = room.debate;
  if (state?.phase !== 'OVER' || !setup) return null;
  const ids = debateFighterIds(setup.fighters);
  const ranking = state.standings?.length ? state.standings : [state.winner_id, ...[...(state.ko_order || [])].reverse()];
  const order = [...ranking, ...ids].filter((id, i, all) => id && all.indexOf(id) === i);
  const seats = order.map(id => setup.fighters[ids.indexOf(id)]?.player).filter(p => p && room.players.some(x => x.id === p));
  return seats.length === room.players.length ? seats : null;
}

export class RankedMatches {
  constructor(accounts, { notify = () => {} } = {}) { Object.assign(this, { accounts, notify, joined: new Set(), reported: new Set(), round: 0 }); }
  /** Seulement en ligne, joueur connecté (le mode sans Internet n'est jamais classé). */
  eligible(session) { return !!session?.online && this.accounts.ready; }

  /** Hôte : la partie passe en préparation (une déclaration par préparation, revanche comprise). */
  declare(session) {
    const round = ++this.round;
    if (!session?.host || !session.room) return;
    const room = session.room;
    room.match = null;
    if (!this.eligible(session)) return;
    void this.accounts.createMatch(matchDeclaration(room, session.id)).then(({ match_id, join_key }) => {
      // Le salon a pu changer entre-temps (revanche, retour à la sélection) : on ne publie que pour la même préparation.
      if (session.closed || round !== this.round || session.room !== room || !['loading', 'playing'].includes(room.phase)) return;
      room.match = { id: match_id, key: join_key };
      this.joined.add(match_id);
      session.publishRoom();
    }).catch(error => console.warn('Partie non classée :', error.message));
  }
  /** Tous : le salon reçu contient une partie déclarée → rejoindre sa place. */
  join(session) {
    const match = session?.room?.match;
    if (!this.eligible(session) || session.host || !match?.id || this.joined.has(match.id)) return;
    this.joined.add(match.id);
    void this.accounts.joinMatch(match.id, { join_key: match.key, seat: session.id }).catch(error => console.warn('Partie non classée :', error.message));
  }
  /** Fin de partie vue par ce joueur. */
  report(session, result) {
    const match = session?.room?.match;
    if (!this.eligible(session) || !match?.id || !result?.placements || this.reported.has(match.id)) return;
    this.reported.add(match.id);
    void this.accounts.reportResult(match.id, result).then(status => this.announce(match.id, status, 0))
      .catch(error => this.notify(error.offline ? 'Résultat non envoyé : pas de connexion Internet.' : `Résultat non enregistré : ${error.message}`, 'error'));
  }
  // Attend brièvement les autres joueurs pour afficher l'évolution du classement.
  announce(id, status, attempt) {
    if (status.status === 'completed') {
      const me = status.me || {};
      if (status.ranked && me.rating_after != null) {
        const delta = me.rating_after - me.rating_before;
        this.notify(`Partie classée : ${me.result === 'win' ? 'victoire' : 'défaite'} · Elo ${me.rating_after.toLocaleString('fr-FR')} (${delta >= 0 ? '+' : '−'}${Math.abs(delta)})`, me.result === 'win' ? 'ok' : 'info');
      } else this.notify('Résultat enregistré (partie non classée).');
      void this.accounts.refresh().catch(() => {});
      return;
    }
    if (status.status !== 'playing') { this.notify('Résultats contradictoires : cette partie ne compte pas au classement.', 'error'); return; }
    if (attempt >= 4) { this.notify('Résultat envoyé. Le classement sera mis à jour quand les autres joueurs auront confirmé.'); return; }
    setTimeout(() => this.accounts.matchStatus(id).then(next => this.announce(id, next, attempt + 1)).catch(() => {}), 4000);
  }
}
