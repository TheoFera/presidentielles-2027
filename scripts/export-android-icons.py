"""Exporte le visuel existant pour le Play Store et les lanceurs Android.

Utilisation : python scripts/export-android-icons.py
Nécessite Pillow. Les anciens fichiers d'icône sont conservés.
"""
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/generated/masters/application-icone-v1.png"
RES = ROOT / "android/app/src/main/res"
STORE = ROOT / "android/play-store"
BACKGROUND = "#222A2C"
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def save_png(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def foreground(artwork, size):
    # Calque de 108 dp : illustration centrale de 60 dp, marge de 24 dp.
    # Le titre et « 2027 » restent au centre lors du découpage par le téléphone.
    canvas = Image.new("RGBA", (size, size))
    side = round(size * 60 / 108)
    offset = (size - side) // 2
    canvas.alpha_composite(artwork.resize((side, side), Image.Resampling.LANCZOS), (offset, offset))
    return canvas


def monochrome_polygons():
    # « 2027 » en chiffres de style arcade, pour les icônes à thème.
    segments = {
        "a": [(2, 0), (10, 0), (11, 1), (9, 3), (3, 3), (1, 1)],
        "b": [(10, 2), (12, 1), (12, 10), (11, 11), (9, 9), (9, 4)],
        "c": [(11, 12), (12, 13), (12, 22), (10, 21), (9, 19), (9, 14)],
        "d": [(3, 20), (9, 20), (11, 22), (10, 23), (2, 23), (1, 22)],
        "e": [(0, 13), (1, 12), (3, 14), (3, 19), (1, 21), (0, 22)],
        "f": [(0, 1), (2, 2), (3, 4), (3, 9), (1, 11), (0, 10)],
        "g": [(2, 10), (10, 10), (11, 11.5), (10, 13), (2, 13), (1, 11.5)],
    }
    polygons = [[(42, 42), (39, 31), (47, 35), (54, 26), (61, 35), (69, 31), (66, 42)]]
    for index, digit in enumerate("2027"):
        for segment in {"2": "abged", "0": "abcdef", "7": "abc"}[digit]:
            polygons.append([(x + 25.5 + index * 15, y + 47) for x, y in segments[segment]])
    return polygons


def export_monochrome():
    polygons = monochrome_polygons()
    paths = "\n".join(
        '    <path android:fillColor="#FFFFFFFF" android:pathData="M'
        + " L".join(f"{x:g},{y:g}" for x, y in polygon) + ' Z" />'
        for polygon in polygons
    )
    destination = RES / "drawable/ic_launcher_monochrome_v2.xml"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp" android:height="108dp"\n'
        '    android:viewportWidth="108" android:viewportHeight="108">\n'
        + paths + "\n</vector>\n", encoding="utf-8"
    )
    canvas = Image.new("RGBA", (432, 432))
    draw = ImageDraw.Draw(canvas)
    for polygon in polygons:
        draw.polygon([(x * 4, y * 4) for x, y in polygon], fill="white")
    return canvas


def preview(artwork, mono):
    layer = foreground(artwork, 432)
    full = Image.new("RGBA", layer.size, BACKGROUND)
    full.alpha_composite(layer)
    # Un lanceur affiche généralement les 72 dp centraux du calque de 108 dp.
    visible = full.crop((72, 72, 360, 360))
    themed = Image.new("RGBA", mono.size, "#D7E9DD")
    tint = Image.new("RGBA", mono.size, "#204A38")
    tint.putalpha(mono.getchannel("A"))
    themed.alpha_composite(tint)
    themed = themed.crop((72, 72, 360, 360))
    sheet = Image.new("RGB", (1040, 410), "#EEF1F5")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20) if Path("C:/Windows/Fonts/arial.ttf").exists() else ImageFont.load_default()
    for index, (label, icon, circular) in enumerate([
        ("Play Store", artwork, False), ("Android arrondi", visible, False),
        ("Android rond", visible, True), ("Icône à thème", themed, True),
    ]):
        icon = icon.resize((216, 216), Image.Resampling.LANCZOS)
        mask = Image.new("L", icon.size)
        shape = ImageDraw.Draw(mask)
        if circular:
            shape.ellipse((0, 0, 215, 215), fill=255)
        else:
            shape.rounded_rectangle((0, 0, 215, 215), radius=64 if index == 0 else 48, fill=255)
        x = 22 + index * 260
        sheet.paste(icon, (x, 30), mask)
        draw.text((x, 260), label, font=font, fill="#222A2C")
        small = icon.resize((48, 48), Image.Resampling.LANCZOS)
        sheet.paste(small, (x + 84, 310), mask.resize((48, 48), Image.Resampling.LANCZOS))
    save_png(sheet, STORE / "apercu-icones-v2.png")


def main():
    artwork = Image.open(SOURCE).convert("RGBA")
    assert artwork.size == (512, 512), "Le visuel source doit mesurer 512 × 512 pixels."
    assert artwork.getchannel("A").getextrema() == (255, 255), "Le fond Play Store doit être opaque."
    store_file = STORE / "icone-512-v2.png"
    save_png(artwork, store_file)
    assert store_file.stat().st_size <= 1024 * 1024, "L'icône Play Store dépasse 1 Mio."
    for density, scale in DENSITIES.items():
        directory = RES / f"mipmap-{density}"
        side = round(48 * scale)
        legacy = artwork.resize((side, side), Image.Resampling.LANCZOS)
        save_png(legacy, directory / "ic_launcher_v2.png")
        # Masque circulaire uniquement pour les anciennes versions Android.
        mask = Image.new("L", (side * 4, side * 4))
        ImageDraw.Draw(mask).ellipse((0, 0, side * 4 - 1, side * 4 - 1), fill=255)
        legacy.putalpha(mask.resize((side, side), Image.Resampling.LANCZOS))
        save_png(legacy, directory / "ic_launcher_round_v2.png")
        save_png(foreground(artwork, round(108 * scale)), directory / "ic_launcher_foreground_v2.png")
    mono = export_monochrome()
    preview(artwork, mono)
    # Vérifier les dimensions et la transparence des fichiers exportés.
    for density, scale in DENSITIES.items():
        directory = RES / f"mipmap-{density}"
        for name, dp in [("ic_launcher_v2", 48), ("ic_launcher_round_v2", 48), ("ic_launcher_foreground_v2", 108)]:
            with Image.open(directory / f"{name}.png") as exported:
                assert exported.size == (round(dp * scale),) * 2
                exported.verify()
        with Image.open(directory / "ic_launcher_foreground_v2.png") as exported:
            assert exported.getchannel("A").getextrema() == (0, 255)
    for polygon in monochrome_polygons():
        assert all((x - 54) ** 2 + (y - 54) ** 2 <= 33 ** 2 for x, y in polygon)
    for path in [RES / "drawable/ic_launcher_monochrome_v2.xml", *RES.glob("mipmap-anydpi-v*/ic_launcher*v2.xml")]:
        ET.parse(path)
    print("Icône Play Store, 15 images Android, calque monochrome et aperçu exportés et vérifiés.")


if __name__ == "__main__":
    main()
