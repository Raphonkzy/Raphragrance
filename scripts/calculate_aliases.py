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

# 23 active accords (coffee aliased to leather)
covered = {
    'woody', 'citrus', 'fruity', 'white floral', 'amber', 'floral',
    'aromatic', 'sweet', 'warm spicy', 'vanilla', 'rose', 'powdery',
    'fresh spicy', 'musky', 'green', 'leather', 'oud', 'lavender',
    'marine', 'fresh', 'patchouli', 'aldehydic', 'smoky'
}
# coffee was already 65
base_covered_count = sum(cnt for name, cnt in counts.items() if name in covered or name == 'coffee')
base_covered_pct = (base_covered_count / total) * 100

proposed_aliases = [
    ("aquatic", "marine", "Oceanic / sea accords belong directly in marine"),
    ("iris", "powdery", "Iris has classic powdery/cosmetic rhizome profile"),
    ("yellow floral", "floral", "Ylang-ylang, mimosa, frangipani fit natural floral"),
    ("earthy", "patchouli", "Damp earth, petrichor, and forest floor map to patchouli"),
    ("ozonic", "fresh", "Crisp morning air, breezy ozone fits arctic fresh"),
    ("violet", "lavender", "Cool herbal ionone violet fits lavender purple"),
    ("tropical", "fruity", "Passionfruit, mango, guava fit sunny fruity"),
    ("coconut", "vanilla", "Lactonic sweet gourmand cream fits warm vanilla"),
    ("tobacco", "leather", "Dried aromatic cured leaf fits dark rich leather"),
    ("caramel", "amber", "Rich golden molasses and ethyl maltol fit amber"),
    ("almond", "vanilla", "Nutty benzaldehyde gourmand sweetness fits vanilla"),
    ("soft spicy", "warm spicy", "Gentle nutmeg/cinnamon fits spicy family"),
    ("honey", "amber", "Deep golden animalic nectar fits resinous amber"),
    ("cherry", "fruity", "Dark sweet fruit fits fruity"),
    ("tuberose", "white floral", "Indolic white bloom is quintessentially white floral"),
]

print(f"Base 23 accords (with coffee->leather): {base_covered_count} ({base_covered_pct:.2f}%)\n")
print(f"{'Uncovered Accord':<16} | {'Proposed Alias Target':<16} | {'Count':<7} | {'Share':<7} | {'Rationale'}")
print("-" * 90)

total_added = 0
for src, dst, note in proposed_aliases:
    cnt = counts.get(src, 0)
    pct = (cnt / total) * 100
    total_added += cnt
    print(f"{src:<16} | {dst:<16} | {cnt:<7} | {pct:5.2f}% | {note}")

new_total = base_covered_count + total_added
new_pct = (new_total / total) * 100
print("-" * 90)
print(f"Total Added via Aliasing: {total_added} perfumes (+{(total_added/total)*100:.2f}%)")
print(f"New Total Coverage: {new_total} perfumes ({new_pct:.2f}%)")
print(f"Remaining DEF Fallback: {total - new_total} perfumes ({(100 - new_pct):.2f}%)")

conn.close()
