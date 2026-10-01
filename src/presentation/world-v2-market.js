import { ringDelta } from '../simulation/world.js';

/** Pilote peint : une rue cohérente et un fond continu, sans assemblage de façades. */
export const MARKET_CALIBRATION = {
  width: 2172, height: 724,
  door: { x: 473, y: 572, height: 140 },
  sign: { x: 344, y: 368, width: 280, height: 35 },
};

/** Projection linéaire : tous les points du fond conservent exactement la même vitesse. */
export function marketBackgroundX(metrics, camera, zone, length, speed = 0.35) {
  return metrics.anchorX + ringDelta(camera, zone.center, length) * metrics.pixelsPerUnit * speed;
}

/** Échelle uniforme pilotée par la porte, ancrée sur le site du jeu. */
export function marketStreetFrame(metrics, camera, world, site, image, calibration = MARKET_CALIBRATION) {
  const factor = image.naturalWidth / calibration.width;
  const scale = metrics.characterHeight * 1.15 / (calibration.door.height * factor);
  const x = metrics.anchorX + ringDelta(camera, site.x, world.length) * metrics.pixelsPerUnit;
  const base = metrics.groundY - 12 * metrics.characterHeight / 81;
  const left = x - calibration.door.x * factor * scale;
  const top = base - calibration.door.y * factor * scale;
  const sign = calibration.sign;
  return { left, top, width: image.naturalWidth * scale, height: image.naturalHeight * scale,
    scale, doorX: x, doorHeight: calibration.door.height * factor * scale,
    sign: { x: left + (sign.x + sign.width / 2) * factor * scale,
      y: top + (sign.y + sign.height / 2) * factor * scale,
      w: sign.width * factor * scale, h: sign.height * factor * scale } };
}

export function drawMarketPilot(renderer, state, tools, layer) {
  const street = renderer.assets.get('world2-market-street'), background = renderer.assets.get('world2-market-background');
  const zone = state.world.subzones.find(z => z.id === 'banlieue_b');
  const site = state.buildings.find(b => b.site_id === 'site:banlieue_b');
  if (!street || !background || !zone || !site) return false;
  const { ctx, metrics: m } = renderer, u = m.characterHeight / 81;
  const left = m.anchorX + ringDelta(renderer.cameraX, zone.center, state.world.length) * m.pixelsPerUnit - zone.width * m.pixelsPerUnit / 2;
  const width = zone.width * m.pixelsPerUnit, view = renderer.visibleWorld || { left: 0, right: renderer.width };
  const streetFrame = marketStreetFrame(m, renderer.cameraX, state.world, site, street);
  if (layer === 'street') renderer.worldV2Sites.set(site.site_id, streetFrame.sign);
  const frameLeft = layer === 'street' ? streetFrame.left : left;
  const frameWidth = layer === 'street' ? streetFrame.width : width;
  if (frameLeft > view.right || frameLeft + frameWidth < view.left) return true;
  ctx.save();
  if (layer === 'far') {
    // Le monument reste dans sa sous-zone. La rue, elle, se termine par les contours peints,
    // avec un chevauchement naturel sur les rues voisines : aucune façade coupée au bord du masque.
    ctx.beginPath(); ctx.rect(left, -renderer.height, width, renderer.height * 3); ctx.clip();
    const backgroundScale = m.characterHeight * 4.5 / background.naturalHeight;
    const backX = marketBackgroundX(m, renderer.cameraX, zone, state.world.length);
    const backY = m.groundY - 46 * u - background.naturalHeight * backgroundScale;
    ctx.filter = tools.seasonFilter('far');
    ctx.drawImage(background, backX - background.naturalWidth * backgroundScale / 2, backY,
      background.naturalWidth * backgroundScale, background.naturalHeight * backgroundScale);
  } else if (layer === 'street') {
    ctx.filter = tools.seasonFilter('street');
    ctx.drawImage(street, streetFrame.left, streetFrame.top, streetFrame.width, streetFrame.height);
    if (tools.snow > 0.02) {
      ctx.save(); ctx.globalAlpha = tools.snow;
      ctx.drawImage(tools.snowCap(street), streetFrame.left, streetFrame.top, streetFrame.width, streetFrame.height);
      ctx.restore();
    }
  }
  ctx.restore();
  return true;
}
