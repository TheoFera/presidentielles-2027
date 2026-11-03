// Sauvegarde de la campagne solo en cours (une seule place), dans le stockage du navigateur ou de l'appli.
//
// Rien n'est écrit pendant le jeu : la partie est copiée seulement à l'ouverture de la pause, au bouton
// « Retour au menu » de la pause, et quand le jeu passe en arrière-plan (autre onglet, appli quittée,
// téléphone verrouillé). Une copie prend quelques millisecondes : elle ne ralentit jamais la partie.
//
// Deux entrées : un petit résumé (lu par l'accueil pour afficher « Reprendre », sans lire toute la partie)
// et l'état complet de la simulation (environ 250 ko), relu seulement au moment de reprendre.
import { fingerprint } from '../../simulation/world.js';

export const SAVED_CAMPAIGN_KEY = 'presidentielles2027:partie:v1';
export const SAVED_CAMPAIGN_SUMMARY_KEY = 'presidentielles2027:partie-resume:v1';
const FORMAT = 1;
const SAVABLE_PHASES = ['CAMPAIGN', 'SECOND_ROUND_SPRINT'];
// L'empreinte relit toute la configuration : calculée une fois par configuration.
const fingerprints = new WeakMap();
const configFingerprint = config => { if (!fingerprints.has(config)) fingerprints.set(config, fingerprint(config)); return fingerprints.get(config); };

/**
 * La partie peut-elle être sauvegardée maintenant ? Campagne ou sprint du second tour, après la scène
 * d'ouverture, et le joueur encore en lice. Les débats télé et les résultats ne sont pas sauvegardés :
 * la dernière sauvegarde (avant eux) reste valable.
 */
export function canSaveCampaign(state) {
  if (!state || !SAVABLE_PHASES.includes(state.phase) || state.campaign_intro) return false;
  const local = state.candidates.find(c => c.id === state.local_candidate_id);
  return !!local && !local.eliminated;
}

/**
 * Écrit la partie. `run` : la partie déclarée au compte (id, début, outils de débogage utilisés), pour que
 * la reprise puisse encore débloquer des candidats. Rend `false` si le stockage est plein ou indisponible.
 */
export function saveCampaign(simulation, { run = null, now = Date.now(), storage = globalThis.localStorage } = {}) {
  const state = simulation.state;
  if (!canSaveCampaign(state)) return false;
  const summary = {
    format: FORMAT, config_fingerprint: state.config_fingerprint, tick: state.tick, saved_at: now,
    candidate_id: state.local_candidate_id, phase: state.phase, days_remaining: state.days_remaining,
    run: run && { id: run.id ?? null, startedAt: run.startedAt, tainted: !!run.tainted },
  };
  try {
    // L'état d'abord, le résumé ensuite : un résumé présent désigne toujours un état complet.
    storage.setItem(SAVED_CAMPAIGN_KEY, simulation.exportSnapshot(0));
    storage.setItem(SAVED_CAMPAIGN_SUMMARY_KEY, JSON.stringify(summary));
    return true;
  } catch {
    // Stockage plein (navigation privée, quota) : on retire une éventuelle copie à moitié écrite.
    clearSavedCampaign(storage);
    return false;
  }
}

/** Résumé de la sauvegarde, ou `null` s'il n'y en a pas ou si elle vient d'une autre version de la carte. */
export function savedCampaignSummary(config, storage = globalThis.localStorage) {
  let summary;
  try { summary = JSON.parse(storage.getItem(SAVED_CAMPAIGN_SUMMARY_KEY) || 'null'); } catch { summary = null; }
  if (!summary || summary.format !== FORMAT || !SAVABLE_PHASES.includes(summary.phase) || typeof summary.candidate_id !== 'string') return null;
  if (summary.config_fingerprint !== configFingerprint(config)) return null;
  return summary;
}

/** État complet à donner à `GameSimulation.importSnapshot`, avec son résumé. Lance une erreur lisible sinon. */
export function loadSavedCampaign(config, storage = globalThis.localStorage) {
  const summary = savedCampaignSummary(config, storage);
  let json = null;
  try { json = storage.getItem(SAVED_CAMPAIGN_KEY); } catch { /* Stockage indisponible. */ }
  if (!summary || !json) throw new Error('Aucune partie sauvegardée à reprendre.');
  return { summary, json };
}

export function clearSavedCampaign(storage = globalThis.localStorage) {
  try { storage.removeItem(SAVED_CAMPAIGN_SUMMARY_KEY); storage.removeItem(SAVED_CAMPAIGN_KEY); } catch { /* Stockage indisponible. */ }
}
