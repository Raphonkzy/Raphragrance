import sqlite3, json

conn = sqlite3.connect('D:/Raffa/Mengoding/Raphragrance/backend/data/perfumes.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

results = []

# 1. Top voted perfumes (high popularity) - 130
cur.execute('SELECT * FROM perfumes WHERE vote_count > 2500 ORDER BY vote_count DESC LIMIT 130')
results += [dict(r) for r in cur.fetchall()]

# 2. High rating classics - 80
cur.execute('SELECT * FROM perfumes WHERE vote_count BETWEEN 300 AND 2500 AND rating_avg > 4.2 ORDER BY rating_avg DESC LIMIT 80')
results += [dict(r) for r in cur.fetchall()]

# 3. Male top voted - 30
cur.execute("SELECT * FROM perfumes WHERE gender='male' AND vote_count > 1000 ORDER BY vote_count DESC LIMIT 30")
results += [dict(r) for r in cur.fetchall()]

# 4. Female top voted - 30
cur.execute("SELECT * FROM perfumes WHERE gender='female' AND vote_count > 1000 ORDER BY vote_count DESC LIMIT 30")
results += [dict(r) for r in cur.fetchall()]

# 5. Unisex top voted - 30
cur.execute("SELECT * FROM perfumes WHERE gender='unisex' AND vote_count > 1000 ORDER BY vote_count DESC LIMIT 30")
results += [dict(r) for r in cur.fetchall()]

# 6. Edge case: Flat notes only (no top, heart, base) - 15
cur.execute("SELECT * FROM perfumes WHERE notes_top='' AND notes_middle='' AND notes_base='' AND notes_flat != '' AND vote_count > 10 LIMIT 15")
results += [dict(r) for r in cur.fetchall()]

# 7. Edge case: No notes at all - 10
cur.execute("SELECT * FROM perfumes WHERE notes_top='' AND notes_middle='' AND notes_base='' AND (notes_flat='' OR notes_flat IS NULL) AND vote_count > 5 LIMIT 10")
results += [dict(r) for r in cur.fetchall()]

# 8. Edge case: Missing year (year is NULL or 0) - 20
cur.execute("SELECT * FROM perfumes WHERE (year IS NULL OR year = 0) AND vote_count > 50 ORDER BY vote_count DESC LIMIT 20")
results += [dict(r) for r in cur.fetchall()]

# 9. Edge case: Very long perfume names (>40 chars) - 20
cur.execute("SELECT * FROM perfumes WHERE length(name) > 40 AND vote_count > 5 ORDER BY length(name) DESC LIMIT 20")
results += [dict(r) for r in cur.fetchall()]

# 10. Edge case: Many accords (>5 accords) - 30
cur.execute("SELECT * FROM perfumes WHERE accords LIKE '%|%|%|%|%|%' AND vote_count > 100 ORDER BY vote_count DESC LIMIT 30")
results += [dict(r) for r in cur.fetchall()]

# 11. Edge case: No accords at all - 15
cur.execute("SELECT * FROM perfumes WHERE (accords = '' OR accords IS NULL) AND vote_count > 10 LIMIT 15")
results += [dict(r) for r in cur.fetchall()]

# 12. Edge case: Brands with slashes - include all 9 brands with slash!
cur.execute("SELECT * FROM perfumes WHERE brand LIKE '%/%' LIMIT 20")
results += [dict(r) for r in cur.fetchall()]

# Deduplicate
seen = set()
unique = []
for r in results:
    if r['id'] not in seen:
        seen.add(r['id'])
        unique.append(r)

print('Total unique fragrances collected:', len(unique))

def parse_notes(field):
    return [n.strip() for n in (field or '').split('|') if n.strip()]

def fmt(r):
    accords = []
    for item in (r['accords'] or '').split('|'):
        if ':' in item:
            parts = item.split(':', 1)
            try:
                accords.append({'name': parts[0].strip(), 'strength': int(parts[1].strip())})
            except:
                pass
        elif item.strip():
            accords.append({'name': item.strip(), 'strength': 50})

    rid = r['id']
    hue = (rid * 137) % 360

    season_raw = {
        'winter': r['winter_votes'] or 0,
        'spring': r['spring_votes'] or 0,
        'summer': r['summer_votes'] or 0,
        'autumn': r['autumn_votes'] or 0,
    }

    return {
        'id': rid,
        'slug': r['slug'] or str(rid),
        'name': r['name'],
        'brand': r['brand'],
        'year': r['year'] if r['year'] and r['year'] > 1700 else None,
        'gender': r['gender'] or 'unisex',
        'imageUrl': f'https://fimgs.net/mdimg/perfume/375x500.{rid}.jpg',
        'rating': round(float(r['rating_avg']), 2) if r['rating_avg'] else None,
        'voteCount': r['vote_count'] or 0,
        'longevity': round(float(r['longevity_avg']), 2) if r['longevity_avg'] else None,
        'sillage': round(float(r['sillage_avg']), 2) if r['sillage_avg'] else None,
        'hue': hue,
        'accords': accords,
        'notes': {
            'top': parse_notes(r['notes_top']),
            'heart': parse_notes(r['notes_middle']),
            'base': parse_notes(r['notes_base']),
            'flat': parse_notes(r['notes_flat']),
        },
        'seasons': season_raw,
        'timeOfDay': {
            'day': r['day_votes'] or 0,
            'night': r['night_votes'] or 0,
        },
        'perfumers': [p.strip() for p in (r['perfumers'] or '').split('|') if p.strip()],
        'description': r['description'] or '',
        'sourceUrl': r['url'] or '',
    }

formatted = [fmt(r) for r in unique]
with open('fixtures/fragrances.json', 'w', encoding='utf-8') as f:
    json.dump(formatted, f, ensure_ascii=False, indent=2)

print('Written', len(formatted), 'fragrances to fixtures/fragrances.json')
conn.close()
