import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('docs/production/decor-v3/carte-plate');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file)));
const full=read('tuiles/controle-raccords/rapport.json'),pilot=read('pilote/tuiles/controle-raccords/rapport.json'),audit=read('audit-livraison.json'),cal=read('production/controle-geometrie/rapport-calage-carte.json'),logs=read('production/sorties-revision.json');
if(full.erreurs.length||pilot.erreurs.length||audit.pixelsTransparents||audit.pixelsBandeSuperieureNonConformes)throw new Error('Export non vérifié.');
const names=['Paris A','Paris B','Paris C','Banlieue A','Banlieue B','Banlieue C','Périurbain A','Périurbain B','Périurbain C','Campagne A','Campagne B','Campagne C','Retraités A','Retraités B','Retraités C','Riches A','Riches B','Riches C'];
const notes=[
 'Entrée calée à x = 1294. Sol sur toute la largeur et limites du rez-de-chaussée restant à certifier.',
 'Entrée calée à x = 444 ; vélos et outils en vitrine. Premier plan central dégagé ; fond compact, Sacré-Cœur réduit. Ruptures locales de pavage encore perceptibles.',
 'Deux entrées calées à x = 458 et 1425 ; leurs panneaux sont désormais mesurés aussi. Architecture ancienne en pierre et institut moderne en brique distincts. Canal derrière le muret, Grands Moulins secondaires.',
 'Entrée calée à x = 721. Tours Nuages avec sommet complet, tours rectangulaires plus courtes et distinctes, barre basse vers les pavillons. Sol et raccords visuels à finir.',
 'Basilique réduite, bâti rapproché. Marché autour d’une petite place ; les étals proches participent à la composition et ne sont plus à retirer pour respecter une bande vide.',
 'Entrée désormais calée à x = 838. Pavillons, cités, mosquée et caravanes derrière la clôture présents.',
 'Entrée désormais calée à x = 1101. Barbecue visible dans un jardin. Supermarché insuffisamment identifiable, limite de retouche perceptible. Rangée de maisons semblables autorisée pour le French Dream.',
 'Ouverture naturelle de l’atelier rétablie : vitrine de travail large, porte latérale étroite et enseigne à la largeur de la façade. Scooter bleu à l’intérieur, devant l’établi et les outils. Rond-point conservé. Progression alpine encore trop concentrée autour de 08 → 09.',
 'Entrée désormais calée à x = 937. Mont-Blanc, usines et vaches présents.',
 'Large portail naturel de la grange ouvert sur un scooter crème, un établi et des outils à l’intérieur. Serres, pylônes et château d’eau présents ; fonction garage lisible.',
 'Mairie, drapeaux, église et monument autour d’une petite place de village. École/préau/cour insuffisamment lisibles.',
 'Entrée désormais calée à x = 689. Champs, silo, monument, boulodrome, village et petit train lointain présents.',
 'Entrée désormais calée à x = 1256. Pavillons et bar-tabac présents.',
 'Villa balnéaire à toit pentu et bâtiment Art déco saumon distincts. Mer, petits bateaux et pharmacie présents. Composition précédente rétablie avec petite promenade, palmiers et mobilier ; la variante très ouverte est annulée.',
 'Petite maison du gardien déplacée et entrée calée à x = 1273. Bande de maçonnerie repeinte, panneau désormais à y = 764. Villas, petit bateau et bois de Boulogne conservés.',
 'Entrée désormais calée à x = 1045. Maison de la Radio petite et secondaire parmi les toits ; profondeur urbaine compacte.',
 'Vitrine gauche et maçonnerie reprises. Petite tour Eiffel derrière trois façades distinctes ; façades proches autour de la place. Petite trace sombre au-dessus de la vitrine à finir.',
 'Deux entrées désormais calées à x = 433 et 1087. Cabinet avec bibliothèque et mobilier en bois ; institut avec paillasse blanche et graphiques. RDC différents, façades pierre et brique Art nouveau distinctes. Porte du cabinet vitrée : caractère blindé demandé par le cahier encore à rendre. La Défense et Grande Arche secondaires au fond.'
];
const num=i=>String(i+1).padStart(2,'0');
const rows=names.map((name,i)=>{
 const meeting=[1,4,7,10,13,16].includes(i)?'☑':'—',story=[6,10,17].includes(i)?'☐':'☑';
 return `| ${num(i)} ${name} | ☑ | ☐ | ☑ | ☑ | ${meeting} | ☐ | ☑ | ☑ | ☐ | ${story} |`;
});
const fence=String.fromCharCode(96).repeat(3);
const report=[
 '# Carte plate — état de la livraison des 18 sous-zones','',
 'Les **18 tuiles sont peintes et réexportées**, dans une fresque opaque de **34 560 × 1 080 px**. Le pilote Paris fait **5 760 × 1 080 px**. Les vérificateurs officiels passent pour les deux exports.','',
 '**Direction artistique précisée par l’utilisateur : les gabarits sont des repères, les ouvertures s’adaptent aux bâtiments et une sous-zone de meeting n’impose pas une grande place vide.** Les petites places et la proximité de world-v2 sont préférées lorsque la scène s’y prête. [Précisions faisant référence](DIRECTIVES-UTILISATEUR.md).','',
 `Le précédent contrôle des 42 rectangles exacts est [archivé](production/controle-geometrie/rapport-calage-avant-directives.json). ${cal.rectangles.length} rectangles restent à ces dimensions après les restaurations artistiques ; ce nombre est une information technique et ne définit plus la réussite de la carte. Les ouvertures de Périurbain B et Campagne A ont retrouvé leurs proportions naturelles.`,'',
 '**La finition intégrale n’est pas encore atteinte.** Les contrôles officiels ne prouvent pas la perfection de chaque raccord interne ni la présence de tous les détails du storyboard. Les cases ouvertes ci-dessous désignent le travail restant.','',
 '## Corrections de composition et de géométrie','',
 '- Voitures exclues du premier plan selon la précision utilisateur. Vélos d’atelier, caravanes derrière une clôture, train et bateaux lointains conservés.',
 '- Profondeur urbaine rapprochée ; paysages ruraux, montagne et mer plus ouverts. Sacré-Cœur, basilique, Maison de la Radio, tour Eiffel et tours de Banlieue A rééquilibrés comme repères secondaires.',
 '- Façades différentes à Paris C, Retraités B et Riches C. Les deux bureaux identiques de Riches C ont été remplacés par des intérieurs différents. Seule la rangée French Dream de Périurbain A conserve des maisons similaires.',
 '- Les frises, pierres et vitrines étirées par le redimensionnement ont été repeintes par petites bandes. Les proportions des bâtiments priment désormais sur la reproduction exacte des rectangles. Ouverture d’atelier et grande porte de grange restaurées ; composition de Retraités B rétablie. Sources, profils et variantes conservés.','',
 '## Fichiers produits','',
 '- [Maître livré](fresque-plate-maitre.png) et [copie des assets](../../../../assets/generated/masters/fresque-plate-maitre.png), identiques.',
 '- [18 tuiles](tuiles/), [aperçu numéroté](vue-carte-complete.png), [planche avec silhouettes de 162 px](production/vue-18-tuiles.png).',
 '- [Pilote Paris](pilote/fresque-plate-maitre.png) et [ses trois tuiles](pilote/tuiles/).',
 '- [Audit](audit-livraison.json), [vérification complète](verification-complete.txt), [vérification pilote](verification-pilote.txt).',
 '- [Mesures techniques courantes](production/controle-geometrie/rapport-calage-carte.json), [21 vues natives d’entrées](production/controle-geometrie/index-entrees.json), [six places recadrées](production/controle-meetings/).',
 '- [Prompts des dernières générations](production/revision-geometrie-suite.json), [historique de composition](production/revisions-composition.json), [extensions initiales](production/generations.json) et [intermédiaires de retouche](production/retouches/).','',
 '- [Prompts des scooters, restaurations et variantes abandonnées](production/revision-direction-artistique.json).','',
 'Les silhouettes et repères de contrôle restent hors des tuiles du jeu. Les images sont livrées mais ne sont pas encore branchées au moteur.','',
 '## Résultats réels des commandes officielles','',
 'Carte complète :','',fence+'text',logs.complete.trim(),fence,'',
 'Pilote Paris :','',fence+'text',logs.pilote.trim(),fence,'',
 'Les 15 tuiles absentes du contrôle du pilote sont toutes présentes dans l’export complet.','',
 `Audit : **0 pixel transparent**, **0 pixel incorrect dans les 64 lignes du haut** (#9FCFEE). Copies du maître de même empreinte SHA-256. ${audit.nombreRetouches} retouches actives avec conservation mesurée des pixels extérieurs au moment de leur application.`,'',
 '## Liste de contrôle du chapitre 16','',
 '**☑ : vérifié selon les précisions actuelles ; ☐ : imparfait ou restant à certifier ; — : sans objet.** Échelle : silhouette de 162 px devant l’entrée ; dimensions des ouvertures adaptées à leur architecture. Portes/panneaux : placement cohérent avec les repères et panneau vierge. Meeting : petite place utilisable dans la composition, sans obligation d’une bande de 576 px vide.','',
 '| Tuile | Format opaque | Sol | Échelle | Portes et panneaux adaptés | Place de meeting | Raccords parfaits | Texte | Voitures | Ciel et lumière | Storyboard |',
 '|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|',...rows,'',
 '« Voitures » reprend la clarification utilisateur : aucun véhicule au premier plan, avec vélos d’atelier et transports lointains admis. Aucun texte ou marque lisible repéré. Bande supérieure du ciel exacte ; dégradé opaque, contours et ombres à affiner. Sol : l’alignement de toutes les façades et du sol n’est pas encore certifié. Le mobilier et les façades proches d’une petite place ne sont plus considérés comme des défauts du seul fait de leur présence dans l’ancienne bande de meeting.','',
 '## Défauts et limites encore visibles','',
 '| Tuile | Observation |','|---|---|',...notes.map((note,i)=>`| ${num(i)} | ${note} |`),'',
 'Des ruptures de pavage, de bordure ou de contours restent à certaines limites de bandes repeintes, notamment près de 03 → 04, 04 → 05, 07 → 08, 08 → 09, 12 → 13, 14 → 15 et 18 → 01. Elles peuvent être à distance de la coupe testée. Le calibrage du ciel laisse certains contours irréguliers. La montagne doit progresser davantage sur environ trois sous-zones. Les prochaines reprises doivent améliorer ces raccords et détails locaux, sans agrandir ou vider systématiquement les places.','',
 '## Méthode','',
 'ImageGen intégré, avec une image world-v2 jointe à chaque génération. L’outil ne garantit pas les coordonnées ni les pixels fixes. La méthode technique acceptée conserve les pixels antérieurs dans les scripts et copie seulement les nouveaux morceaux opaques ou bandes de retouche. Extensions de gauche à droite avec 256 px de contexte ; normalisation par redimensionnement et recadrage ; calage de cellules adjacentes sans superposition. Les limites de maçonnerie étirées sont repeintes. Aucun fondu, aucun mélange de deux images, aucune transparence.','',
 'production.mjs assemble les extensions ; finition.mjs vérifie les pixels extérieurs ; calibrer-rdc.mjs cale les cellules ; integrer-bande-source.mjs protège les rectangles calés durant les retouches de maçonnerie ; controler-calage-carte.mjs compare les cellules au maître ; livraison.mjs exporte ; verifier-livraison.mjs relance la découpe et les vérifications officielles. Node et Sharp déjà disponibles, aucune dépendance installée.',''
 ].join('\n');
fs.writeFileSync(path.join(base,'BILAN-PRODUCTION.md'),report);
console.log('Bilan actualisé : 18 listes de contrôle, mesures courantes et limites conservées.');
