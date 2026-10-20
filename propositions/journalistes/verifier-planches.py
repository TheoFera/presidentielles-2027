from pathlib import Path
from collections import deque
from PIL import Image
import json

ROOT = Path(__file__).resolve().parent

def silhouettes(path):
    image = Image.open(path).convert('RGBA')
    width, height = image.size
    alpha = image.getchannel('A')
    mask = bytearray(1 if value > 24 else 0 for value in alpha.tobytes())
    boxes = []
    for start in range(len(mask)):
        if not mask[start]:
            continue
        queue = deque([start])
        mask[start] = 0
        left = right = start % width
        top = bottom = start // width
        count = 0
        while queue:
            index = queue.popleft()
            x, y = index % width, index // width
            count += 1
            left, right = min(left, x), max(right, x)
            top, bottom = min(top, y), max(bottom, y)
            for neighbor in (index-1 if x else -1, index+1 if x+1 < width else -1, index-width if y else -1, index+width if y+1 < height else -1):
                if neighbor >= 0 and mask[neighbor]:
                    mask[neighbor] = 0
                    queue.append(neighbor)
        if count > 1200:
            boxes.append([left, top, right+1, bottom+1])
    boxes.sort(key=lambda b: (b[1] >= height/2, b[0]))
    bbox = alpha.getbbox()
    margins = [bbox[0], bbox[1], width-bbox[2], height-bbox[3]]
    return image, boxes, {'fichier': path.name, 'dimensions': [width, height], 'marges_gauche_haut_droite_bas': margins, 'silhouettes': boxes, 'nombre_silhouettes': len(boxes), 'bords_libres': min(margins) > 0}

if __name__ == '__main__':
    reports = [silhouettes(p)[2] for p in sorted(ROOT.glob('variante-*.png'))]
    (ROOT / 'verification-bords.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
    for report in reports:
        print(report['fichier'], report['nombre_silhouettes'], report['marges_gauche_haut_droite_bas'], report['bords_libres'])
