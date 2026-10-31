import os
import subprocess
from pathlib import Path

fonts_dir = Path("D:/Raffa/Mengoding/Raphragrance-rebuilt/assets/fonts")
out_dir = fonts_dir

# Weights to subset and convert: Regular (400), Medium (500), Bold (700)
targets = [
    "Gilroy-Regular.ttf",
    "Gilroy-Medium.ttf",
    "Gilroy-Bold.ttf",
]

# Unicode ranges for latin + latin-ext + common punctuation + currency + arrows:
# Basic Latin (0020-007F), Latin-1 Supp (00A0-00FF), Latin Ext A/B (0100-024F), General Punctuation (2000-206F), Currency (20A0-20CF), Arrows (2190-21BB), etc.
unicodes = "U+0020-007E,U+00A0-00FF,U+0100-017F,U+0180-024F,U+2000-206F,U+20A0-20CF,U+2190-21BB,U+2212"

for t in targets:
    src = fonts_dir / t
    stem = src.stem
    dest = out_dir / f"{stem}.woff2"
    cmd = [
        "python",
        "-m",
        "fontTools.subset",
        str(src),
        f"--output-file={dest}",
        "--flavor=woff2",
        f"--unicodes={unicodes}",
        "--layout-features=*",
        "--desubroutinize",
    ]
    print(f"Subsetting {t} -> {dest.name}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error subsetting {t}: {res.stderr}")
    else:
        src_size = os.path.getsize(src)
        dst_size = os.path.getsize(dest)
        print(f"  Success: {dest.name} ({src_size/1024:.1f} KB -> {dst_size/1024:.1f} KB)")

# Also create Gilroy-SemiBold.woff2 as a copy of Gilroy-Bold.woff2 or we map it via @font-face
print("Font conversion complete.")
