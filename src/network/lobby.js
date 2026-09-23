export const factions = ['melenchon', 'le_pen', 'philippe'];
export function chooseCandidate(room, playerId, faction) {
  if (room.phase !== 'lobby' || room.players.length !== 3) throw new Error('Connectez les trois joueurs avant de choisir les candidats.');
  if (!factions.includes(faction)) throw new Error('Choisissez un candidat disponible.');
  const player = room.players.find(p => p.id === playerId);
  if (!player) throw new Error('Joueur introuvable.');
  if (room.players.some(p => p.id !== playerId && p.faction === faction)) throw new Error('Ce candidat vient d’être choisi par un autre joueur.');
  player.faction = faction;
}
export const candidatesReady = room => room.players.length === 3 && room.players.every(p => factions.includes(p.faction));
