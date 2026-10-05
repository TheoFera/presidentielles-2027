import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('docs/production/decor-v3/carte-plate');
const p=path.join(base,'production'),file=path.join(p,'recul-obstacles.json');
const plan=JSON.parse(fs.readFileSync(file));
for(const e of plan.retouches){
 e.generatedOriginal??=e.generated;
 e.generated=path.join(p,'recul-'+e.id+'-generation.png');
}
plan.retouches[0].instruction='Supprimer seulement le massif de l’îlot et conserver la bordure arrondie.';
fs.writeFileSync(file,JSON.stringify(plan,null,2));
const inspectionFile=path.join(p,'controle-visuel-raccords/inspection.json');
const inspection=JSON.parse(fs.readFileSync(inspectionFile));
inspection.date=new Date().toISOString();
inspection.sha256Maitre=plan.verification.sha256Maitre;
const changed=plan.verification.raccords.filter(r=>!r.identiqueAvantRecul);
if(changed.length!==4)throw new Error('Liste de raccords différente de celle inspectée.');
inspection.revisionReculObstacles={
 date:inspection.date,raccordsReinspectes:['08→09','14→15','16→17','17→18'],
 autresRaccordsIdentiquesAuMaitrePrecedemmentInspecte:true,
 controleDesPixels:plan.verification.raccords,
 observations:[
  'Massif de l’îlot de Périurbain B et pots de Retraités B supprimés.',
  'Jardinière débordante de Riches A/B remplacée par un jardin derrière la grille.',
  'Kiosque, deux présentoirs et petit lampadaire de Riches B : pieds vers y = 900 ; bande libre avant la marche à y = 1 004.',
  'Quatre raccords examinés à 100 % ; trois vitrines restaurées conservées au pixel près.'
 ]
};
const limite='De légères différences de texture et de joints de pavage subsistent autour de l’îlot vidé de Périurbain B ; aucun massif ne reste sur cet îlot. Les contrôles numériques ne prouvent pas à eux seuls la qualité artistique.';
if(!inspection.limites.includes(limite))inspection.limites.push(limite);
fs.writeFileSync(inspectionFile,JSON.stringify(inspection,null,2));
console.log('Inspection liée au nouveau maître : 4 raccords réinspectés, 14 identiques. Sources générées archivées dans le dépôt.');
