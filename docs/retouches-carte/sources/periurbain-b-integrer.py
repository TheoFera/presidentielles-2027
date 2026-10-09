from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

root = Path(__file__).resolve().parents[3]
sources = root / 'docs/retouches-carte/sources'
original = Image.open(sources / 'periurbain-b-avant.png').convert('RGB')
painted = Image.open(sources / 'periurbain-b-rond-point-source.png').convert('RGB').resize((1440, 720), Image.Resampling.LANCZOS)
before = np.array(original.crop((480, 360, 1920, 1080)))
after = np.array(painted)
mask = Image.new('L', (1440, 720))
draw = ImageDraw.Draw(mask)
# Bord franc : suivre la silhouette des plantations et couper sur la chaussée.
draw.polygon([(65, 534), (710, 534), (750, 490), (800, 450), (845, 405), (875, 350), (895, 260), (1160, 260), (1200, 300), (1240, 390), (1280, 450), (1320, 520), (1370, 535), (1370, 660), (1300, 660), (1220, 720), (280, 720), (200, 685), (65, 610)], fill=255)
selected = np.array(mask) > 0
result = before.copy()
result[selected] = after[selected]
assert np.array_equal(result[~selected], before[~selected])
original.paste(Image.fromarray(result), (480, 360))
full_mask = Image.new('L', (1920, 1080))
full_mask.paste(mask, (480, 360))
full_mask.save(sources / 'periurbain-b-rond-point-masque.png')
neighbor = Image.open(sources / 'periurbain-c-avant-raccord.png').convert('RGB')
context = Image.new('RGB', (1080, 720))
context.paste(original.crop((1140, 360, 1920, 1080)), (0, 0))
context.paste(neighbor.crop((0, 360, 300, 1080)), (780, 0))
old = np.array(context)
new = np.array(Image.open(sources / 'periurbain-bc-raccord-source.png').convert('RGB').resize(context.size, Image.Resampling.LANCZOS))

def cut(start, end, top, bottom):
    cost = np.abs(old[top:bottom, start:end].astype(float) - new[top:bottom, start:end]).mean(axis=2)
    parents = np.zeros(cost.shape, dtype=np.int16)
    cumulative = cost[0].copy()
    for y in range(1, len(cost)):
        choices = np.stack([np.r_[np.inf, cumulative[:-1]], cumulative, np.r_[cumulative[1:], np.inf]])
        choice = np.argmin(choices, axis=0)
        parents[y] = np.arange(end - start) + choice - 1
        cumulative = cost[y] + choices.min(axis=0)
    path = np.empty(len(cost), dtype=int)
    path[-1] = np.argmin(cumulative)
    for y in range(len(cost)-1, 0, -1):
        path[y-1] = parents[y, path[y]]
    return path + start

seam = np.zeros((720, 1080), dtype=bool)
x = np.arange(1080)[None, :]
# Couper sur les textures voisines les plus proches, jamais en transparence.
for top, bottom, left, right in [(515, 635, (565, 605), (940, 990)), (635, 720, (460, 490), (940, 990)), (300, 510, (490, 520), (635, 675))]:
    l, r = cut(*left, top, bottom), cut(*right, top, bottom)
    seam[top:bottom] |= (x >= l[:, None]) & (x <= r[:, None])
merged = old.copy()
merged[seam] = new[seam]
assert np.array_equal(merged[~seam], old[~seam])
Image.fromarray(seam.astype('uint8') * 255).save(sources / 'periurbain-bc-raccord-masque.png')
original.paste(Image.fromarray(merged[:, :780]), (1140, 360))
neighbor.paste(Image.fromarray(merged[:, 780:]), (0, 360))
curb = Image.new('RGB', (1100, 500))
curb.paste(original.crop((1420, 580, 1920, 1080)), (0, 0))
curb.paste(neighbor.crop((0, 580, 600, 1080)), (500, 0))
old = np.array(curb)
new = np.array(Image.open(sources / 'periurbain-bc-bordure-source.png').convert('RGB').resize(curb.size, Image.Resampling.LANCZOS))
border = np.zeros((500, 1100), dtype=bool)
x = np.arange(1100)[None, :]
l, r = cut(430, 470, 410, 500), cut(880, 950, 410, 500)
border[410:] = (x >= l[:, None]) & (x <= r[:, None])
curb_result = old.copy()
curb_result[border] = new[border]
assert np.array_equal(curb_result[~border], old[~border])
Image.fromarray(border.astype('uint8') * 255).save(sources / 'periurbain-bc-bordure-masque.png')
original.paste(Image.fromarray(curb_result[:, :500]), (1420, 580))
neighbor.paste(Image.fromarray(curb_result[:, 500:]), (0, 580))
original.save(root / 'assets/images/carte/tuile-08-periurbain-b.png')
neighbor.save(root / 'assets/images/carte/tuile-09-periurbain-c.png')
original.save(root / 'docs/retouches-carte/periurbain-b-rond-point-apercu.png')
context.paste(original.crop((1140, 360, 1920, 1080)), (0, 0))
context.paste(neighbor.crop((0, 360, 300, 1080)), (780, 0))
context.save(root / 'docs/retouches-carte/periurbain-bc-raccord-apercu.png')
print('Intégration opaque ; pixels extérieurs au masque conservés.')
