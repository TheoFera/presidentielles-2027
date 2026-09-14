import { strategicAICommands } from './ai-strategy.js';

/** Les finalistes continuent à conquérir et combattre avec les mêmes règles. */
export function sprintAICommands(state, config, candidate) {
  return strategicAICommands(state, config, candidate);
}
