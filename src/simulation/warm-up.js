// Partie d'essai jouée en mémoire pendant l'écran de chargement, puis jetée.
//
// Le navigateur ne prépare (compile) une partie du code qu'à sa première utilisation. Sans cette partie
// d'essai, les premières décisions de l'ordinateur et le premier événement de campagne coûtaient jusqu'à
// 25 ms de plus à l'image où ils arrivaient (mesuré sur téléphone simulé, processeur ralenti 4 fois),
// contre 0,03 ms en moyenne ensuite. Ici, ce travail est fait avant de jouer.
//
// La vraie partie n'en garde aucune trace : chaque partie a son propre état et son propre hasard
// (aucun `Math.random` dans la simulation), et les mémoires de calcul sont rangées par partie.
import { GameSimulation } from './game-simulation.js';
import { AIController, collectCommands } from './controllers.js';

const IDLE_PLAYER = { commands: () => [] };

/** Joue `ticks` pas d'une partie jetable, en rendant la main au navigateur tous les `yieldEvery` pas. */
export async function warmUpSimulation(config, { ticks = 150, yieldEvery = 25, pause = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
  try {
    const sim = new GameSimulation(config, 97, 'candidate:melenchon');
    const ai = new AIController(config);
    for (let i = 0; i < ticks; i++) {
      const commands = collectCommands(sim.state, IDLE_PLAYER, ai);
      // Un événement de campagne, pour préparer aussi ce code (refusé sans dommage s'il n'est pas permis).
      if (i === 30) commands.push({ type: 'DebugStartCampaignEvent', family: 'RASSEMBLEMENT' });
      sim.step(commands);
      if ((i + 1) % yieldEvery === 0) await pause();
    }
  } catch (error) {
    // Une partie d'essai ratée ne doit jamais empêcher la vraie de démarrer.
    console.warn('Partie d’essai du chargement interrompue :', error);
  }
}
