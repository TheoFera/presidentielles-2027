"""Prépare les découpes une fois, hors du navigateur ; ne retouche pas les originaux."""
from pathlib import Path
from importlib.machinery import SourceFileLoader
from PIL import Image
import json

root = Path(__file__).resolve().parents[2]
sources = root/'propositions/journalistes'
audit = SourceFileLoader('audit_presse', str(sources/'verifier-planches.py')).load_module()
output = root/'assets/images/secondaires/journalistes'
output.mkdir(parents=True, exist_ok=True)
files = ['variante-1-kaki-rouge-marges-v2.png', 'variante-2-marine-ocre.png', 'variante-3-bleu-vert-marges-v2.png']
atlases = []
for variant, filename in enumerate(files):
    source, boxes, report = audit.silhouettes(sources/filename)
    assert len(boxes) == 12 and report['bords_libres'], report
    # Une seule base debout par personnage. Aucune pose de marche n'est embarquée.
    # Le kaki garde ses deux appuis pendant le filmage : l'image 4 est un pas,
    # l'image 3 est la véritable pose de caméra levée à l'arrêt.
    selected = [0, 3, 3 if variant == 0 else 4, 6, 9, 10]
    # Hauteur de référence = la plus petite des deux silhouettes debout de la planche : on réduit,
    # on n'agrandit jamais. (Avant le 03/11 : 196 px, deux fois moins que les autres PNJ, d'où le flou.)
    reference = min(boxes[0][3]-boxes[0][1], boxes[6][3]-boxes[6][1])
    crops = []
    for source_index in selected:
        box = boxes[source_index]
        crop = source.crop(box)
        ref = boxes[0 if source_index < 6 else 6]
        factor = reference/(ref[3]-ref[1])
        if factor != 1: crop = crop.resize((round(crop.width*factor), round(crop.height*factor)), Image.Resampling.LANCZOS)
        crops.append(crop)
    cell_width, cell_height = max(c.width for c in crops)+24, max(c.height for c in crops)+24
    sheet = Image.new('RGBA', (cell_width*3, cell_height*2))
    frames = []
    for index, crop in enumerate(crops):
        x = index%3*cell_width+(cell_width-crop.width)//2
        y = index//3*cell_height+cell_height-12-crop.height
        sheet.alpha_composite(crop,(x,y))
        feet = crop.getchannel('A').crop((0, int(crop.height*.91), crop.width, crop.height)).getbbox()
        pivot = (feet[0]+feet[2])/2
        frames.append([x,y,crop.width,crop.height,round(x+pivot,2),y+crop.height])
    name = f'journalistes-duo-{variant+1}-base-v3.png'
    sheet.save(output/name, optimize=True)
    # Calage visuel : les silhouettes kaki/rouge sont plus massives, marine/ocre plus fines.
    atlases.append({'sprite':f'journalist-duo-{variant+1}-base-v3','referenceHeight':reference,'sizeScale':[1,1.06,1][variant],'widthScale':.92 if variant == 0 else 1,'isolated':True,'frames':frames})
destination = root/'src/presentation/personnages/press-atlases.js'
destination.write_text('// Découpes mesurées par scripts/outils-images/preparer-journalistes.py.\nexport const PRESS_ATLASES = '+json.dumps(atlases,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps({'planches':len(atlases),'poses':sum(len(a['frames']) for a in atlases),'octets':sum(p.stat().st_size for p in output.glob('*-base-v3.png'))}))
