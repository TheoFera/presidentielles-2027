// Snapshots used to resume the simulation stay on the host. Guests only render.
export function presentationState(state) {
  return { ...state, campaign_snapshot: null };
}

// Reliable, ordered channels let each peer receive only changed top-level fields.
// Keep serialized baselines, never references into the mutable simulation.
export function stateDelta(state, baseline = new Map()) {
  const next = new Map(), changed = {};
  for (const [key, value] of Object.entries(presentationState(state))) {
    const encoded = JSON.stringify(value);
    next.set(key, encoded);
    if (baseline.get(key) !== encoded) changed[key] = value;
  }
  return { next, packet: { reset: baseline.size === 0, changed, removed: [...baseline.keys()].filter(key => !next.has(key)) } };
}

export function applyStateDelta(previous, packet) {
  if (!packet || typeof packet.reset !== 'boolean' || !packet.changed || !Array.isArray(packet.removed)) throw new Error('État réseau invalide.');
  const next = { ...(packet.reset ? {} : previous), ...packet.changed };
  for (const key of packet.removed) delete next[key];
  return next;
}
