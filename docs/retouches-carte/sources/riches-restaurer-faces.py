from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

root = Path(__file__).resolve().parents[3]
sources = root / 'docs/retouches-carte/sources'
target = root / 'assets/images/carte/tuile-18-riches-c.png'
original = np.array(Image.open(target).convert('RGB'))
source = np.array(Image.open(sources / 'riches-c-production-v1.png').convert('RGB'))[:, 256:2176]
mask_image = Image.new('L', (1920, 1080))
draw = ImageDraw.Draw(mask_image)
# Les faces vitrées et les arêtes reprennent exactement la source ImageGen ;
# le ciel autour et le toit arrière reconstruit ne sont pas remplacés.
polygons = [
    [(304,199),(316,197),(317,185),(357,198),(359,320),(304,320)],
    [(393,187),(431,169),(466,181),(468,326),(392,326)],
    [(475,244),(487,238),(507,247),(507,331),(475,331)],
    [(514,230),(530,222),(533,224),(533,335),(514,335)],
    [(533,112),(591,95),(615,113),(615,345),(532,345)],
    [(618,222),(633,217),(638,230),(638,326),(618,326)],
    [(642,194),(699,177),(725,190),(727,346),(642,346)],
    [(736,245),(770,229),(792,241),(794,325),(736,325)],
    [(802,287),(817,279),(827,288),(827,330),(802,330)],
    [(829,247),(857,238),(872,246),(874,327),(829,327)],
    [(877,179),(892,170),(929,204),(930,324),(877,324)],
    [(1063,172),(1105,170),(1105,329),(1063,329)],
    [(1107,258),(1123,249),(1138,259),(1138,330),(1107,330)],
    [(1144,198),(1156,197),(1157,189),(1170,177),(1206,194),(1209,339),(1144,339)],
    [(1260,236),(1298,220),(1320,235),(1321,379),(1260,379)],
    [(1342,285),(1379,269),(1401,279),(1402,378),(1342,378)],
    [(1424,277),(1459,262),(1479,277),(1480,374),(1424,374)],
    [(1490,308),(1511,296),(1528,307),(1529,377),(1490,377)],
    [(1533,341),(1543,332),(1553,341),(1553,377),(1533,377)],
]
for points in polygons:
    draw.polygon(points, fill=255)
mask = np.array(mask_image)>0
result = original.copy()
result[mask] = source[mask]
assert np.array_equal(result[~mask], original[~mask])
mask_image.save(sources / 'riches-c-faces-vitrées-masque.png')
Image.fromarray(result).save(target)
Image.fromarray(result[:500]).save(sources / 'riches-c-skyline-integree.png')
print('Faces vitrées et arêtes restaurées :', int(mask.sum()))

names = ['tuile-15-retraites-c.png', 'tuile-16-riches-a.png', 'tuile-17-riches-b.png', 'tuile-18-riches-c.png', 'tuile-01-paris-a.png']
images = [Image.open(root / 'assets/images/carte' / name).convert('RGB') for name in names]
panorama = Image.new('RGB', (6272, 1080))
panorama.paste(images[0].crop((1664, 0, 1920, 1080)), (0, 0))
for n, image in enumerate(images[1:4]):
    panorama.paste(image, (256 + 1920*n, 0))
panorama.paste(images[-1].crop((0, 0, 256, 1080)), (6016, 0))
panorama.save(sources / 'riches-abc-contexte-integre.png')
panorama.resize((3136, 540)).save(root / 'docs/retouches-carte/riches-abc-integre-apercu.png')
