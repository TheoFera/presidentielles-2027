export const factions = ['melenchon', 'le_pen', 'philippe'];
/** Mode du salon, choisi par l’hôte à la création : campagne (3 joueurs) ou arène (2 ou 3). */
export const roomMode = mode => mode === 'arena' ? 'arena' : 'campaign';
export const minimumPlayers = room => room.mode === 'arena' ? 2 : 3;
const ARENA_FIGHTERS = { '1v1': 2, '1v1v1': 3 };
const validStyle = style => typeof style === 'string' && /^[\w:-]{1,80}$/.test(style);

export function chooseCandidate(room, playerId, faction, style = null) {
  const arena = room.mode === 'arena';
  if (room.phase !== 'lobby' || room.players.length < minimumPlayers(room)) throw new Error(arena ? 'Attendez qu’un autre joueur rejoigne le salon.' : 'Connectez les trois joueurs avant de choisir les candidats.');
  if (!factions.includes(faction)) throw new Error('Choisissez un candidat disponible.');
  if (arena && !validStyle(style)) throw new Error('Choisissez un style.');
  const player = room.players.find(p => p.id === playerId);
  if (!player) throw new Error('Joueur introuvable.');
  // En arène, un même candidat peut revenir, mais avec un autre style.
  if (room.players.some(p => p.id !== playerId && p.faction === faction && (!arena || p.style === style))) throw new Error(arena ? 'Ce candidat avec ce style vient d’être choisi par un autre joueur.' : 'Ce candidat vient d’être choisi par un autre joueur.');
  player.faction = faction;
  if (arena) player.style = style;
}
export const candidatesReady = room => room.players.length >= minimumPlayers(room) && room.players.length <= 3
  && room.players.every(p => factions.includes(p.faction) && (room.mode !== 'arena' || validStyle(p.style)));

/** Réglages d’arène envoyés par l’hôte : chaque joueur garde son combattant, l’IA complète éventuellement. */
function arenaStart(room, setup) {
  const count = ARENA_FIGHTERS[setup?.format];
  if (!count || typeof setup.map !== 'string' || !/^[\w-]{1,40}$/.test(setup.map) || !Array.isArray(setup.fighters) || setup.fighters.length !== count || count < room.players.length) throw new Error('Réglages du combat invalides.');
  const fighters = setup.fighters.map(f => ({ faction: f?.faction, style: f?.style, player: f?.player ?? null }));
  const humans = fighters.filter(f => f.player !== null);
  const same = room.players.every(p => humans.filter(f => f.player === p.id && f.faction === p.faction && f.style === p.style).length === 1);
  if (humans.length !== room.players.length || !same || fighters.some(f => !factions.includes(f.faction) || !validStyle(f.style))) throw new Error('Réglages du combat invalides.');
  return { format: setup.format, map: setup.map, fighters };
}

/** L’hôte lance la préparation : tous les appareils chargent, puis confirment. */
export function startRoom(room, setup = null) {
  if (room.phase !== 'lobby') throw new Error('La partie a déjà commencé.');
  if (room.players.length < minimumPlayers(room)) throw new Error(room.mode === 'arena' ? 'Il faut au moins deux joueurs connectés.' : 'Il faut trois joueurs connectés.');
  if (!candidatesReady(room)) throw new Error(room.mode === 'arena' ? 'Chaque joueur doit choisir son candidat et son style.' : 'Chaque joueur doit choisir son candidat.');
  if (room.mode === 'arena') room.arena = arenaStart(room, setup);
  room.phase = 'loading'; room.players.forEach(p => { p.ready = false; });
}
