/** Vérifie les transformations du personnage entier, au-delà du dessin d'une découpe isolée. */
export async function checkCharacterRuntime(page, config) {
  return page.evaluate(async config => {
    const { GameSimulation } = await import('/src/simulation/game-simulation.js');
    const { combatState } = await import('/src/simulation/combat-state.js');
    const { WorldRenderer } = await import('/src/presentation/rendu/renderer.js');
    const { visualManifest } = await import('/src/presentation/rendu/visual-manifest.js');
    const { CAMPAIGN_STYLES } = await import('/src/simulation/campaign-styles.js');
    const { MINOR_ANIMATION_FILES } = await import('/src/presentation/personnages/minor-animation-sprites.js');
    const loaded = new Map(await Promise.all(Object.entries(visualManifest).filter(([id]) =>
      id.startsWith('character-') || id.startsWith('minor-') || id.startsWith('ultimate-minor-')).map(async ([id, entry]) => {
      const image = new Image(); image.src = entry.file; await image.decode(); return [id, image];
    })));
    const sim = new GameSimulation(config, 42), state = sim.state, hz = sim.hz;
    const originals = new Map(state.candidates.map(actor => [actor.faction_id, structuredClone(actor)]));
    state.npcs = []; state.temporary_units = []; state.powers = []; state.buildings = [];
    const variants = [...Object.entries(CAMPAIGN_STYLES).flatMap(([faction, styles]) =>
      [null, ...styles.map(s => s.id)].map(style => ({ faction, style }))),
    ...Object.keys(MINOR_ANIMATION_FILES).map(faction => ({ faction, style: null }))];
    const report = [], failures = [];
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    for (const variant of variants) {
      const original = originals.get(variant.faction);
      if (!original) throw new Error('Candidat de contrôle absent : ' + variant.faction);
      const cases = [], add = (name, prepare = () => {}, options = {}) => cases.push({ name, prepare, ...options });
      for (const tick of [120, 131]) add('garde ' + tick, () => {}, { tick });
      add('attente', () => {}, { guard: false });
      for (const tick of [120, 124, 129, 135]) add('déplacement ordinaire ' + tick, a => { a.moving = true; a.axis = 1; }, { guard: false, tick });
      for (let frame = 0; frame < 8; frame++) add('pas de garde ' + frame, a => { a.moving = true; a.axis = 1; }, { walk: frame });
      for (const kind of ['CANDIDATE', 'CHARGED', 'DIVE']) for (const step of [1, 2, 3]) for (let age = 0; age < 12; age++) {
        add(kind + ' ' + step + ' ' + age, a => {
          const attack = { id: 'audit', owner_id: a.id, kind, step, direction: a.facing, elapsed_ticks: age, windup_ticks: 3, active_ticks: 3, recovery_ticks: 6 };
          state.attacks = [attack]; a.combat.attack_id = attack.id;
          if (kind === 'DIVE') { a.combat.jump_tick = state.tick - 5; a.combat.height = .6; }
        });
      }
      for (const age of [0, 10, 60]) add('charge ' + age, a => { a.combat.charge_active = true; a.combat.press_tick = state.tick - age; });
      for (let age = 0; age < Math.ceil(config.balance.candidate_combat.jump_duration_seconds * hz); age++) add('saut ' + age, a => { a.combat.jump_tick = state.tick - age; a.combat.height = .7; });
      for (const age of [0, 5]) add('réception ' + age, () => {}, { landing: age });
      const dash = Math.ceil(config.balance.dash.duration_seconds * hz);
      for (let age = 0; age < dash; age++) add('esquive ' + age, a => { a.dash_active = true; a.dash_direction = a.facing; a.dash_until_tick = state.tick + dash - age; });
      for (const strong of [false, true]) for (const velocity of [0, 2]) for (let age = 0; age < 20; age++) add('réaction ' + strong + ' ' + velocity + ' ' + age, a => {
        a.combat.stun_ticks = 30; a.combat.knockback_velocity = velocity;
        a.combat.last_hit = { target_id: a.id, tick: state.tick - age, strong };
      });
      for (const tick of [120, 127, 132, 140, 155, 165]) {
        add('étourdissement ' + tick, a => { a.combat.stun_ticks = 30; }, { tick });
        add('persuasion ' + tick, a => { a.persuasion_target_ids = ['npc']; }, { tick });
        add('achat ' + tick, a => { a.purchase_hold = {}; }, { tick });
      }
      for (let age = 0; age <= Math.ceil(config.balance.candidate_combat.ko_fall_seconds * hz) + 4; age++) add('K.O. ' + age, a => { a.is_ko = true; a.ko_started_tick = state.tick - age; });
      let checked = 0;
      for (const facing of [-1, 1]) for (const scenario of cases) {
        state.tick = scenario.tick ?? 120; state.attacks = [];
        const actor = { ...structuredClone(original), current_campaign_style: variant.style, combat: combatState(), facing,
          moving: false, axis: 0, is_ko: false, dash_active: false, purchase_hold: null, style_hold: null,
          persuasion_target_ids: [], ultimate_effect: null, bardella_form: false, x: 100 };
        state.candidates = [actor]; state.local_candidate_id = actor.id; scenario.prepare(actor);
        ctx.reset(); const draws = [];
        const monitored = new Proxy(ctx, {
          get(target, key) {
            if (key === 'drawImage') return (...args) => {
              const m = target.getTransform(), sourceW = args.length === 9 ? args[3] : args[0].width,
                sourceH = args.length === 9 ? args[4] : args[0].height;
              const x = Math.hypot(m.a, m.b) * args.at(-2) / sourceW,
                y = Math.hypot(m.c, m.d) * args.at(-1) / sourceH;
              draws.push({ ratio: x / y, x, y }); target.drawImage(...args);
            };
            const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
          }, set(target, key, value) { target[key] = value; return true; },
        });
        const renderer = { ctx: monitored, config, p: config.prototype.presentation, metrics: { groundY: 300, characterHeight: 150, pixelsPerUnit: 40, groundOffsetRatio: .06 },
          width: 600, height: 360, assets: { get: id => loaded.get(id), load: async () => {} }, screenX: () => 300,
          combatPoseTracker: { active: () => scenario.guard !== false },
          melenchonMotionTracker: { landing: () => scenario.landing ?? null, walk: () => scenario.walk ?? 0 },
          drawVisiblePerson: WorldRenderer.prototype.drawVisiblePerson };
        WorldRenderer.prototype.drawPerson.call(renderer, actor, 300, state);
        if (!draws.length || draws.some(d => !Number.isFinite(d.ratio) || Math.abs(d.ratio - 1) > 1e-10)) failures.push({ ...variant, scenario: scenario.name, facing, draws });
        checked++;
      }
      report.push({ ...variant, checked });
    }
    return { report, failures, checked: report.reduce((n, r) => n + r.checked, 0) };
  }, config);
}
