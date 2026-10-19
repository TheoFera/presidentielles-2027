export const usesScarfWeapon = (entity, state) => entity.faction_id === 'philippe'
  && entity.ultimate_effect?.kind === 'SCARF' && entity.ultimate_effect.expires_tick > state.tick;

// Le costume reste celui du joueur dans la simulation ; seul le dessin retire l'écharpe portée.
export const scarfCostumeActor = entity => ({ ...entity, current_campaign_style: 'philippe_gestionnaire' });
