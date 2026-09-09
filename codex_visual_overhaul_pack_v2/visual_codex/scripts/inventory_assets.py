#!/usr/bin/env python3
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
candidates = [
    ROOT / "public/assets/generated",
    ROOT / "assets/generated",
    ROOT / "src/assets/generated",
]
asset_root = next((p for p in candidates if p.exists()), None)
if not asset_root:
    print("No generated asset directory found yet.")
    raise SystemExit(0)

rows = []
for p in asset_root.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".png", ".webp", ".jpg", ".jpeg"}:
        continue
    try:
        with Image.open(p) as im:
            rows.append({
                "file": str(p.relative_to(ROOT)),
                "width": im.width,
                "height": im.height,
                "mode": im.mode,
                "format": im.format,
            })
    except Exception as e:
        rows.append({"file": str(p.relative_to(ROOT)), "error": str(e)})

out = ROOT / "visual_codex/asset_inventory.json"
out.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Wrote {out} with {len(rows)} entries")
