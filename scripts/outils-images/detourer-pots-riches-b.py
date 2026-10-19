"""Détoure les deux pots peints devant la permanence de Riches B (tuile 17), pour les redessiner devant le rideau.
Usage depuis la racine : python scripts/outils-images/detourer-pots-riches-b.py assets/images/batiments/pots-devant-permanence-riches-b.png aperçu.png
Les positions (X0, Y0) doivent rester celles de BUILDING_OPENINGS['site:riches_b'].foregroundImage."""
import numpy as np, sys
from collections import deque
from PIL import Image, ImageFilter
X0,Y0,X1,Y1=262,838,576,1004
tile=Image.open('assets/images/carte/tuile-17-riches-b.png').convert('RGBA')
im=np.array(tile.convert('RGB')).astype(int)[Y0:Y1,X0:X1]
r,g,b=im[...,0],im[...,1],im[...,2]
H,W=r.shape
# Fond : vitrine beige ou orangée, porte et montants bleus.
bg=((r>=g-6)&(b>105)) | (r-g>32) | (b>g+4)
mask=np.zeros((H,W),bool)
def foliage(x0,y0,x1,y1):
  x0-=X0;x1-=X0;y0-=Y0;y1-=Y0
  seen=np.zeros((H,W),bool); q=deque()
  for x in range(x0,x1):
    for y in (y0,y1-1): q.append((y,x))
  for y in range(y0,y1):
    for x in (x0,x1-1): q.append((y,x))
  while q:
    y,x=q.popleft()
    if not(y0<=y<y1 and x0<=x<x1) or seen[y,x] or not bg[y,x]: continue
    seen[y,x]=True; q.extend([(y+1,x),(y-1,x),(y,x+1),(y,x-1)])
  mask[y0:y1,x0:x1]|=~seen[y0:y1,x0:x1]
foliage(266,840,352,933); foliage(484,840,572,934)
yy,xx=np.mgrid[0:H,0:W]; yy=yy+Y0; xx=xx+X0
inside=(((xx-308)/42.5)**2+((yy-885)/48)**2<=1)|(((xx-528)/44)**2+((yy-887)/48)**2<=1)
mask&=inside
for x0,y0,x1,y1 in [(278,931,337,1002),(496,932,560,1002)]: mask[y0-Y0:y1-Y0,x0-X0:x1-X0]=True
m=Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
src=tile.crop((X0,Y0,X1,Y1)); src.putalpha(m); src.save(sys.argv[1])
prev=Image.new('RGBA',src.size,(120,40,160,255)); prev.alpha_composite(src); prev.resize((W*3,H*3),Image.NEAREST).save(sys.argv[2])
