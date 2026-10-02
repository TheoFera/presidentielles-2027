import { ALL_FACTIONS } from '../simulation/world.js';
export const factions = ['melenchon', 'le_pen', 'philippe'];
const availableFactions = room => room.mode === 'debate' ? ALL_FACTIONS : factions;
/** Mode du salon, choisi par l’hôte à la création : campagne (3 joueurs) ou débat (2 ou 3). */
export const roomMode = mode => mode === 'debate' ? 'debate' : 'campaign';
export const minimumPlayers = room => room.mode === 'debate' ? 2 : 3;
const DEBATE_FIGHTERS = { '1v1': 2, '1v1v1': 3 };
const validStyle = style => typeof style === 'string' && /^[\w:-]{1,80}$/.test(style);

export function chooseCandidate(room, playerId, faction, style = null) {
  const debate = room.mode === 'debate';
  if (room.phase !== 'lobby' || room.players.length < minimumPlayers(room)) throw new Error(debate ? 'Attendez qu’un autre joueur rejoigne le salon.' : 'Connectez les trois joueurs avant de choisir les candidats.');
  if (!availableFactions(room).includes(faction)) throw new Error('Choisissez un candidat disponible.');
  if (debate && !validStyle(style)) throw new Error('Choisissez un style.');
  const player = room.players.find(p => p.id === playerId);
  if (!player) throw new Error('Joueur introuvable.');
  // En débat, un même candidat peut revenir, mais avec un autre style.
  if (room.players.some(p => p.id !== playerId && p.faction === faction && (!debate || p.style === style))) throw new Error(debate ? 'Ce candidat avec ce style vient d’être choisi par un autre joueur.' : 'Ce candidat vient d’être choisi par un autre joueur.');
  player.faction = faction;
  if (debate) player.style = style;
}
export const candidatesReady = room => room.players.length >= minimumPlayers(room) && room.players.length <= 3
  && room.players.every(p => availableFactions(room).includes(p.faction) && (room.mode !== 'debate' || validStyle(p.style)));

/** Réglages de débat envoyés par l’hôte : chaque joueur garde son combattant, l’IA complète éventuellement. */
function debateStart(room, setup) {
  const count = DEBATE_FIGHTERS[setup?.format];
  if (!count || typeof setup.map !== 'string' || !/^[\w-]{1,40}$/.test(setup.map) || !Array.isArray(setup.fighters) || setup.fighters.length !== count || count < room.players.length) throw new Error('Réglages du combat invalides.');
  const fighters = setup.fighters.map(f => ({ faction: f?.faction, style: f?.style, player: f?.player ?? null }));
  const humans = fighters.filter(f => f.player !== null);
  const same = room.players.every(p => humans.filter(f => f.player === p.id && f.faction === p.faction && f.style === p.style).length === 1);
  if (humans.length !== room.players.length || !same || fighters.some(f => !availableFactions(room).includes(f.faction) || !validStyle(f.style))) throw new Error('Réglages du combat invalides.');
  return { format: setup.format, map: setup.map, fighters };
}

/** L’hôte lance la préparation : tous les appareils chargent, puis confirment. */
export function startRoom(room, setup = null) {
  if (room.phase !== 'lobby') throw new Error('La partie a déjà commencé.');
  if (room.players.length < minimumPlayers(room)) throw new Error(room.mode === 'debate' ? 'Il faut au moins deux joueurs connectés.' : 'Il faut trois joueurs connectés.');
  if (!candidatesReady(room)) throw new Error(room.mode === 'debate' ? 'Chaque joueur doit choisir son candidat et son style.' : 'Chaque joueur doit choisir son candidat.');
  if (room.mode === 'debate') room.debate = debateStart(room, setup);
  room.phase = 'loading'; room.players.forEach(p => { p.ready = false; });
}

/**
 * Débat terminé : chaque joueur vote pour la revanche. Quand tous ont voté,
 * le même combat (plateau, format, combattants) repart en préparation.
 */
export function voteRematch(room, playerId) {
  if (room.mode !== 'debate' || room.phase !== 'playing' || !room.debate) throw new Error('La revanche n’est pas disponible.');
  if (!room.players.some(p => p.id === playerId)) throw new Error('Joueur introuvable.');
  room.rematch = [...new Set([...(room.rematch || []), playerId])].filter(id => room.players.some(p => p.id === id));
  if (room.players.every(p => room.rematch.includes(p.id))) {
    room.rematch = []; room.paused = false;
    room.phase = 'loading'; room.players.forEach(p => { p.ready = false; });
  }
}

/**
 * Débat terminé : retour de tout le salon à la sélection des combattants.
 * Les choix précédents restent cochés ; chacun peut les modifier, puis l’hôte relance.
 */
export function returnToLobby(room) {
  if (room.mode !== 'debate' || room.phase !== 'playing') throw new Error('Le changement de combattants n’est pas disponible.');
  room.phase = 'lobby'; room.rematch = []; room.paused = false;
  room.players.forEach(p => { p.ready = false; });
}
