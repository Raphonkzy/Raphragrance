import sqlite3
from collections import Counter

conn = sqlite3.connect('D:/Raffa/Mengoding/Raphragrance/backend/data/perfumes.db')
cur = conn.cursor()

cur.execute("SELECT count(*) FROM perfumes")
total = cur.fetchone()[0]

cur.execute("SELECT accords FROM perfumes WHERE accords IS NOT NULL AND accords != ''")
rows = cur.fetchall()

top_accords = []
all_accords = set()

for (acc_str,) in rows:
    first_item = acc_str.split('|')[0].strip()
    if not first_item:
        continue
    name = first_item.split(':')[0].strip().lower()
    if name:
        top_accords.append(name)
    
    for item in acc_str.split('|'):
        a_name = item.split(':')[0].strip().lower()
        if a_name:
            all_accords.add(a_name)

counts = Counter(top_accords)
print(f"Total perfumes in DB: {total}")
print(f"Total perfumes with accords: {len(top_accords)}")
print(f"Total distinct accords across all perfumes: {len(all_accords)}")
print(f"Distinct top accords: {len(counts)}")
print("\nTop accords with >= 0.5% of total perfumes (threshold = {total * 0.005:.1f}):")
print("-" * 60)

qualifying = []
for name, cnt in counts.most_common():
    pct = (cnt / total) * 100
    if pct >= 0.5:
        qualifying.append((name, cnt, pct))
        print(f"{name:20} : {cnt:6d} ({pct:5.2f}%)")

print("-" * 60)
print(f"Total qualifying accords (>= 0.5%): {len(qualifying)}")

conn.close()
