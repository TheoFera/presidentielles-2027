import { wrap, zoneAt } from '../../simulation/world.js';
import { mapWheelAtlas, mapWheelIcons } from './map-wheel-icons.js';

const NS = 'http://www.w3.org/2000/svg';
const CENTER = 160;
export const mapNeutralColor = '#a6aaa3';
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
  return `${arc(136, start, end)} L${point(80, end)} A80,80 0 0 0 ${point(80, start)} Z`;
}

function atlasFilter() {
  // Seul le gris moyen de la planche devient transparent ; les pixels des
  // dessins d'origine (encre et crème) gardent leur couleur, sans redessin.
  const filter = element('filter', { id: 'map-wheel-cutout', filterUnits: 'userSpaceOnUse',
    x: -15, y: -21, width: 30, height: 42, 'color-interpolation-filters': 'sRGB' });
  filter.append(element('feColorMatrix', { type: 'matrix',
    values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  .2126 .7152 .0722 0 0' }));
  const transfer = element('feComponentTransfer', { result: 'cutout' });
  transfer.append(element('feFuncA', { type: 'table', tableValues: '1 1 1 1 0 0 0 0 0 1 1' }));
  filter.append(transfer);
  filter.append(element('feComposite', { in: 'SourceGraphic', in2: 'cutout', operator: 'in' }));
  return filter;
}

export class MapWheel {
  constructor(container) {
    this.container = container;
    this.sectors = new Map();
    this.layoutKey = '';
  }
  build(world) {
    const key = JSON.stringify(world.subzones.map(z => [z.id, z.biome_id, z.start, z.end]));
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.sectors.clear();
    this.svg = element('svg', { viewBox: '0 0 320 320', role: 'img' });
    const definitions = element('defs');
    definitions.append(atlasFilter());
    this.svg.append(definitions);
    this.rotor = element('g', { class: 'map-rotor' });
    this.svg.append(element('circle', { cx: 160, cy: 160, r: 145, class: 'map-rim' }), this.rotor);
    const boundaries = element('g', { class: 'map-boundaries' });
    const biomes = new Map();
    for (const zone of world.subzones) {
      const start = zone.start / world.length * Math.PI * 2;
      const end = zone.end / world.length * Math.PI * 2;
      const path = element('path', { d: sector(start, end), fill: mapNeutralColor, class: 'map-sector', 'data-zone': zone.id });
      this.sectors.set(zone.id, path);
      this.rotor.append(path);
      const middle = (start + end) / 2;
      const [x, y] = point(108, middle);
      const icon = element('g', { class: 'map-icon', transform: `translate(${x} ${y}) rotate(${middle * 180 / Math.PI})`, 'data-icon': zone.id });
      const crop = mapWheelIcons[zone.id];
      if (crop) {
        const [left, top, width, height] = crop;
        // Taille maximale commune et proportions d'origine conservées.
        const scale = Math.min(28 / width, 40 / height);
        const w = width * scale, h = height * scale;
        const clipId = `map-wheel-crop-${zone.id}`;
        const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
        clip.append(element('rect', { x: -w / 2, y: -h / 2, width: w, height: h }));
        definitions.append(clip);
        const artwork = element('g', { 'clip-path': `url(#${clipId})` });
        artwork.append(element('image', { href: mapWheelAtlas.file.href,
          x: -w / 2 - left * scale, y: -h / 2 - top * scale,
          width: mapWheelAtlas.width * scale, height: mapWheelAtlas.height * scale,
          filter: 'url(#map-wheel-cutout)', 'data-crop': crop.join(' ') }));
        icon.append(artwork);
      }
      this.rotor.append(icon);
      const firstInBiome = !biomes.has(zone.biome_id);
      boundaries.append(element('path', { d: `M${point(80, start)} L${point(firstInBiome ? 145 : 136, start)}`, class: firstInBiome ? 'map-biome-divider' : 'map-zone-divider' }));
      if (firstInBiome) biomes.set(zone.biome_id, { start, end });
      else biomes.get(zone.biome_id).end = end;
    }
    for (const [id, biome] of biomes) boundaries.append(element('path', {
      d: arc(141, biome.start + 0.025, biome.end - 0.025), class: 'map-biome-arc', 'data-biome': id,
    }));
    this.rotor.append(boundaries);
    this.svg.append(element('circle', { cx: 160, cy: 160, r: 79, class: 'map-center' }),
      element('circle', { cx: 160, cy: 160, r: 72, class: 'map-center-line' }),
      element('path', { d: 'M147 5H173L160 33Z', class: 'map-player' }));
    this.container.replaceChildren(this.svg);
    this.lastRotation = null;
    this.lastLabel = '';
  }
  updatePosition(world, x) {
    const rotation = -wrap(x, world.length) / world.length * 360;
    // Pas de transition CSS : 0° et 360° sont identiques, même au raccord du monde.
    if (rotation !== this.lastRotation) this.rotor.setAttribute('transform', `rotate(${rotation} 160 160)`);
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
}
