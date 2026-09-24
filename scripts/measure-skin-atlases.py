"""Read-only silhouette measurement. Never modifies the generated PNG files."""
from pathlib import Path
import json
import numpy as np
from PIL import Image


def components(path, rows=4, clip_all=False, band_height=8, clip_margin=2):
    im = Image.open(path)
    alpha = np.asarray(im.getchannel('A'))
    mask = alpha > 100
    # Separate two touching silhouettes for measurement only; the PNG stays intact.
    if path.name == 'melenchon-populiste-actions-v1.png': mask[988,655:940] = False
    parent, bounds, areas = [], [], []
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    previous = []
    for y, row in enumerate(mask):
        edges = np.flatnonzero(np.diff(np.r_[False, row, False]))
        current = []
        for left, right in edges.reshape(-1, 2):
            i = len(parent)
            parent.append(i); bounds.append([int(left), y, int(right), y+1]); areas.append(int(right-left))
            for a, b, j in previous:
                if a > right: break
                if b >= left:
                    other = root(j)
                    if other != i: parent[other] = i
            current.append((left, right, i))
        previous = current
    groups = {}
    for i, box in enumerate(bounds):
        key = root(i)
        if key not in groups: groups[key] = [*box, areas[i]]
        else:
            b = groups[key]
            b[0] = min(b[0],box[0]); b[1] = min(b[1],box[1])
            b[2] = max(b[2],box[2]); b[3] = max(b[3],box[3]); b[4] += areas[i]
    large = [b for b in groups.values() if b[4] > 2500]
    large.sort(key=lambda b:(int(((b[0]+b[2])/2)/(im.width/4)), b[3]))
    # Each column has four poses; their lowest pixels reliably identify the row.
    cols = [[] for _ in range(4)]
    for b in large: cols[min(3,int(((b[0]+b[2])/2)/(im.width/4)))].append(b)
    ordered=[]
    if all(len(c)==rows for c in cols):
        ordered=[cols[c][r] for r in range(rows) for c in range(4)]
    clips = {}
    if ordered:
        keys = {id(b):key for key,b in groups.items()}
        for index, box in enumerate(ordered):
            x,y,x2,y2,_ = box
            key = keys[id(box)]
            overlaps = any(root(i) != key and b[0]<x2+2 and b[2]>x-2 and b[1]<y2+2 and b[3]>y-2 for i,b in enumerate(bounds))
            if not overlaps and not clip_all: continue
            bands = {}
            for i,b in enumerate(bounds):
                if root(i) != key: continue
                band = (b[1]-y)//band_height
                if band not in bands: bands[band] = [b[0],b[2]]
                else:
                    bands[band][0] = min(bands[band][0],b[0])
                    bands[band][1] = max(bands[band][1],b[2])
            left, right = [], []
            for band,(a,b) in sorted(bands.items()):
                top=max(0,y+band*band_height-clip_margin); bottom=min(im.height,y+(band+1)*band_height+clip_margin)
                left.extend([[max(0,a-clip_margin),top],[max(0,a-clip_margin),bottom]])
                right.extend([[min(im.width,b+clip_margin),top],[min(im.width,b+clip_margin),bottom]])
            clips[index] = left + right[::-1]
    return {'size':im.size,'count':len(large),'columns':[len(c) for c in cols], 'bounds':ordered or large, 'clips':clips}


if __name__ == '__main__':
    result={p.name:components(p) for p in Path('assets/generated/animations/skins').glob('*.png')}
    Path('artifacts/skin-measurements.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    for name,data in result.items(): print(name,data['count'],data['columns'])
