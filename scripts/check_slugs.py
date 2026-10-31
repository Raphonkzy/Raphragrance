import sqlite3
conn = sqlite3.connect('D:/Raffa/Mengoding/Raphragrance/backend/data/perfumes.db')
cur = conn.cursor()
cur.execute('SELECT slug FROM perfumes WHERE slug IS NOT NULL LIMIT 10')
rows = cur.fetchall()
for r in rows:
    print(repr(r[0]))
cur.execute("SELECT COUNT(*) FROM perfumes WHERE slug LIKE '%/%'")
print('Slugs with slash:', cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM perfumes WHERE slug NOT LIKE '%/%' AND slug IS NOT NULL")
print('Slugs without slash:', cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM perfumes WHERE slug IS NULL")
print('NULL slugs:', cur.fetchone()[0])
conn.close()
