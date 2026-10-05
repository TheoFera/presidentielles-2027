import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('docs/production/decor-v3/carte-plate');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const full=read('tuiles/controle-raccords/rapport.json'),pilot=read('pilote/tuiles/controle-raccords/rapport.json'),audit=read('audit-livraison.json'),cal=read('production/controle-geometrie/rapport-calage-carte.json'),logs=read('production/sorties-revision.json'),visuel=read('production/controle-visuel-raccords/inspection.json');
if(full.erreurs.length||pilot.erreurs.length||audit.pixelsTransparents||audit.pixelsBandeSuperieureNonConformes||visuel.raccords.length!==18||visuel.sha256Maitre!==audit.maitres[0].sha256)throw new Error('Livraison non vérifiée.');
const names=['Paris A','Paris B','Paris C','Banlieue A','Banlieue B','Banlieue C','Périurbain A','Périurbain B','Périurbain C','Campagne A','Campagne B','Campagne C','Retraités A','Retraités B','Retraités C','Riches A','Riches B','Riches C'];
const slugs=['paris-a','paris-b','paris-c','banlieue-a','banlieue-b','banlieue-c','periurbain-a','periurbain-b','periurbain-c','campagne-a','campagne-b','campagne-c','retraites-a','retraites-b','retraites-c','riches-a','riches-b','riches-c'];
const notes=[
 'Café, immeubles proches et escalier. Entrée à x = 1294. Raccord avec Riches C contrôlé.',
 'Une seule boulangerie, fromagerie et boucherie ; vélo dans l’atelier. Angle de la boucherie complet.',
 'Pierre ancienne et institut en brique distincts. Canal derrière le muret, Grands Moulins secondaires ; transition avant la coupe.',
 'Tours Nuages complètes, tours rectangulaires variées. Arbres, silhouettes, murets et bordures repris.',
 'Basilique secondaire et marché autour d’une place proche du bâti.',
 'Pavillons, cité, mosquée, terrain et caravanes derrière la clôture.',
 'Rangée French Dream semblable autorisée ; barbecue et supermarché secondaire avec pictogramme de panier.',
 'Large atelier naturel, scooter bleu intérieur. Rond-point, collines progressives vers la montagne.',
 'Mont-Blanc, usines, vaches ; versants raccordés à la colline précédente.',
 'Grange à portail ouvert, scooter crème, établi et outils intérieurs. Serres, pylônes, château d’eau.',
 'Mairie, drapeaux, église, monument, école, préau, tableau vierge, marelle sans chiffres et cour. Maison de fin avec angle et toit complets.',
 'Champs, silo, monument, boulodrome, village et train lointain ; passage vers le bar-tabac repris.',
 'Pavillons et bar-tabac ; bordure vers le quartier balnéaire reprise.',
 'Villa à toit pentu et Art déco à toit plat distincts. Petite promenade, mer, palmiers, pharmacie et bateaux lointains.',
 'Villa en meulière, maison du gardien, bois de Boulogne ; arbre et grille vers le parc repris.',
 'Maison de la Radio petite et secondaire parmi les toits ; bâti urbain proche.',
 'Petite tour Eiffel derrière les façades, vitrines différentes et kiosque. Devanture complète restaurée depuis la source avant calage ; grande vitrine et panneau naturel retrouvés.',
 'Cabinet à bibliothèque et mobilier en bois ; institut à paillasse blanche. Grandes baies et panneaux naturels restaurés depuis les générations originales. Pierre et brique Art nouveau distinctes. La Défense secondaire ; boucle vers Paris A vérifiée.'
];
const num=i=>String(i+1).padStart(2,'0');
const rows=names.map((name,i)=>'| ['+num(i)+' '+name+'](tuiles/tuile-'+num(i)+'-'+slugs[i]+'.png) | ☑ | ☑ | ☑ | ☑ | '+([1,4,7,10,13,16].includes(i)?'☑':'—')+' | ☑ | ☑ | ☑ | ☑ | ☑ |');
const fence=String.fromCharCode(96).repeat(3);
const report=[
 '# Carte plate — livraison des 18 sous-zones','',
 'Fresque opaque de **34 560 × 1 080 px**, **18 tuiles de 1 920 × 1 080 px** et pilote Paris de **5 760 × 1 080 px** livrés. Les deux vérificateurs officiels se terminent par **« Aucun défaut détecté »**.','',
 '**Les 18 raccords ont aussi été inspectés à taille réelle**, dans des vues de 800 × 1 080 px, avec 400 pixels de chaque côté. La fermeture Riches C → Paris A est comprise. Les coupures de silhouettes, de toitures, de murets et les principales marches de bordure ont été reprises. Aucune coupure franche restante n’a été repérée aux 18 jonctions. [Inspection datée liée à l’empreinte du maître](production/controle-visuel-raccords/inspection.json).','',
 'Les gabarits sont des repères : ouvertures adaptées à l’architecture et petites places de meeting proches du bâti. Vélo et scooters visibles à l’intérieur des garages. Voitures exclues du premier plan ; train, bateaux lointains et caravanes derrière une clôture conservés. [Précisions utilisateur](DIRECTIVES-UTILISATEUR.md).','',
 '## Fichiers produits','',
 '- [Maître complet](fresque-plate-maitre.png) et [copie des assets](../../../../assets/generated/masters/fresque-plate-maitre.png), identiques.',
 '- [Pilote Paris](pilote/fresque-plate-maitre.png) et [ses trois tuiles](pilote/tuiles/).',
 '- Les 18 tuiles sont nommées et liées dans la liste de contrôle.',
 '- [Aperçu numéroté](vue-carte-complete.png), [18 vues d’échelle](production/vue-18-tuiles.png), [18 vues natives des raccords](production/controle-visuel-raccords/).',
 '- [Audit](audit-livraison.json), [vérification complète](verification-complete.txt), [vérification pilote](verification-pilote.txt).',
 '- [Calage des entrées](production/controle-geometrie/rapport-calage-carte.json), [21 entrées en vues natives](production/controle-geometrie/index-entrees.json), [six places recadrées](production/controle-meetings/).',
 '- [Prompts et sources des 20 reprises de raccord](production/revision-raccords-finitions.json), [supermarché, école, vitrine et cabinet](production/revision-finitions-finales.json).',
 '- [Historique](production/revisions-composition.json), [extensions initiales](production/generations.json), [restaurations et scooters](production/revision-direction-artistique.json), [intermédiaires et variantes](production/retouches/).','',
 'Les silhouettes et repères de contrôle ne figurent pas dans les tuiles livrées. Cette livraison porte sur les images ; elle ne certifie pas leur intégration au moteur.','',
 '## Résultats officiels','',
 'Carte complète :','',fence+'text',logs.complete.trim(),fence,'',
 'Pilote Paris :','',fence+'text',logs.pilote.trim(),fence,'',
 'Les 15 tuiles absentes du contrôle du pilote sont présentes dans l’export complet.','',
 '**0 pixel transparent ; 0 pixel incorrect dans les 64 lignes du haut** (#9FCFEE). Maîtres complets de même empreinte SHA-256. '+audit.nombreRetouches+' retouches avec contrôle des pixels extérieurs au moment de leur application. Aucun fondu, transparence ou mélange de deux images.','',
 cal.rectangles.length+' cellules d’entrée/panneau restent au calage exact ; '+cal.rectanglesNonCales.length+' ont des proportions naturelles suivant les précisions utilisateur. Vitrines complètes et panneaux de Riches B/C restaurés : le texte du jeu suit ces panneaux. [Sources et contrôle de restauration](production/restauration-vitrines-riches.json). Panneaux crème vierges ; silhouettes de 162 px avec pieds à y = 1 004.','',
 '## Passage des personnages','',
 'La première passe a retiré des poteaux et reculé quelques pieds d’arbres dans 10 tuiles, mais les captures utilisateur ont révélé des obstacles oubliés. La seconde passe retire le massif de l’îlot de Périurbain B, les pots devant la vitrine de Retraités B et la jardinière débordante entre Riches A et B ; le kiosque de Riches B, ses deux présentoirs et son petit lampadaire sont reculés. La ligne de marche à y = 1 004 et les trois grandes vitrines restaurées de Riches B/C sont conservées au pixel près. Les 18 images utilisées par le jeu sont synchronisées. [Première passe](production/nettoyage-passage.json), [sources, prompts et contrôle de la seconde passe](production/recul-obstacles.json).','',
 'Les panneaux des trois devantures restaurées sont contrôlés dans leurs images réelles, à plusieurs zooms et sur la boucle de la carte. Les 8 tests ciblés passent.','',
 'Une reprise complémentaire retire le pot jaune oublié à gauche de Retraités B et corrige le socle de la permanence de Riches B. La vitrine de Riches B garde ses pixels d’origine au-dessus de y = 1 004 ; seuls le socle et le pavage en dessous sont redessinés. Les deux vitrines restaurées de Riches C restent intégralement identiques. Les raccords 13→14 et 16→17 sont réinspectés ; les 16 autres sont inchangés par cette reprise. [Sources, prompts et contrôle de la reprise](production/correction-pot-socle.json).','',
 '## Liste de contrôle du chapitre 16','',
 '☑ : critère contrôlé et retenu ; — : sans objet. Ouvertures, meeting et véhicules suivent les précisions utilisateur. Les deux côtés de chaque tuile et la boucle sont contrôlés. Cette appréciation ne promet pas une perfection artistique absolue.','',
 '| Tuile | Format opaque | Sol y = 1 004 | Échelle 162 px | Portes/panneaux | Meeting | Raccords sans fondu | Sans texte | Véhicules conformes | Ciel/lumière | Storyboard |',
 '|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|',...rows,'',
 '## Éléments vérifiés par sous-zone','',
 '| Tuile | Observation |','|---|---|',...notes.map((note,i)=>'| '+num(i)+' | '+note+' |'),'',
 '## Petits défauts et limites restant visibles','',
 ...visuel.limites.map(note=>'- '+note),
 '- Les grandes marches rectangulaires ont été reprises. Le résultat n’est pas présenté comme un 10/10 absolu.','',
 '## Méthode','',
 'ImageGen intégré avec une référence world-v2 jointe à chaque génération. L’outil ne garantit pas les coordonnées ou les pixels fixes. La méthode technique acceptée conserve les pixels antérieurs dans les scripts, avec 256 px de contexte pour les extensions de gauche à droite. Les corrections sont dessinées par inpainting puis copiées dans le seul rectangle sélectionné, avec opacité complète et comparaison des pixels extérieurs. Certaines sources sont normalisées par redimensionnement ou recadrage ; les variantes mal cadrées sont conservées et rejetées. Aucun fondu ni superposition.','',
 'production.mjs assemble ; finition.mjs prépare et contrôle les retouches ; calibrage-ciel.mjs fixe le ciel opaque ; livraison.mjs exporte ; verifier-livraison.mjs découpe et vérifie ; inspecter-raccords-visuels.mjs produit les 18 vues élargies. Aucune dépendance installée.',''
].join('\n');
fs.writeFileSync(path.join(base,'BILAN-PRODUCTION.md'),report);
console.log('Bilan final écrit : 18 listes de contrôle, vérifications officielles et petits défauts signalés.');

