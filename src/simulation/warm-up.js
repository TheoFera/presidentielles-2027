// Partie d'essai jouée en mémoire pendant l'écran de chargement, puis jetée.
//
// Le navigateur ne prépare (compile) une partie du code qu'à sa première utilisation. Sans cette partie
// d'essai, les premières fois de la partie coûtaient cher à l'image où elles arrivaient (mesuré sur
// téléphone simulé, processeur ralenti 4 fois) : premières décisions de l'ordinateur (25 ms), première
// persuasion (107 ms), premiers réflexes de l'ordinateur (61 ms), premier QG et choix du style (jusqu'à
// 140 ms), premier rassemblement, premiers coups. Ici, ce travail est fait avant de jouer : la partie
// d'essai passe volontairement par chacune de ces situations.
//
// La vraie partie n'en garde aucune trace : chaque partie a son propre état et son propre hasard
// (aucun `Math.random` dans la simulation), et les mémoires de calcul sont rangées par partie.
import { GameSimulation } from './game-simulation.js';
import { AIController, collectCommands } from './controllers.js';
import { convertNeutral } from './npc-votes.js';
import { FACTIONS } from './world.js';

/** Mise en place des « premières fois » : argent, soutiens, puis deux candidats face à face. */
function prepareFirstTimes(sim, tick) {
  const { state, config } = sim, majors = state.candidates.filter(c => FACTIONS.includes(c.faction_id) && !c.minor);
  if (tick === 1) {
    // Chacun peut prendre son QG (puis choisir son style) : de l'argent et trois soutiens dans son quartier.
    for (const c of majors) {
      c.money += 20000;
      const home = config.layout.starting_positions[c.faction_id];
      state.npcs.filter(n => n.role === 'NEUTRE' && n.origin_subzone_id === home).slice(0, 3).forEach(n => convertNeutral(sim, n, c.faction_id));
    }
  }
  // Un rassemblement (refusé sans dommage s'il n'est pas permis).
  if (tick === 30) return [{ type: 'DebugStartCampaignEvent', family: 'RASSEMBLEMENT' }];
  // Deux candidats côte à côte pendant deux secondes, l'un frappe l'autre : coups, chutes et ultime.
  if (tick >= 140 && tick < 200) {
    const [a, b] = majors;
    a.x = b.x - 0.9; a.facing = 1;
    return [{ type: 'Move', candidateId: a.id, axis: 0 }, ...(tick % 6 === 0 ? [{ type: 'Attack', candidateId: a.id }] : [])];
  }
  return [];
}

/** Joue `ticks` pas d'une partie jetable, en rendant la main au navigateur tous les `yieldEvery` pas. */
export async function warmUpSimulation(config, { ticks = 280, yieldEvery = 25, pause = () => new Promise(resolve => setTimeout(resolve, 0)), onEvent = null } = {}) {
  try {
    const sim = new GameSimulation(config, 97, 'candidate:melenchon');
    if (onEvent) { const emit = sim.emit.bind(sim); sim.emit = (type, data) => { onEvent(type); emit(type, data); }; }
    const ai = new AIController(config);
    for (let i = 0; i < ticks; i++) {
      // Tous les candidats, y compris celui du « joueur », sont menés par l'ordinateur.
      const commands = [...collectCommands(sim.state, ai, ai), ...prepareFirstTimes(sim, i)];
      sim.step(commands);
      if ((i + 1) % yieldEvery === 0) await pause();
    }
  } catch (error) {
    // Une partie d'essai ratée ne doit jamais empêcher la vraie de démarrer.
    console.warn('Partie d’essai du chargement interrompue :', error);
  }
}
