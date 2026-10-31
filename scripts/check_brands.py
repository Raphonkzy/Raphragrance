import sqlite3

conn = sqlite3.connect('D:/Raffa/Mengoding/Raphragrance/backend/data/perfumes.db')
cur = conn.cursor()

# 1. Check slugs
cur.execute("SELECT COUNT(*) FROM perfumes WHERE slug LIKE '%/%'")
slugs_with_slash = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM perfumes WHERE slug NOT LIKE '%/%' AND slug IS NOT NULL")
slugs_without_slash = cur.fetchone()[0]

# 2. Check brands with slashes
cur.execute("SELECT COUNT(DISTINCT brand) FROM perfumes WHERE brand LIKE '%/%'")
brands_with_slash_count = cur.fetchone()[0]

cur.execute("SELECT DISTINCT brand FROM perfumes WHERE brand LIKE '%/%' LIMIT 15")
brands_with_slash = [r[0] for r in cur.fetchall()]

cur.execute("SELECT COUNT(DISTINCT brand) FROM perfumes")
total_brands = cur.fetchone()[0]

print(f"Total perfumes slug with slash: {slugs_with_slash}")
print(f"Total perfumes slug without slash: {slugs_without_slash}")
print(f"Total unique brands: {total_brands}")
print(f"Brands with slash in name: {brands_with_slash_count}")
print("Sample brands with slash:", [b.encode('ascii', 'backslashreplace').decode('ascii') for b in brands_with_slash])

conn.close()
