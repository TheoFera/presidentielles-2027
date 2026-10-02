// Snapshots used to resume the simulation stay on the host. Guests only render.
// Événements que l’affichage d’un invité ne lit jamais (seul le panneau de debug de
// l’hôte les montre) : ils restent chez l’hôte et n’encombrent pas la connexion.
const HOST_ONLY_EVENTS = new Set(['AttackStarted', 'BardellaGuardianArmed', 'BardellaGuardianTriggered', 'BardellisationTriggered',
  'BuildingClosed', 'CampaignStyleChanged', 'CandidateKnockedDown', 'CandidateRespawned', 'CommunicationBroadcast', 'ControllerChanged',
  'DashChargeConsumed', 'DashChargeRecovered', 'DashEnded', 'DashEvadedHit', 'DashStarted', 'DebateFall', 'DebateFinished',
  'DebugBuildingConstructed', 'DebugMoneyGranted', 'DebugSpawnCapacityReached', 'DebugUnitSpawned', 'DebugZoneControlled',
  'DonationReady', 'EquipmentOrdered', 'EquipmentReady', 'EquipmentRefunded', 'EquipmentWorkerAssigned', 'FirstRoundResults',
  'FundingDropped', 'GuardEquipped', 'GuardReturnedHome', 'HeadquartersSucceeded', 'InterruptCrisisMeeting', 'MatchFinished',
  'MilitantEquipped', 'MilitantGroupDisbanded', 'MilitantGroupFormed', 'MinorCandidateDefeated', 'NeutralSpawned', 'NpcDemobilized',
  'NpcNeutralized', 'NpcReturnedHome', 'OvertimeStarted', 'RaidStarted', 'RallyParticipantReturned', 'ScandalKOTriggered',
  'SiteNeutralized', 'SpecialTriggered', 'SprintStarted', 'StartCrisisMeeting', 'SuccessfulCombatHit', 'TractReady',
  'TractWorkerAssigned', 'UltimateChargeChanged', 'UltimateChargeLost', 'UltimateDecayStarted', 'VehicleMounted', 'WinThematicDebate']);
const shownEvents = events => Array.isArray(events) ? events.filter(event => !HOST_ONLY_EVENTS.has(event?.type)) : events;
export function presentationState(state) {
  const shown = { ...state, campaign_snapshot: null };
  if ('events' in state) shown.events = shownEvents(state.events);
  // Débats de campagne et du premier tour : même tri pour leurs journaux.
  if (state.debate?.events) shown.debate = { ...state.debate, events: shownEvents(state.debate.events) };
  if (Array.isArray(state.campaign_events)) shown.campaign_events = state.campaign_events.map(event => event?.debate?.events ? { ...event, debate: { ...event.debate, events: shownEvents(event.debate.events) } } : event);
  return shown;
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
//   value            replace by a plain value: text, true/false, null or a number
//                    other than 0 (saves the brackets of the most frequent change)
//   0                delete this object field
//   { key: patch }   object: only changed fields
//   { k, o? }        list of entities with unique ids (PNJ, candidats…): changed
//                    entities by id; o = new id order when entities come, go or move
//   { k, s, a? }     same, for a sliding list (events, hits…): drop the s first
//                    entities, then append the ids of a (new ones, in k)
//   { i }            list of the same length (or entities in the same order, whose
//                    long ids need not travel): changed items by index
function entityIds(list) {
  if (!list.length) return null;
  const seen = new Set();
  for (const item of list) {
    if (!isObject(item) || Array.isArray(item) || (typeof item.id !== 'string' && typeof item.id !== 'number') || seen.has(String(item.id))) return null;
    seen.add(String(item.id));
  }
  return list.map(item => item.id);
}
// Remplacement : une valeur simple part sans crochets (sauf 0, qui veut dire « supprimé »).
const replace = value => isObject(value) || value === 0 ? [value] : value;
function diff(before, after) {
  if (before === after) return undefined;
  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) return replace(after);
  const patch = {};
  let changed = false;
  if (!Array.isArray(after)) {
    for (const key of Object.keys(after)) {
      const op = Object.hasOwn(before, key) ? diff(before[key], after[key]) : replace(after[key]);
      if (op !== undefined) { patch[key] = op; changed = true; }
    }
    for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) { patch[key] = 0; changed = true; }
    return changed ? patch : undefined;
  }
  const beforeIds = entityIds(before), afterIds = entityIds(after);
  if (beforeIds && afterIds) {
    const sameOrder = beforeIds.length === afterIds.length && beforeIds.every((id, i) => id === afterIds[i]);
    // Même ordre : les entités changées sont désignées par leur position, plus courte que leur identifiant.
    if (sameOrder) {
      after.forEach((item, i) => { const op = diff(before[i], item); if (op !== undefined) { patch[i] = op; changed = true; } });
      return changed ? { i: patch } : undefined;
    }
    const previous = new Map(before.map(item => [String(item.id), item]));
    for (const item of after) {
      const old = previous.get(String(item.id));
      const op = old ? diff(old, item) : [item];
      if (op !== undefined) { patch[String(item.id)] = op; changed = true; }
    }
    // Liste glissante : les plus anciens sortent au début, les nouveaux entrent à la fin.
    // On évite de renvoyer tout l’ordre des identifiants à chaque nouvel événement.
    const known = new Set(beforeIds.map(String));
    let kept = 0;
    while (kept < afterIds.length && known.has(String(afterIds[kept]))) kept++;
    const drop = beforeIds.length - kept;
    if (drop >= 0 && afterIds.slice(0, kept).every((id, i) => id === beforeIds[drop + i]) && afterIds.slice(kept).every(id => !known.has(String(id)))) {
      const added = afterIds.slice(kept);
      return added.length ? { k: patch, s: drop, a: added } : { k: patch, s: drop };
    }
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
  if (!isObject(op)) return op;
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
  if (!isObject(op.k) || (op.o !== undefined && !Array.isArray(op.o)) || (op.a !== undefined && !Array.isArray(op.a))) throw invalid();
  if (op.s !== undefined && (!Number.isInteger(op.s) || op.s < 0 || op.s > previous.length)) throw invalid();
  const old = new Map(previous.map(item => [String(item?.id), item]));
  const order = op.o ?? (op.s !== undefined ? [...previous.slice(op.s).map(item => item.id), ...(op.a || [])] : previous.map(item => item.id));
  return order.map(id => {
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
