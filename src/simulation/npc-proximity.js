import { wrap } from './world.js';

// Index de travail, absent des sauvegardes. Les rôles et les équipes restent lus dans l'état vivant.
const activeIndexes = new WeakMap();
const reusableIndexes = new WeakMap();
const CELL_SIZE = 8;

class NpcProximity {
  constructor(state) {
    this.state = state;
    this.length = state.debate_bounds ? null : state.world.length;
    this.count = this.length ? Math.max(1, Math.ceil(this.length / CELL_SIZE)) : null;
    this.size = this.length ? this.length / this.count : CELL_SIZE;
    this.cells = new Map();
    this.entries = new Map();
    this.population = [...state.npcs];
    state.npcs.forEach((npc, order) => {
      const entry = { npc, order, cell: null, x: null };
      this.entries.set(npc, entry); this.update(npc);
    });
  }

  cellAt(x) { return Math.floor((this.length ? wrap(x, this.length) : x) / this.size); }

  refresh(state) {
    if (this.length !== (state.debate_bounds ? null : state.world.length) || this.population.length !== state.npcs.length) return false;
    for (let i = 0; i < state.npcs.length; i++) {
      if (this.population[i] !== state.npcs[i]) return false;
      this.update(state.npcs[i]);
    }
    return true;
  }

  update(npc) {
    const entry = this.entries.get(npc);
    if (!entry) return;
    if (entry.x === npc.x) return;
    entry.x = npc.x;
    const cell = this.cellAt(npc.x);
    if (cell === entry.cell) return;
    if (entry.cell !== null) this.cells.get(entry.cell).delete(entry);
    if (!this.cells.has(cell)) this.cells.set(cell, new Set());
    this.cells.get(cell).add(entry); entry.cell = cell;
  }

  nearby(x, radius) {
    // Une portée couvrant la carte ne gagne rien à parcourir les cases.
    if (!Number.isFinite(radius) || this.length && radius * 2 >= this.length) return this.state.npcs;
    const center = this.length ? wrap(x, this.length) : x;
    const from = Math.floor((center - radius) / this.size), to = Math.floor((center + radius) / this.size);
    if (this.count && to - from + 1 >= this.count) return this.state.npcs;
    const found = [];
    for (let cell = from; cell <= to; cell++) {
      const key = this.count ? (cell % this.count + this.count) % this.count : cell;
      const entries = this.cells.get(key);
      if (entries) for (const entry of entries) found.push(entry);
    }
    // Les égalités et les priorités retrouvent exactement l'ordre de la population d'origine.
    found.sort((a, b) => a.order - b.order);
    return found.map(entry => entry.npc);
  }

  visit(x, radius, consider) {
    if (!Number.isFinite(radius) || this.length && radius * 2 >= this.length) {
      for (const npc of this.state.npcs) consider(npc);
      return;
    }
    const center = this.length ? wrap(x, this.length) : x;
    const from = Math.floor((center - radius) / this.size), to = Math.floor((center + radius) / this.size);
    if (this.count && to - from + 1 >= this.count) {
      for (const npc of this.state.npcs) consider(npc);
      return;
    }
    for (let cell = from; cell <= to; cell++) {
      const key = this.count ? (cell % this.count + this.count) % this.count : cell;
      const entries = this.cells.get(key);
      if (entries) for (const entry of entries) consider(entry.npc);
    }
  }
}

/** Borné à un traitement dont les déplacements sont suivis : aucun cache périmé entre deux pas. */
export function withNpcProximity(state, operation) {
  if (activeIndexes.has(state)) return operation();
  // Beaucoup de pas ont peu de recherches : n'utiliser les cases que lorsque cela devient utile.
  activeIndexes.set(state, { index: null, queries: 0 });
  try { return operation(); } finally { activeIndexes.delete(state); }
}

/** Les cases écartent les personnages éloignés ; l'appelant garde ses tests de portée exacts. */
function indexFor(state, radius) {
  const scope = activeIndexes.get(state);
  if (!scope) return null;
  if (!scope.index && (state.npcs.length < 64 || ++scope.queries < 4 || radius * 2 >= state.world.length)) return null;
  if (!scope.index) {
    let index = reusableIndexes.get(state);
    if (!index?.refresh(state)) { index = new NpcProximity(state); reusableIndexes.set(state, index); }
    scope.index = index;
  }
  return scope.index;
}
export const nearbyNpcs = (state, x, radius) => indexFor(state, radius)?.nearby(x, radius) || state.npcs;

/** Sans tableau intermédiaire ; le visiteur départage les cibles par distance puis identifiant. */
export function visitNearbyNpcs(state, x, radius, consider) {
  const index = indexFor(state, radius);
  if (index) index.visit(x, radius, consider);
  else for (const npc of state.npcs) consider(npc);
}
export const updateNpcProximity = (state, npc) => activeIndexes.get(state)?.index?.update(npc);
