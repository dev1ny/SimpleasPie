#!/usr/bin/env python3

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT_DIR / "src-tauri" / "icons"
SOURCE_ICON = ICONS_DIR / "128x128@2x.png"


def resize_icon(image: Image.Image, size: int, output: Path) -> None:
    resampling = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    image.resize((size, size), resampling).save(output)


def main() -> None:
    image = Image.open(SOURCE_ICON).convert("RGBA")

    resize_icon(image, 32, ICONS_DIR / "32x32.png")
    resize_icon(image, 128, ICONS_DIR / "128x128.png")
    resize_icon(image, 256, ICONS_DIR / "128x128@2x.png")

    image.save(
        ICONS_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    with tempfile.TemporaryDirectory() as tmp_dir:
        iconset_dir = Path(tmp_dir) / "AppIcon.iconset"
        iconset_dir.mkdir()

        iconset_sizes = {
            "icon_16x16.png": 16,
            "icon_16x16@2x.png": 32,
            "icon_32x32.png": 32,
            "icon_32x32@2x.png": 64,
            "icon_128x128.png": 128,
            "icon_128x128@2x.png": 256,
            "icon_256x256.png": 256,
            "icon_256x256@2x.png": 512,
            "icon_512x512.png": 512,
        }

        for name, size in iconset_sizes.items():
            resize_icon(image, size, iconset_dir / name)

        subprocess.run(
            [
                "iconutil",
                "-c",
                "icns",
                str(iconset_dir),
                "-o",
                str(ICONS_DIR / "icon.icns"),
            ],
            check=True,
        )

    print(f"Regenerated icons in {ICONS_DIR}")


if __name__ == "__main__":
    main()
