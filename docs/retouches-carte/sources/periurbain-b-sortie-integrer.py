from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

root = Path(__file__).resolve().parents[3]
s = root / 'docs/retouches-carte/sources'
b = Image.open(s / 'periurbain-b-avant-sortie.png').convert('RGB')
c = Image.open(s / 'periurbain-c-avant-sortie.png').convert('RGB')
original = np.array(Image.open(s / 'periurbain-b-sortie-extrait.png').convert('RGB'))
painted = np.array(Image.open(s / 'periurbain-b-sortie-source.png').convert('RGB').resize((820, 480), Image.Resampling.LANCZOS))
mask = Image.new('L', (820, 480))
ImageDraw.Draw(mask).polygon([(280, 293), (430, 293), (420, 305), (398, 315), (394, 330), (406, 350), (392, 370), (375, 363), (361, 341), (337, 323), (310, 313), (280, 305)], fill=255)
selected = np.array(mask) > 0
# Les plantes du premier plan sont exclues explicitement du masque.
r, g, blue = [original[..., k].astype(int) for k in range(3)]
plants = (g > r * 1.03) & (g > blue * 1.12)
plants[:, :395] = False
selected &= ~plants
selected[:293] = False
result = original.copy()
result[selected] = painted[selected]
assert np.array_equal(result[~selected], original[~selected])
assert np.array_equal(result[:293], original[:293])
assert np.array_equal(result[plants], original[plants])
Image.fromarray(selected.astype('uint8') * 255).save(s / 'periurbain-b-sortie-masque.png')
Image.fromarray(result).save(root / 'docs/retouches-carte/periurbain-b-sortie-apercu.png')
b.paste(Image.fromarray(result[:, :420]), (1500, 600))
c.paste(Image.fromarray(result[:, 420:]), (0, 600))
b.save(root / 'assets/images/carte/tuile-08-periurbain-b.png')
c.save(root / 'assets/images/carte/tuile-09-periurbain-c.png')
b.save(root / 'docs/retouches-carte/periurbain-b-rond-point-apercu.png')
context = Image.new('RGB', (1080, 720))
context.paste(b.crop((1140, 360, 1920, 1080)), (0, 0))
context.paste(c.crop((0, 360, 300, 1080)), (780, 0))
context.save(root / 'docs/retouches-carte/periurbain-bc-raccord-apercu.png')
print('Sortie intégrée ; trottoir arrière, plantes et pixels hors masque conservés.')
