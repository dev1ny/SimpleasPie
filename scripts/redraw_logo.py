#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT_DIR / "src-tauri" / "icons" / "128x128@2x.png"

SOURCE_SIZE = 1024
OUTPUT_SIZE = 256

BG = "#F2F6F9"
BODY = "#28485F"
SCREEN = "#DDE6EB"
ARROW = "#3C6F8D"
KEY = "#F7FAFC"
KEY_ALT = "#D2DEE6"
ACCENT = "#F59A4A"


def scale(value: int) -> int:
    return int(value * SOURCE_SIZE / OUTPUT_SIZE)


def rounded_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_calculator_icon() -> Image.Image:
    image = Image.new("RGBA", (SOURCE_SIZE, SOURCE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    rounded_rect(draw, (scale(10), scale(10), scale(246), scale(246)), scale(52), BG)
    rounded_rect(draw, (scale(40), scale(28), scale(216), scale(228)), scale(34), BODY)
    rounded_rect(draw, (scale(60), scale(48), scale(196), scale(104)), scale(18), SCREEN)

    arrow_points = [
        (scale(82), scale(85)),
        (scale(110), scale(75)),
        (scale(132), scale(81)),
        (scale(169), scale(60)),
    ]
    draw.line(arrow_points, fill=ARROW, width=scale(10), joint="curve")
    draw.polygon(
        [
            (scale(169), scale(60)),
            (scale(151), scale(58)),
            (scale(162), scale(76)),
        ],
        fill=ARROW,
    )

    key_width = scale(28)
    key_height = scale(26)
    gap_x = scale(8)
    gap_y = scale(10)
    start_x = scale(62)
    start_y = scale(126)
    radius = scale(10)

    rows = [
        [KEY_ALT, KEY_ALT, KEY_ALT, KEY_ALT],
        [KEY, KEY, KEY, KEY],
        [KEY, KEY, KEY, KEY],
        [KEY, KEY, KEY, ACCENT],
    ]

    for row_index, row in enumerate(rows):
        for col_index, fill in enumerate(row):
            x1 = start_x + col_index * (key_width + gap_x)
            y1 = start_y + row_index * (key_height + gap_y)
            x2 = x1 + key_width
            y2 = y1 + key_height
            rounded_rect(draw, (x1, y1, x2, y2), radius, fill)

    return image.resize(
        (OUTPUT_SIZE, OUTPUT_SIZE),
        Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS,
    )


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    draw_calculator_icon().save(OUTPUT_PATH)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
