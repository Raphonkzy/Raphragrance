"""
Raphragrance - SQLite Fast CSV Importer
Imports 130,000+ perfumes into local SQLite database (perfumes.db).
Zero-setup, ultra-fast fallback when Docker/Postgres is not running.
"""
import csv
import sqlite3
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = BASE_DIR / "data" / "perfumes.csv"
DB_PATH = BASE_DIR / "data" / "perfumes.db"

def parse_int(val, default=0):
    try:
        return int(float(val)) if val and val.strip() else default
    except (ValueError, TypeError):
        return default

def parse_float(val, default=0.0):
    try:
        return float(val) if val and val.strip() else default
    except (ValueError, TypeError):
        return default

def run_import():
    if not CSV_PATH.exists():
        print(f"Error: {CSV_PATH} not found!")
        return

    print(f"Creating SQLite database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS perfumes (
            id INTEGER PRIMARY KEY,
            slug TEXT,
            name TEXT,
            brand TEXT,
            year INTEGER,
            collection TEXT,
            gender TEXT,
            url TEXT,
            rating_avg REAL,
            vote_count INTEGER,
            longevity_avg REAL,
            sillage_avg REAL,
            price_value_avg REAL,
            have_count INTEGER,
            had_count INTEGER,
            want_count INTEGER,
            winter_votes INTEGER,
            spring_votes INTEGER,
            summer_votes INTEGER,
            autumn_votes INTEGER,
            day_votes INTEGER,
            night_votes INTEGER,
            people_votes INTEGER,
            accords TEXT,
            notes_top TEXT,
            notes_middle TEXT,
            notes_base TEXT,
            notes_flat TEXT,
            perfumers TEXT,
            description TEXT,
            image_url TEXT
        )
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_name ON perfumes(name COLLATE NOCASE)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_brand ON perfumes(brand COLLATE NOCASE)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_gender ON perfumes(gender)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rating ON perfumes(rating_avg DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_votes ON perfumes(vote_count DESC)")
    conn.commit()

    print("Importing CSV records...")
    start = time.time()
    batch = []
    total = 0

    with open(CSV_PATH, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = parse_int(row.get("id"))
            if not pid:
                continue

            image_url = f"https://fimgs.net/mdimg/perfume/375x500.{pid}.jpg"

            item = (
                pid,
                row.get("slug", ""),
                row.get("name", "Unknown"),
                row.get("brand", "Unknown"),
                parse_int(row.get("year")) or None,
                row.get("collection", ""),
                row.get("gender", "unisex"),
                row.get("url", ""),
                parse_float(row.get("rating_avg")),
                parse_int(row.get("vote_count")),
                parse_float(row.get("longevity_avg")),
                parse_float(row.get("sillage_avg")),
                parse_float(row.get("price_value_avg")),
                parse_int(row.get("have")),
                parse_int(row.get("had")),
                parse_int(row.get("want")),
                parse_int(row.get("winter")),
                parse_int(row.get("spring")),
                parse_int(row.get("summer")),
                parse_int(row.get("autumn")),
                parse_int(row.get("day")),
                parse_int(row.get("night")),
                parse_int(row.get("people")),
                row.get("accords", ""),
                row.get("notes_top", ""),
                row.get("notes_middle", ""),
                row.get("notes_base", ""),
                row.get("notes_flat", ""),
                row.get("perfumers", ""),
                row.get("description", ""),
                image_url,
            )
            batch.append(item)

            if len(batch) >= 10000:
                cur.executemany("""
                    INSERT OR REPLACE INTO perfumes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, batch)
                conn.commit()
                total += len(batch)
                print(f"Imported {total:,}...")
                batch = []

        if batch:
            cur.executemany("""
                INSERT OR REPLACE INTO perfumes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, batch)
            conn.commit()
            total += len(batch)

    conn.close()
    elapsed = time.time() - start
    print(f"Finished! Imported {total:,} perfumes in {elapsed:.2f}s into {DB_PATH}")

if __name__ == "__main__":
    run_import()
