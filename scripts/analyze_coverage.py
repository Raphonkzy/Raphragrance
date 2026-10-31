import sqlite3
from collections import Counter

conn = sqlite3.connect('D:/Raffa/Mengoding/Raphragrance/backend/data/perfumes.db')
cur = conn.cursor()

cur.execute("SELECT count(*) FROM perfumes")
total = cur.fetchone()[0]

cur.execute("SELECT accords FROM perfumes WHERE accords IS NOT NULL AND accords != ''")
rows = cur.fetchall()

top_accords = []
for (acc_str,) in rows:
    first_item = acc_str.split('|')[0].strip()
    if not first_item:
        continue
    name = first_item.split(':')[0].strip().lower()
    if name:
        top_accords.append(name)

counts = Counter(top_accords)

# Currently covered accords (24 accords)
covered = {
    'woody', 'citrus', 'fruity', 'white floral', 'amber', 'floral',
    'aromatic', 'sweet', 'warm spicy', 'vanilla', 'rose', 'powdery',
    'fresh spicy', 'musky', 'green', 'leather', 'oud', 'lavender',
    'marine', 'fresh', 'patchouli', 'aldehydic', 'smoky', 'coffee'
}

covered_count = sum(cnt for name, cnt in counts.items() if name in covered)
covered_pct = (covered_count / total) * 100

print(f"Total perfumes: {total}")
print(f"Currently covered (24 accords): {covered_count} ({covered_pct:.2f}%)")
print(f"Currently falling back to DEF: {total - covered_count} ({(100 - covered_pct):.2f}%)\n")

# Top 15 uncovered top accords
uncovered = [(name, cnt, (cnt / total) * 100) for name, cnt in counts.most_common() if name not in covered]

print("Top 15 Uncovered Top Accords:")
print("-" * 50)
for i, (name, cnt, pct) in enumerate(uncovered[:15], 1):
    print(f"{i:2d}. {name:20} : {cnt:5d} ({pct:5.2f}%)")

# Lowering threshold to 0.2% (threshold = total * 0.002 = 263.8 perfumes)
between_02_and_05 = [
    (name, cnt, (cnt / total) * 100)
    for name, cnt in counts.most_common()
    if name not in covered and (cnt / total) >= 0.002
]

add_count = sum(cnt for _, cnt, _ in between_02_and_05)
add_pct = (add_count / total) * 100

print("\n" + "=" * 50)
print(f"Lowering threshold to 0.2% (>= {total * 0.002:.1f} perfumes):")
print(f"Would add {len(between_02_and_05)} accords:")
for name, cnt, pct in between_02_and_05:
    print(f"   + {name:20} : {cnt:5d} ({pct:5.2f}%)")
print(f"\nAdditional perfumes covered: {add_count} ({add_pct:.2f}%)")
print(f"New total coverage: {covered_count + add_count} ({(covered_pct + add_pct):.2f}%)")
print(f"New DEF fallback rate: {(100 - (covered_pct + add_pct)):.2f}%")

conn.close()
