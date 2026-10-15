// Pouvoirs personnels : les mineurs n'ont pas à choisir de style de campagne.
export const MINOR_ULTIMATES = {
  roussel: { kind: 'SAUSAGE', name: 'Saucisse boomerang', summary: 'Repousse à l’aller, ramène au retour.' },
  dupont_aignan: { kind: 'INVISIBLE', name: 'Sous les radars', summary: 'Disparaît pendant 5 secondes. Attaquer révèle sa position.' },
  glucksmann: { kind: 'DELIVERY', name: 'Livraison express de démocratie', summary: 'Un appel, un avion et trois livraisons de confettis.' },
  arthaud: { kind: 'TOOLS', name: 'Les outils de la lutte', summary: 'La faucille rapproche, le marteau aplatit.' },
  retailleau: { kind: 'BARRIER', name: 'Le mur républicain', summary: 'Un mur à franchir en sautant, qui finit par tomber sur les adversaires.' },
  attal: { kind: 'SATCHEL', name: 'Changement de programme', summary: 'Lance un cartable. Appuie à nouveau sur Ultime pour le faire éclater.' },
};

export const MINOR_ULTIMATE_KINDS = Object.values(MINOR_ULTIMATES).map(p => p.kind);
export const ULTIMATE_KINDS = ['HOLOGRAMS', 'WAVE', 'WALL', 'SURGE', 'FIRE', 'ZEMMOUR', 'BARDELLA', 'SCARF', 'EUROPE', ...MINOR_ULTIMATE_KINDS];
export const TEMPORARY_ULTIMATES = ['FIRE', 'SCARF', 'EUROPE', 'INVISIBLE', 'TOOLS'];

export const invisibleToEnemies = (actor, tick) => actor?.ultimate_effect?.kind === 'INVISIBLE' && actor.ultimate_effect.expires_tick > tick;
export const pendingSatchel = (state, actor) => state.powers.find(p => p.owner_id === actor?.id && p.kind === 'SATCHEL' && !p.detonated_tick && p.expires_tick > state.tick);
