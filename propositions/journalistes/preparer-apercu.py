from pathlib import Path
from PIL import Image
from io import BytesIO
import json, base64
from importlib.machinery import SourceFileLoader

root = Path(__file__).resolve().parent
project = root.parent.parent
audit = SourceFileLoader('audit', str(root/'verifier-planches.py')).load_module()
assets = {}
def encode(name, image, size):
    image.thumbnail(size, Image.Resampling.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, format='WEBP', quality=87)
    assets[name] = 'data:image/webp;base64,'+base64.b64encode(buffer.getvalue()).decode()

source = root/'variante-1-kaki-rouge-marges-v2.png'
if not source.exists():
    source = root/'variante-2-marine-ocre.png'
im, boxes, report = audit.silhouettes(source)
assert len(boxes) == 12, report
assert report['bords_libres'], report
for key, index in [('cam-marche',1),('cam-filme',4),('mic-marche',7),('mic-frappe',10)]:
    encode(key, im.crop(boxes[index]), (280,280))
im, boxes, report = audit.silhouettes(project/'assets/images/candidats/philippe/philippe-base-combat-v1.png')
# La première silhouette correspond à la garde ; une seule pose suffit à cette maquette.
assert boxes
encode('candidat-garde',im.crop(boxes[0]),(280,280))
im = Image.open(project/'assets/images/candidats/philippe/character-philippe.png').convert('RGBA')
encode('candidat',im.crop(im.getchannel('A').getbbox()),(280,280))
encode('fond',Image.open(project/'assets/images/carte/tuile-02-paris-b.png'),(1000,563))
html=(root/'apercu-combat.source.html').read_text(encoding='utf-8').replace('__ASSETS__',json.dumps(assets))
destination=Path('C:/Users/ferat/.codex/visualizations/2026/10/20/01a15965-a445-7043-aad6-31d0231bc7a3/combat-journalistes.html')
destination.write_text(html,encoding='utf-8')
(root/'apercu-combat.html').write_text(html,encoding='utf-8')
print(json.dumps({'octets':destination.stat().st_size,'source':source.name,'sprites':len(assets)},ensure_ascii=False))
