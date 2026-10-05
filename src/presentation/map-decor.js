import { isBetatestProfile } from '../simulation/campaign-styles.js';
import { APP_BUILD } from '../app-build.js';

/**
 * Décor de la carte (affichage seulement : le gameplay, les positions et le zoom sont identiques).
 * - carte_plate : la fresque peinte d'un seul plan, en 18 tuiles (carte-plate.js), par défaut pour tout le monde ;
 * - panoramas : les panoramas peints world-v2 (assets/generated/world-v2) ;
 * - fresque : la fresque dessinée par le code (world-v3/fresque).
 * - france_peinte : nouvelles façades peintes, composées en cinq plans (france-peinte.js).
 * Seul le profil « betatest » peut choisir un autre décor que « carte_plate ».
 * L'ancien décor « biomes » est retiré : un choix enregistré « biomes » revient à la carte plate.
 * L'application mobile n'embarque que le décor par défaut (APP_BUILD).
 */
export const DEFAULT_MAP_DECOR = 'carte_plate';
const ALL_MAP_DECORS = [
  { id: 'carte_plate', label: 'Carte plate (par défaut)', note: 'Fresque peinte d’un seul plan, du café parisien aux beaux quartiers.' },
  { id: 'panoramas', label: 'Panoramas world-v2', note: 'Décor étendu, bâtiments à l’échelle et transitions peintes.' },
  { id: 'fresque', label: 'Fresque dessinée', note: 'Décor entièrement dessiné par le code.' },
  { id: 'france_peinte', label: 'France peinte', note: '18 quartiers peints, du café parisien au bord de mer.' },
];
export const MAP_DECORS = Object.freeze(APP_BUILD ? ALL_MAP_DECORS.filter(d => d.id === DEFAULT_MAP_DECOR) : ALL_MAP_DECORS);
const known = id => MAP_DECORS.some(d => d.id === id);

/** Décor à utiliser pour ce profil : son choix s'il est « betatest », sinon le décor par défaut. */
export function decorForProfile(profile) {
  return isBetatestProfile(profile) && known(profile?.map_decor) ? profile.map_decor : DEFAULT_MAP_DECOR;
}

// Pages d'outils : ?decor=carte_plate|france_peinte|fresque|panoramas ; « maquette » reste l'ancien nom de la fresque.
const urlDecor = (() => {
  if (typeof location === 'undefined') return null;
  const value = new URLSearchParams(location.search).get('decor');
  return value === 'maquette' ? 'fresque' : known(value) ? value : null;
})();

let current = urlDecor || DEFAULT_MAP_DECOR;
export const currentMapDecor = () => current;
/** Change le décor affiché (au lancement d'une partie). L'adresse de la page reste prioritaire pour les outils. */
export function setMapDecor(id) { current = urlDecor || (known(id) ? id : DEFAULT_MAP_DECOR); return current; }
