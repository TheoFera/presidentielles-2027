import * as periurbain from './periurbain.js';
import * as paris from './paris.js';
import * as banlieue from './banlieue.js';
import * as campagne from './campagne.js';
import * as littoral from './littoral.js';
import * as beaux from './beaux.js';
import * as sites from './sites.js';
import * as nature from './nature.js';
import * as lointain from './lointain.js';
import * as paysage from './paysage.js';
import * as perspective from './perspective.js';

/**
 * Planche d'essai : chaque élément de la fresque dessiné seul, à côté d'un personnage (81 px) pour vérifier
 * l'échelle et la qualité avant de le poser dans la carte. `w` en unités de jeu (1 unité = 40 px).
 */
export const CATALOGUE = {
  perspective: ['escalier', 'montmartre', 'saintdenis', 'defense'].map((kind, i) => ({ name: 'Rue en perspective : ' + kind, draw: perspective.ruePerspective, w: 4.2, p: { kind, seed: i + 1 } })),
  nature: ['platane', 'tilleul', 'chene', 'peuplier', 'pin'].flatMap((kind, i) => [0, 1, 2, 3].map(index => ({ name: kind + ' — saison ' + index, draw: (ctx) => nature.arbre(ctx, 210, kind, { index, blend: 0 }, i + 1), w: 3, p: {} }))),
  lointain: [
    { name: 'Toits de Paris', draw: lointain.toitsParis, w: 9, p: { seed: 1 } },
    { name: 'Cité au loin', draw: lointain.cite, w: 9, p: { seed: 2 } },
    { name: 'Zone d’activité', draw: lointain.zoneActivite, w: 9, p: { seed: 3 } },
    { name: 'Lignes à haute tension', draw: lointain.lignesHT, w: 9, p: { step: 300 } },
    { name: 'Village perché', draw: lointain.villagePerche, w: 9, p: { h: 200 } },
    { name: 'Lotissement au loin, château d’eau', draw: (ctx) => { lointain.lotissementLointain(ctx, { w: 300, seed: 1 }); ctx.save(); ctx.translate(130, 0); ctx.scale(0.8, 0.8); lointain.chateauDeau(ctx); ctx.restore(); }, w: 9, p: {} },
    { name: 'Tour Eiffel, Grand Palais, dôme', draw: (ctx) => { paysage.tourEiffel(ctx, { h: 380 }); ctx.save(); ctx.translate(-120, 0); paysage.grandPalais(ctx, { scale: 1 }); ctx.translate(250, 0); paysage.domeDore(ctx, { scale: 1.2 }); ctx.restore(); }, w: 9, p: {} },
    { name: 'La Défense', draw: paysage.laDefense, w: 9, p: { w: 320 } },
    { name: 'Sacré-Cœur, basilique, mosquée', draw: (ctx) => { ctx.save(); ctx.translate(-110, 0); paysage.sacreCoeur(ctx, { scale: 0.9 }); ctx.translate(150, 0); paysage.basilique(ctx, { scale: 1 }); ctx.translate(110, 0); paysage.mosquee(ctx, { scale: 0.8 }); ctx.restore(); }, w: 9, p: {} },
    { name: 'Métro aérien, passerelle, eau', draw: (ctx) => { paysage.eau(ctx, { w: 340, h: 16, quai: true }); paysage.metroAerien(ctx, { w: 340, h: 150, train: true }); lointain.passerelle(ctx, { w: 110, h: 90 }); }, w: 9, p: {} },
  ],
  sites: [
    { name: 'Permanence (Paris, haussmannien)', draw: sites.siteBuilding, w: 5, p: { type: 'permanence', style: 'haussmann', seed: 1 } },
    { name: 'Garage à vélos (Paris)', draw: sites.siteBuilding, w: 4.6, p: { type: 'garage_velo', style: 'faubourg', seed: 2 } },
    { name: 'Média associatif (pied de tour)', draw: sites.siteBuilding, w: 5.4, p: { type: 'tour_communication', style: 'tour', seed: 3, floors: 6 } },
    { name: 'Local du service d’ordre (banlieue)', draw: sites.siteBuilding, w: 4.4, p: { type: 'faction', style: 'brique', floors: 1, roof: 'plat', seed: 4 } },
    { name: 'Permanence (lotissement)', draw: sites.siteBuilding, w: 4.4, p: { type: 'permanence', style: 'crepi', seed: 5 } },
    { name: 'Garage à scooters (grange)', draw: sites.siteBuilding, w: 4.8, p: { type: 'garage_scooter', style: 'grange', seed: 6 } },
    { name: 'Institut de sondage (résidence de bord de mer)', draw: sites.siteBuilding, w: 4.6, p: { type: 'institut_sondage', style: 'residence', floors: 2, seed: 7 } },
    { name: 'Rédaction nationale (rotonde)', draw: sites.siteBuilding, w: 5.6, p: { type: 'tour_communication', style: 'rotonde', seed: 8 } },
  ],
  beaux: [
    { name: 'Haussmannien cossu, porte cochère', draw: beaux.haussmannCossu, w: 6, p: { seed: 1 } },
    { name: 'Haussmannien cossu, boutiques de luxe', draw: beaux.haussmannCossu, w: 6.5, p: { seed: 2, boutiques: ['mode', 'bijoux'] } },
    { name: 'Hôtel particulier', draw: beaux.hotelParticulier, w: 7, p: {} },
    { name: 'Start-up en rez-de-chaussée', draw: beaux.haussmannStartup, w: 5, p: { seed: 3 } },
    { name: 'Kiosque, berline', draw: (ctx) => { ctx.save(); ctx.translate(-80, 0); beaux.kiosque(ctx); ctx.translate(150, 0); beaux.berline(ctx); ctx.restore(); }, w: 7, p: {} },
    { name: 'Lisière du bois', draw: beaux.lisiereBois, w: 7, p: {} },
  ],
  littoral: [
    { name: 'Pavillon impeccable, nain de jardin', draw: littoral.pavillonImpeccable, w: 5, p: { seed: 1, gnome: true } },
    { name: 'Garage du quartier', draw: littoral.garageQuartier, w: 5, p: {} },
    { name: 'Boulodrome', draw: littoral.boulodrome, w: 6, p: {} },
    { name: 'Camping-car', draw: littoral.campingCar, w: 5, p: {} },
    { name: 'Résidence du front de mer', draw: littoral.residenceMer, w: 5.5, p: { seed: 2 } },
    { name: 'Villa balnéaire', draw: littoral.villaBalneaire, w: 5, p: {} },
    { name: 'Promenade et glacier', draw: (ctx) => { littoral.promenade(ctx, { w: 260 }); ctx.save(); ctx.translate(-20, 0); littoral.glacier(ctx); ctx.restore(); }, w: 7, p: {} },
    { name: 'Plage (fond proche)', draw: littoral.plage, w: 8, p: {} },
    { name: 'Villa en meulière', draw: littoral.villaMeuliere, w: 5.5, p: { seed: 3 } },
  ],
  campagne: [
    { name: 'Maison de village (volets ouverts)', draw: campagne.maisonVillage, w: 4.5, p: { seed: 1, vine: true, bench: true } },
    { name: 'Maison de village (volets clos)', draw: campagne.maisonVillage, w: 4.2, p: { seed: 2, closed: true } },
    { name: 'Mairie', draw: campagne.mairie, w: 5.5, p: {} },
    { name: 'Monument aux morts, calvaire, poteau', draw: (ctx) => { ctx.save(); ctx.translate(-80, 0); campagne.monumentMorts(ctx); ctx.translate(110, 0); campagne.calvaire(ctx); ctx.translate(70, 0); campagne.poteauBois(ctx); ctx.restore(); }, w: 6, p: {} },
    { name: 'Bar-tabac du village', draw: campagne.barTabac, w: 4.6, p: { seed: 3 } },
    { name: 'Commerce fermé', draw: campagne.commerceFerme, w: 3.8, p: { seed: 4 } },
    { name: 'Ferme', draw: campagne.ferme, w: 8, p: { seed: 5 } },
    { name: 'Serres-tunnels', draw: campagne.serres, w: 7, p: {} },
    { name: 'Hangar agricole', draw: campagne.hangar, w: 7, p: {} },
    { name: 'Pré, vaches, bottes', draw: campagne.pre, w: 8, p: { seed: 6, cows: 2, bales: 0.82 } },
    { name: 'Champ de blé et calvaire, haie bocagère', draw: (ctx) => { campagne.champ(ctx, { w: 200, calvaire: 0.3, seed: 2 }); ctx.save(); ctx.translate(120, 0); campagne.haieBocage(ctx, { w: 110, seed: 3 }); ctx.restore(); }, w: 8, p: {} },
    { name: 'Tracteur', draw: campagne.tracteur, w: 4, p: {} },
  ],
  banlieue: [
    { name: 'Tour de cité R+14 (sur sa pelouse)', draw: banlieue.tourCite, w: 5.4, p: { seed: 1 } },
    { name: 'Barre R+4', draw: banlieue.barre, w: 8, p: { seed: 2, halls: [-60, 80] } },
    { name: 'Immeuble R+3, boulangerie et kebab', draw: banlieue.immeubleBanlieue, w: 5, p: { seed: 3, shops: ['boulangerie', 'kebab'] } },
    { name: 'Immeuble R+3, hall', draw: banlieue.immeubleBanlieue, w: 4.5, p: { seed: 4 } },
    { name: 'Pelouse de cité et city-stade', draw: (ctx) => { ctx.save(); ctx.translate(-90, 0); banlieue.pelouseCite(ctx, { w: 120, seed: 1 }); ctx.translate(200, 0); banlieue.cityStade(ctx, { w: 200 }); ctx.restore(); }, w: 8, p: {} },
    { name: 'Pavillon modeste et fatigué', draw: banlieue.pavillonModeste, w: 4.2, p: { seed: 5 } },
    { name: 'Kebab du quartier, abribus', draw: (ctx) => { banlieue.snackQuartier(ctx, { w: 130, seed: 1 }); ctx.save(); ctx.translate(130, 0); banlieue.abribus(ctx); ctx.restore(); }, w: 6, p: {} },
    { name: 'Terrain vague, panneau 4x3', draw: (ctx) => { banlieue.terrainVague(ctx, { w: 220, seed: 1 }); ctx.save(); ctx.translate(40, 0); banlieue.panneau4x3(ctx, { seed: 2 }); ctx.restore(); }, w: 6, p: {} },
    { name: 'Camp de caravanes', draw: banlieue.caravanes, w: 7, p: { seed: 6 } },
  ],
  paris: [
    { name: 'Haussmannien R+2, boulangerie et boucherie', draw: paris.haussmann, w: 7, p: { seed: 1, floors: 2, shops: ['boulangerie', 'boucherie'] } },
    { name: 'Haussmannien R+3, porte cochère', draw: paris.haussmann, w: 6, p: { seed: 2, floors: 3 } },
    { name: 'Faubourg, café-terrasse et fleuriste', draw: paris.faubourg, w: 7, p: { seed: 3, floors: 2, shops: ['cafe', 'fleuriste'] } },
    { name: 'Faubourg, fromagerie', draw: paris.faubourg, w: 3.4, p: { seed: 4, floors: 2, shops: ['fromagerie'], color: '#efd9b5' } },
    { name: 'Faubourg, librairie et épicerie fine', draw: paris.faubourg, w: 6, p: { seed: 5, floors: 2, shops: ['librairie', 'epicerie'] } },
    { name: 'Faubourg, tabac et pharmacie', draw: paris.faubourg, w: 6, p: { seed: 6, floors: 2, shops: ['tabac', 'pharmacie'] } },
    { name: 'Marché', draw: paris.marche, w: 6.5, p: { seed: 7 } },
    { name: 'Escalier, quai, vélos, fontaine', draw: (ctx, p) => { ctx.save(); ctx.translate(-120, 0); paris.escalier(ctx, { w: 56 }); ctx.translate(100, 0); paris.quai(ctx, { w: 110 }); ctx.translate(120, 0); paris.veloParking(ctx, { w: 80 }); ctx.translate(70, 0); paris.fontaineWallace(ctx); ctx.restore(); }, w: 8, p: {} },
  ],
  periurbain: [
    { name: 'Maison de lotissement (photo)', draw: periurbain.maisonLotissement, w: 7, p: { seed: 1 } },
    { name: 'Maison de lotissement, en miroir', draw: periurbain.maisonLotissement, w: 7, p: { seed: 2, mirror: true } },
    { name: 'Jardin : barbecue et trampoline', draw: periurbain.jardinLotissement, w: 3.4, p: { seed: 3, items: [{ t: 'barbecue', at: 0.25 }, { t: 'trampoline', at: 0.7 }] } },
    { name: 'Voiture citadine', draw: periurbain.voiture, w: 3.6, p: { seed: 4 } },
    { name: 'Break familial', draw: periurbain.voiture, w: 4, p: { seed: 8, kind: 'break', color: '#2f3e57' } },
    { name: 'Maisons de brique', draw: periurbain.maisonsBrique, w: 6.5, p: { seed: 5 } },
    { name: 'Grande surface', draw: periurbain.grandeSurface, w: 7, p: { seed: 6 } },
    { name: 'Usine de vallée', draw: periurbain.usine, w: 5.5, p: { seed: 7 } },
  ],
};
