import { zoneAt } from './world.js';
import { withNpcProximity } from './npc-proximity.js';

// Une observation est partagée uniquement pendant la production de commandes, avant leur application.
// Aucune donnée de travail n'entre dans les sauvegardes ou les états multijoueurs.
const active = new WeakMap();
const reusable = new WeakMap();

class AIObservation {
  constructor() { this.zones = new Map(); }

  refresh(state) {
    if (this.world !== state.world || this.zones.size !== state.world.subzones.length) this.zones.clear();
    this.world = state.world;
    for (const zone of state.world.subzones) {
      let group = this.zones.get(zone.id);
      if (!group || group.zone !== zone) {
        group = { zone, units: [], buildings: [], readyNeutral: 0, readyByFaction: new Map() };
        this.zones.set(zone.id, group);
      }
      group.units.length = 0; group.buildings.length = 0; group.readyNeutral = 0; group.readyByFaction.clear();
    }
    for (const npc of state.npcs) {
      const group = this.zones.get(zoneAt(state.world, npc.x).id);
      group.units.push(npc);
      if (npc.role === 'NEUTRE' && !npc.persuasion && !npc.rally_event_id) group.readyNeutral++;
      if (npc.role === 'SYMPATHISANT' || npc.role === 'MILITANT')
        group.readyByFaction.set(npc.faction_id, (group.readyByFaction.get(npc.faction_id) || 0) + 1);
    }
    for (const building of state.buildings) this.zones.get(building.subzone_id)?.buildings.push(building);
    return this;
  }
}

/** Réserver ce traitement aux décisions : appliquer leurs commandes seulement après sa sortie. */
export function withAIObservation(state, operation) {
  if (active.has(state)) return operation();
  active.set(state, { view: null });
  try { return withNpcProximity(state, operation); } finally { active.delete(state); }
}

/** Groupement paresseux : aucune préparation si l'IA se contente de combattre ou d'attendre. */
export function aiObservation(state) {
  const scope = active.get(state);
  if (scope?.view) return scope.view;
  const view = (reusable.get(state) || new AIObservation()).refresh(state);
  reusable.set(state, view);
  if (scope) scope.view = view;
  return view;
}
