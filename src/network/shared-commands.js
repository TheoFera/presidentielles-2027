const allowed = new Set(['Move', 'Attack', 'PressAttack', 'ReleaseAttack', 'CancelAttack', 'Jump', 'Dash', 'ActivateUltimate', 'SetCampaignActive', 'InteractionPresence', 'HoldCampaignStyle', 'SelectCampaignStyle', 'CancelCampaignStyle']);
export function sanitizeCommands(commands, faction) {
  if (!Array.isArray(commands) || commands.length > 20) throw new Error('Commandes invalides.');
  return commands.map(command => {
    if (!command || !allowed.has(command.type)) throw new Error('Commande interdite.');
    const clean = { type: command.type, candidateId: `candidate:${faction}` };
    if (command.type === 'Move') clean.axis = [-1, 0, 1].includes(command.axis) ? command.axis : 0;
    if (['Attack', 'Dash'].includes(command.type)) clean.direction = [-1, 1].includes(command.direction) ? command.direction : null;
    if (['SetCampaignActive', 'InteractionPresence', 'HoldCampaignStyle'].includes(command.type)) clean.active = command.active === true;
    if (command.type === 'SelectCampaignStyle') clean.styleId = String(command.styleId || '').slice(0, 80);
    return clean;
  });
}
// The host assigns the candidate from the authenticated player and sets these
// two continuous presence flags itself. Preserve every other command in order.
export function outgoingCommands(commands) {
  return commands.filter(command => !['SetCampaignActive', 'InteractionPresence'].includes(command.type))
    .map(({ candidateId, ...command }) => command);
}
