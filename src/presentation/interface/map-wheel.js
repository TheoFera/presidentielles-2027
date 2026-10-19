import { wrap, zoneAt } from '../../simulation/world.js';
import { mapWheelAtlas, mapWheelIcons, mapWheelIconWidths } from './map-wheel-icons.js';

const NS = 'http://www.w3.org/2000/svg';
const CENTER = 160;
const INNER_RADIUS = 72, ICON_RADIUS = 104;
export const mapNeutralColor = '#a6aaa3';
// Anneau du sondage, juste à l'extérieur de la bordure (rayon 145).
const RING_RADIUS = 152, RING_GAP = 0.6, RING_SECONDS = 0.9;
// Mini-classement à gauche du cercle (jamais à droite : le cercle touche le bord droit de l'écran).
const point = (radius, angle) => [CENTER + radius * Math.sin(angle), CENTER - radius * Math.cos(angle)];
function element(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}
function arc(radius, start, end) {
  return `M${point(radius, start)} A${radius},${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${point(radius, end)}`;
}
function sector(start, end) {
  return `${arc(136, start, end)} L${point(INNER_RADIUS, end)} A${INNER_RADIUS},${INNER_RADIUS} 0 0 0 ${point(INNER_RADIUS, start)} Z`;
}

export class MapWheel {
  constructor(container) {
    this.container = container;
    this.sectors = new Map();
    this.layoutKey = '';
  }
  build(world) {
    if (this.layout && this.layout.length === world.subzones.length && world.subzones.every((z, i) => {
      const old = this.layout[i];
      return old[0] === z.id && old[1] === z.biome_id && old[2] === z.start && old[3] === z.end;
    })) return;
    this.layout = world.subzones.map(z => [z.id, z.biome_id, z.start, z.end]);
    const key = JSON.stringify(this.layout);
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.sectors.clear();
    // Trois calques superposés : fond (bordure, ombre), disque tournant, centre et repère du joueur.
    // Le disque tourne par une transformation CSS sur son propre calque : la carte graphique le fait
    // pivoter sans rien redessiner. Avant, chaque pas du joueur recalculait les 18 filtres des dessins
    // et repeignait tout le calque de l'interface (mesuré le 18/10/2026).
    const playerMark = 'M147 5H173L160 33Z';
    this.svg = element('svg', { viewBox: '0 0 320 320', role: 'img', class: 'map-wheel-back' });
    // Le fond porte aussi la silhouette du repère : l'ombre reste celle de la roue entière.
    this.svg.append(element('circle', { cx: 160, cy: 160, r: 145, class: 'map-rim' }), element('path', { d: playerMark, class: 'map-player' }));
    this.disc = element('svg', { viewBox: '0 0 320 320', class: 'map-wheel-disc', 'aria-hidden': 'true' });
    const definitions = element('defs');
    this.rotor = element('g', { class: 'map-rotor' });
    this.disc.append(definitions, this.rotor);
    const boundaries = element('g', { class: 'map-boundaries' });
    const biomes = new Map();
    for (const zone of world.subzones) {
      const start = zone.start / world.length * Math.PI * 2;
      const end = zone.end / world.length * Math.PI * 2;
      const path = element('path', { d: sector(start, end), fill: mapNeutralColor, class: 'map-sector', 'data-zone': zone.id });
      this.sectors.set(zone.id, path);
      this.rotor.append(path);
      const middle = (start + end) / 2;
      const [x, y] = point(ICON_RADIUS, middle);
      const icon = element('g', { class: 'map-icon', transform: `translate(${x} ${y}) rotate(${middle * 180 / Math.PI})`, 'data-icon': zone.id });
      const crop = mapWheelIcons[zone.id];
      if (crop) {
        const [left, top, width, height] = crop;
        // Même cadre maximal agrandi de 30 %, proportions naturelles conservées.
        // La silhouette entière garde 2,5 unités de marge aux séparations.
        const slope = Math.tan((end - start) / 2);
        const bands = mapWheelIconWidths[zone.id];
        let scale = Math.min(36.4 / width, 52 / height);
        for (let i = 0; i < bands.length; i++) {
          const innerY = height * ((i + 1) / bands.length - 0.5);
          const extent = bands[i] + innerY * slope;
          if (extent > 0) scale = Math.min(scale, Math.max(0, ICON_RADIUS * slope - 2.5) / extent);
        }
        const w = width * scale, h = height * scale;
        const clipId = `map-wheel-crop-${zone.id}`;
        const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
        // Le rectangle isole uniquement le symbole dans la planche transparente.
        clip.append(element('rect', { x: -w / 2, y: -h / 2, width: w, height: h }));
        definitions.append(clip);
        const artwork = element('g', { 'clip-path': `url(#${clipId})` });
        artwork.append(element('image', { href: mapWheelAtlas.file.href,
          x: -w / 2 - left * scale, y: -h / 2 - top * scale,
          width: mapWheelAtlas.width * scale, height: mapWheelAtlas.height * scale,
          'data-crop': crop.join(' ') }));
        icon.append(artwork);
      }
      this.rotor.append(icon);
      const firstInBiome = !biomes.has(zone.biome_id);
      boundaries.append(element('path', { d: `M${point(INNER_RADIUS, start)} L${point(firstInBiome ? 145 : 136, start)}`, class: firstInBiome ? 'map-biome-divider' : 'map-zone-divider' }));
      if (firstInBiome) biomes.set(zone.biome_id, { start, end });
      else biomes.get(zone.biome_id).end = end;
    }
    for (const [id, biome] of biomes) boundaries.append(element('path', {
      d: arc(141, biome.start + 0.025, biome.end - 0.025), class: 'map-biome-arc', 'data-biome': id,
    }));
    this.rotor.append(boundaries);
    const front = element('svg', { viewBox: '0 0 320 320', class: 'map-wheel-front', 'aria-hidden': 'true' });
    // Anneau du sondage : fixe (il ne tourne pas avec la carte), sous le repère du joueur.
    this.ring = element('g', { class: 'map-poll-ring' });
    front.append(element('circle', { cx: 160, cy: 160, r: 71.1, class: 'map-center' }),
      element('circle', { cx: 160, cy: 160, r: 64.8, class: 'map-center-line' }),
      this.ring, element('path', { d: playerMark, class: 'map-player' }));
    // Mini-classement en HTML (texte net à toute taille), reconstruit seulement à chaque sondage.
    this.ranking = document.createElement('ol');
    this.ranking.className = 'map-poll-ranking';
    this.container.replaceChildren(this.svg, this.disc, front, this.ranking);
    this.lastRotation = null;
    this.lastLabel = '';
  }
  updatePosition(world, x) {
    const rotation = -wrap(x, world.length) / world.length * 360;
    // Pas de transition CSS : 0° et 360° sont identiques, même au raccord du monde.
    if (rotation !== this.lastRotation) this.disc.style.transform = `rotate(${rotation}deg)`;
    this.lastRotation = rotation;
    const zone = zoneAt(world, x);
    const label = `Carte : ${zone.biome_name}, ${zone.concept}. Position du joueur en haut. 6 biomes, 18 sous-zones.`;
    if (label !== this.lastLabel) this.svg.setAttribute('aria-label', label);
    this.lastLabel = label;
  }
  updatePoll(snapshot, colors) {
    const zones = new Map(snapshot?.zones.map(z => [z.subzone_id, z.controller]) || []);
    for (const [id, path] of this.sectors) path.setAttribute('fill', colors[zones.get(id)] || mapNeutralColor);
  }
  /**
   * Dessine le sondage en parts autour du cercle, du plus haut score au plus bas, depuis le haut,
   * et un mini-classement à gauche : tous les candidats au-dessus de 0 %, et toujours votre ligne.
   * `shares` : [[faction, pourcentage entier]] déjà triés, `color(faction)` donne la couleur, `names` les noms.
   * Avec `animate`, l'anneau se trace d'un trait (environ une seconde) à l'arrivée d'un nouveau sondage.
   */
  updatePollRing(shares, color, player, animate, names = {}) {
    const parts = [];
    let start = 0;
    for (const [faction, value] of shares) {
      if (value <= 0) continue;
      const delay = start / 100 * RING_SECONDS, duration = value / 100 * RING_SECONDS;
      parts.push(element('circle', {
        cx: CENTER, cy: CENTER, r: RING_RADIUS, pathLength: 100, transform: `rotate(-90 ${CENTER} ${CENTER})`,
        class: faction === player ? 'map-poll-part map-poll-player' : 'map-poll-part', stroke: color(faction),
        'stroke-dasharray': `${Math.max(0.1, value - RING_GAP)} 100`, 'stroke-dashoffset': -start,
        style: `--delay:${delay.toFixed(2)}s;--duration:${duration.toFixed(2)}s`,
      }));
      start += value;
    }
    const rows = shares.map(([faction, value], rank) => ({ faction, value, rank }))
      .filter(row => row.value > 0 || row.faction === player);
    const lines = rows.map(({ faction, value, rank }) => {
      const line = document.createElement('li');
      line.className = faction === player ? 'map-poll-row map-poll-row-player' : 'map-poll-row';
      line.style.setProperty?.('--row', color(faction));
      const label = document.createElement('span'), score = document.createElement('b');
      label.textContent = `${rank + 1}. ${names[faction] || faction}`;
      score.textContent = `${value} %`;
      line.append(label, score);
      return line;
    });
    this.ring.classList.toggle('map-poll-animate', !!animate);
    this.ranking.classList.toggle('map-poll-animate', !!animate);
    this.ring.replaceChildren(...parts);
    this.ranking.replaceChildren(...lines);
  }
}
