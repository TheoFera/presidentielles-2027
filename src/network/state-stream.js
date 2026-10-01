// Snapshots used to resume the simulation stay on the host. Guests only render.
export function presentationState(state) {
  return { ...state, campaign_snapshot: null };
}

// Fractional numbers travel rounded to the thousandth: far below a pixel on screen,
// and a value drifting by less than that is not resent at all.
const PRECISION = 1000;
const isObject = value => value !== null && typeof value === 'object';

// Host-only counters that change every tick and that guests never display
// (debug panel and AI timers): never sent.
const HOST_ONLY = new Set(['spawn_timers', 'rng_state', 'roam_wait_ticks']);

// Detached, JSON-shaped copy of what guests display. Same rules as JSON.stringify
// (toJSON, omitted undefined fields, null for NaN), plus rounded fractions.
// `previous` (the last encoded state) lends its unchanged branches: less memory,
// and the diff skips them at once. Never cache by state identity: callers may
// update the same state object between broadcasts.
export function encodePresentationState(state, previous = null) { return detach(presentationState(state), previous); }
// Même copie détachée pour l'affichage local (solo ou hôte) : valeurs exactes, aucun champ
// retiré, comme JSON.parse(JSON.stringify(state)). Seules les branches modifiées sont
// recopiées : beaucoup moins de mémoire à libérer à chaque tick.
export function copyStateSharing(state, previous = null) { return detach(state, previous, true); }
// Number of fields of an encoded object, kept out of JSON: compared without
// recounting the previous object.
const FIELDS = Symbol('champs');
function detach(value, old, exact = false) {
  const type = typeof value;
  if (type === 'number') return !Number.isFinite(value) ? null : exact || Number.isInteger(value) ? value : Math.round(value * PRECISION) / PRECISION || 0;
  if (type === 'string' || type === 'boolean' || value === null) return value;
  if (type !== 'object') return undefined;
  if (typeof value.toJSON === 'function') return detach(value.toJSON(), old, exact);
  if (Array.isArray(value)) {
    const before = Array.isArray(old) && old.length === value.length ? old : null, length = value.length;
    // The copy is only built from the first difference: unchanged branches allocate nothing.
    let copy = before === null ? new Array(length) : null;
    for (let i = 0; i < length; i++) {
      let next = detach(value[i], before === null ? undefined : before[i], exact);
      if (next === undefined) next = null;
      if (copy === null) { if (next === before[i]) continue; copy = before.slice(0, i); }
      copy[i] = next;
    }
    return copy === null ? old : copy;
  }
  const before = old !== null && typeof old === 'object' && !Array.isArray(old) ? old : null;
  const keys = Object.keys(value);
  let copy = before === null ? {} : null, count = 0;
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    if (!exact && HOST_ONLY.has(key)) continue;
    const next = detach(value[key], before === null ? undefined : before[key], exact);
    if (copy === null) {
      const unchanged = next === undefined ? !Object.hasOwn(before, key) : next === before[key];
      if (unchanged) { if (next !== undefined) count++; continue; }
      copy = {};
      for (let j = 0; j < k; j++) if (Object.hasOwn(before, keys[j])) copy[keys[j]] = before[keys[j]];
    }
    if (next !== undefined) { copy[key] = next; count++; }
  }
  if (copy === null) {
    if (before[FIELDS] === count) return old;
    // Same values but fewer fields: rebuild from the kept ones.
    copy = {};
    for (const key of keys) if (Object.hasOwn(before, key)) copy[key] = before[key];
  }
  Object.defineProperty(copy, FIELDS, { value: count });
  return copy;
}

// Patch format, applied to the guest's previous state:
//   [value]          replace by value (first packet: [whole state])
//   0                delete this object field
//   { key: patch }   object: only changed fields
//   { k, o? }        list of entities with unique ids (PNJ, candidats…): changed
//                    entities by id; o = new id order when entities come, go or move
//   { i }            other list of the same length: changed items by index
function entityIds(list) {
  if (!list.length) return null;
  const seen = new Set();
  for (const item of list) {
    if (!isObject(item) || Array.isArray(item) || (typeof item.id !== 'string' && typeof item.id !== 'number') || seen.has(String(item.id))) return null;
    seen.add(String(item.id));
  }
  return list.map(item => item.id);
}
function diff(before, after) {
  if (before === after) return undefined;
  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) return [after];
  const patch = {};
  let changed = false;
  if (!Array.isArray(after)) {
    for (const key of Object.keys(after)) {
      const op = Object.hasOwn(before, key) ? diff(before[key], after[key]) : [after[key]];
      if (op !== undefined) { patch[key] = op; changed = true; }
    }
    for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) { patch[key] = 0; changed = true; }
    return changed ? patch : undefined;
  }
  const beforeIds = entityIds(before), afterIds = entityIds(after);
  if (beforeIds && afterIds) {
    const previous = new Map(before.map(item => [String(item.id), item]));
    for (const item of after) {
      const old = previous.get(String(item.id));
      const op = old ? diff(old, item) : [item];
      if (op !== undefined) { patch[String(item.id)] = op; changed = true; }
    }
    const sameOrder = beforeIds.length === afterIds.length && beforeIds.every((id, i) => id === afterIds[i]);
    if (sameOrder) return changed ? { k: patch } : undefined;
    return { k: patch, o: afterIds };
  }
  if (before.length !== after.length) return [after];
  after.forEach((item, i) => { const op = diff(before[i], item); if (op !== undefined) { patch[i] = op; changed = true; } });
  return changed ? { i: patch } : undefined;
}

const invalid = () => new Error('État réseau invalide.');
// Copy-on-write: unchanged branches are shared with the previous state, which the
// guest keeps for interpolation and must never be modified.
function patchValue(previous, op) {
  if (Array.isArray(op)) { if (op.length !== 1) throw invalid(); return op[0]; }
  if (!isObject(op) || !isObject(previous)) throw invalid();
  if (!Array.isArray(previous)) {
    const next = { ...previous };
    for (const [key, child] of Object.entries(op)) {
      if (key === '__proto__') throw invalid();
      if (child === 0) delete next[key]; else next[key] = patchValue(previous[key], child);
    }
    return next;
  }
  if (isObject(op.i)) {
    const next = previous.slice();
    for (const [key, child] of Object.entries(op.i)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= next.length) throw invalid();
      next[index] = patchValue(next[index], child);
    }
    return next;
  }
  if (!isObject(op.k) || (op.o !== undefined && !Array.isArray(op.o))) throw invalid();
  const old = new Map(previous.map(item => [String(item?.id), item]));
  return (op.o ?? previous.map(item => item.id)).map(id => {
    const key = String(id);
    if (Object.hasOwn(op.k, key)) return patchValue(old.get(key), op.k[key]);
    if (!old.has(key)) throw invalid();
    return old.get(key);
  });
}

// baseline: the last encoded state this guest received (null for the first packet).
export function stateDelta(state, baseline = null) {
  const next = encodePresentationState(state);
  return { next, packet: baseline ? diff(baseline, next) ?? {} : [next] };
}
export function encodeStateDelta(encoded, baseline = null) {
  return JSON.stringify(baseline ? diff(baseline, encoded) ?? {} : [encoded]);
}
export function applyStateDelta(previous, packet) {
  if (!Array.isArray(packet) && !isObject(previous)) throw invalid();
  return patchValue(previous, packet);
}
