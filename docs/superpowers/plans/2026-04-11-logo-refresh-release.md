# Logo Refresh Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app logo with a flatter classic calculator mark that includes a profit-growth arrow, regenerate platform icon assets, rebuild desktop packages, and publish an updated GitHub release.

**Architecture:** Keep the existing packaging pipeline intact and add one deterministic Pillow-based drawing script that generates the source PNG for the Tauri icon set. Reuse `scripts/generate-icons.py` to derive the remaining macOS and Windows icon formats, then rebuild installers and update the release artifacts.

**Tech Stack:** Python 3, Pillow, Tauri 2, Rust, existing shell build scripts, GitHub Releases API

---

### Task 1: Establish a Clean Baseline

**Files:**
- Modify: `docs/superpowers/plans/2026-04-11-logo-refresh-release.md`
- Verify: `src-tauri`, `frontend/app.js`

- [ ] **Step 1: Verify the current branch and clean state**

Run:

```bash
git branch --show-current
git status -sb
```

Expected:
- Current branch is `codex/logo-refresh-release`
- Working tree is clean before implementation starts

- [ ] **Step 2: Run the baseline verification commands**

Run:

```bash
cd /Users/deviny/supermarket-calculator/src-tauri
cargo test
node --check /Users/deviny/supermarket-calculator/frontend/app.js
```

Expected:
- Rust tests pass
- Frontend syntax check exits with code `0`

### Task 2: Draw the New Calculator Logo Source Asset

**Files:**
- Create: `scripts/redraw_logo.py`
- Modify: `src-tauri/icons/128x128@2x.png`

- [ ] **Step 1: Add a deterministic logo renderer**

Create `scripts/redraw_logo.py` with a Pillow renderer that writes a `256x256` RGBA icon using the approved design:

```python
#!/usr/bin/env python3

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src-tauri" / "icons" / "128x128@2x.png"

CANVAS = 256
BG = "#F4F6F8"
BODY = "#294B63"
SCREEN = "#DCE5EA"
ARROW = "#3A6F8F"
ACCENT = "#F2994A"
KEY = "#F7FAFC"
KEY_ALT = "#D7E0E7"


def round_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def main():
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    round_rect(draw, (12, 12, 244, 244), 52, BG)
    round_rect(draw, (40, 28, 216, 228), 34, BODY)
    round_rect(draw, (60, 50, 196, 100), 18, SCREEN)

    draw.line([(82, 86), (112, 74), (134, 80), (170, 60)], fill=ARROW, width=12, joint="curve")
    draw.polygon([(170, 60), (152, 58), (163, 76)], fill=ARROW)

    key_w = 34
    key_h = 28
    gap_x = 12
    gap_y = 10
    start_x = 60
    start_y = 126
    rows = [
        [KEY_ALT, KEY_ALT, KEY_ALT, KEY_ALT],
        [KEY, KEY, KEY, KEY],
        [KEY, KEY, KEY, KEY],
    ]
    for row_index, row in enumerate(rows):
        for col_index, fill in enumerate(row):
            x1 = start_x + col_index * (key_w + gap_x)
            y1 = start_y + row_index * (key_h + gap_y)
            x2 = x1 + key_w
            y2 = y1 + key_h
            round_rect(draw, (x1, y1, x2, y2), 10, fill)

    round_rect(draw, (146, 202, 196, 226), 10, ACCENT)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Generate the new source icon**

Run:

```bash
python3 /Users/deviny/supermarket-calculator/scripts/redraw_logo.py
file /Users/deviny/supermarket-calculator/src-tauri/icons/128x128@2x.png
```

Expected:
- The file exists
- `file` reports a `256 x 256` PNG image

- [ ] **Step 3: Visually inspect the generated source icon**

Open:

```bash
open /Users/deviny/supermarket-calculator/src-tauri/icons/128x128@2x.png
```

Expected:
- The icon reads as a classic calculator
- The display arrow is clearly visible
- The orange key remains visible without overwhelming the icon

### Task 3: Regenerate Derived App Icons and Verify Them

**Files:**
- Modify: `src-tauri/icons/32x32.png`
- Modify: `src-tauri/icons/128x128.png`
- Modify: `src-tauri/icons/icon.ico`
- Modify: `src-tauri/icons/icon.icns`

- [ ] **Step 1: Run the existing icon derivation script**

Run:

```bash
cd /Users/deviny/supermarket-calculator
./scripts/generate-icons.py
```

Expected:
- Script prints `Regenerated icons`
- No `iconutil` or Pillow errors occur

- [ ] **Step 2: Verify generated files and formats**

Run:

```bash
file src-tauri/icons/32x32.png src-tauri/icons/128x128.png src-tauri/icons/icon.ico src-tauri/icons/icon.icns
```

Expected:
- PNG files report `32 x 32` and `128 x 128`
- `.ico` and `.icns` are valid icon resources

- [ ] **Step 3: Spot-check small-size readability**

Open:

```bash
open /Users/deviny/supermarket-calculator/src-tauri/icons/32x32.png
open /Users/deviny/supermarket-calculator/src-tauri/icons/128x128.png
```

Expected:
- The icon still reads as a calculator at `32x32`
- The arrow remains visible

### Task 4: Rebuild Packages and Refresh the GitHub Release

**Files:**
- Modify: `src-tauri/target/universal-apple-darwin/release/bundle/...`
- Modify: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/...`

- [ ] **Step 1: Rebuild the macOS universal bundle**

Run:

```bash
cd /Users/deviny/supermarket-calculator
./scripts/build-macos-universal.sh
```

Expected:
- Build exits with code `0`
- New `.app` and `.dmg` artifacts are generated

- [ ] **Step 2: Rebuild the Windows x64 installer**

Run:

```bash
cd /Users/deviny/supermarket-calculator
./scripts/build-windows-x64.sh
```

Expected:
- Build exits with code `0`
- New `nsis` installer is generated

- [ ] **Step 3: Re-run verification after the asset change**

Run:

```bash
cd /Users/deviny/supermarket-calculator/src-tauri
cargo test
node --check /Users/deviny/supermarket-calculator/frontend/app.js
```

Expected:
- Tests still pass after the logo update

- [ ] **Step 4: Commit, push, merge, and publish release assets**

Run:

```bash
git status -sb
git add scripts/redraw_logo.py src-tauri/icons docs/superpowers/specs/2026-04-11-logo-refresh-design.md docs/superpowers/plans/2026-04-11-logo-refresh-release.md
git commit -m "feat: refresh app logo and release assets"
git push -u origin codex/logo-refresh-release
```

Then merge to `main`, tag the next release version, and update the GitHub release assets so the download page contains the rebuilt packages with the new icon.

Expected:
- Branch is pushed successfully
- `main` receives the logo refresh
- GitHub release is updated to the new version and assets
