"""Read-only alpha measurements; the generated PNGs are never modified."""
from pathlib import Path
import importlib.util
import json
import sys
import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('skin_measure', 'scripts/measure-skin-atlases.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
result = {}
for job in json.loads(Path('docs/ultimate-animation-prompts.json').read_text(encoding='utf-8-sig')):
    path = Path(job['file'])
    if not path.exists():
        continue
    im = Image.open(path)
    alpha = np.asarray(im.getchannel('A'))
    if np.mean(alpha < 10) < .15:
        raise ValueError(f'Fond non transparent : {path}')
    rows = job['rows']
    bounds = []
    measured = module.components(path, rows, clip_all=True, band_height=2, clip_margin=.5) if 'bardella' in path.name else module.components(path, rows)
    if measured['count'] == rows*4 and all(c == rows for c in measured['columns']):
        bounds = [b[:4] for b in measured['bounds']]
    else:
        for row in range(rows):
            for col in range(4):
                x0, x1 = col*im.width//4, (col+1)*im.width//4
                y0, y1 = row*im.height//rows, (row+1)*im.height//rows
                yy, xx = np.nonzero(alpha[y0:y1,x0:x1] > 100)
                if not len(xx):
                    raise ValueError(f'Cellule vide : {path}, {row}, {col}')
                bounds.append([int(x0+xx.min()),int(y0+yy.min()),int(x0+xx.max()+1),int(y0+yy.max()+1)])
    result[path.stem.split('-v')[0]] = {'size':im.size,'bounds':bounds,'clips':measured['clips'],'transparent':float(np.mean(alpha<10))}
Path('artifacts').mkdir(exist_ok=True)
Path('artifacts/ultimate-measurements.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
for key,value in result.items():
    print(key,len(value['bounds']),round(value['transparent'],3))
