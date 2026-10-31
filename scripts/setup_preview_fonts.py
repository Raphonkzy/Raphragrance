import re
from pathlib import Path

src_file = Path("D:/Raffa/Mengoding/Raphragrance-rebuilt/reference/raphragrance-gilroy-swatch.html")
dst_file = Path("D:/Raffa/Mengoding/Raphragrance-rebuilt/reports/preview-gilroy-swatch.html")

content = src_file.read_text(encoding="utf-8")

# Replace font-face blocks with paths to ../assets/fonts/*.woff2
# and map 600 to Gilroy-Bold.woff2
new_font_faces = """@font-face{font-family:'Gilroy';font-weight:400;font-style:normal;font-display:swap;
  src:url('../assets/fonts/Gilroy-Regular.woff2') format('woff2'),url('../assets/fonts/Gilroy-Regular.ttf') format('truetype')}
@font-face{font-family:'Gilroy';font-weight:500;font-style:normal;font-display:swap;
  src:url('../assets/fonts/Gilroy-Medium.woff2') format('woff2'),url('../assets/fonts/Gilroy-Medium.ttf') format('truetype')}
@font-face{font-family:'Gilroy';font-weight:600;font-style:normal;font-display:swap;
  src:url('../assets/fonts/Gilroy-Bold.woff2') format('woff2'),url('../assets/fonts/Gilroy-Bold.ttf') format('truetype')}
@font-face{font-family:'Gilroy';font-weight:700;font-style:normal;font-display:swap;
  src:url('../assets/fonts/Gilroy-Bold.woff2') format('woff2'),url('../assets/fonts/Gilroy-Bold.ttf') format('truetype')}"""

content = re.sub(
    r"@font-face\{font-family:'Gilroy';font-weight:400;.*?@font-face\{font-family:'Gilroy';font-weight:700;.*?\}",
    new_font_faces,
    content,
    flags=re.DOTALL
)

dst_file.write_text(content, encoding="utf-8")
print(f"Created {dst_file} pointing to assets/fonts (600 mapped to Bold).")
