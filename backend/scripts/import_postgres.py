"""
Raphragrance - PostgreSQL Fast CSV Importer
Imports 130,000+ perfumes from backend/data/perfumes.csv into PostgreSQL.
"""
import csv
import os
import sys
import time
from pathlib import Path
from typing import List, Tuple

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Load env variables
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = BASE_DIR / "data" / "perfumes.csv"
DATABASE_URL = os.getenv("DATABASE_URL", "")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS perfumes (
    id INT PRIMARY KEY,
    slug VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255) NOT NULL,
    year INT,
    collection VARCHAR(255),
    gender VARCHAR(50),
    url TEXT,
    rating_avg REAL,
    vote_count INT,
    longevity_avg REAL,
    sillage_avg REAL,
    price_value_avg REAL,
    have_count INT,
    had_count INT,
    want_count INT,
    winter_votes INT,
    spring_votes INT,
    summer_votes INT,
    autumn_votes INT,
    day_votes INT,
    night_votes INT,
    people_votes INT,
    accords TEXT,
    notes_top TEXT,
    notes_middle TEXT,
    notes_base TEXT,
    notes_flat TEXT,
    perfumers TEXT,
    description TEXT,
    image_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_perfumes_name ON perfumes (name);
CREATE INDEX IF NOT EXISTS idx_perfumes_brand ON perfumes (brand);
CREATE INDEX IF NOT EXISTS idx_perfumes_gender ON perfumes (gender);
CREATE INDEX IF NOT EXISTS idx_perfumes_rating ON perfumes (rating_avg DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_perfumes_votes ON perfumes (vote_count DESC NULLS LAST);
"""


def parse_int(val: str, default: int = 0) -> int:
    try:
        return int(float(val)) if val and val.strip() else default
    except (ValueError, TypeError):
        return default


def parse_float(val: str, default: float = 0.0) -> float:
    try:
        return float(val) if val and val.strip() else default
    except (ValueError, TypeError):
        return default


def run_import():
    if not CSV_PATH.exists():
        print(f"Error: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    print(f"Connecting to database: {DATABASE_URL}")
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"Failed to connect to PostgreSQL: {e}")
        print("\nPastikan PostgreSQL di Docker sudah berjalan:")
        print("  docker compose up -d")
        sys.exit(1)

    cur = conn.cursor()

    print("Creating tables and indexes if not exists...")
    cur.execute(CREATE_TABLE_SQL)
    conn.commit()

    print(f"Reading and importing data from: {CSV_PATH}")
    start_time = time.time()

    insert_sql = """
    INSERT INTO perfumes (
        id, slug, name, brand, year, collection, gender, url,
        rating_avg, vote_count, longevity_avg, sillage_avg, price_value_avg,
        have_count, had_count, want_count,
        winter_votes, spring_votes, summer_votes, autumn_votes,
        day_votes, night_votes, people_votes,
        accords, notes_top, notes_middle, notes_base, notes_flat,
        perfumers, description, image_url
    ) VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        year = EXCLUDED.year,
        collection = EXCLUDED.collection,
        gender = EXCLUDED.gender,
        url = EXCLUDED.url,
        rating_avg = EXCLUDED.rating_avg,
        vote_count = EXCLUDED.vote_count,
        longevity_avg = EXCLUDED.longevity_avg,
        sillage_avg = EXCLUDED.sillage_avg,
        price_value_avg = EXCLUDED.price_value_avg,
        have_count = EXCLUDED.have_count,
        had_count = EXCLUDED.had_count,
        want_count = EXCLUDED.want_count,
        winter_votes = EXCLUDED.winter_votes,
        spring_votes = EXCLUDED.spring_votes,
        summer_votes = EXCLUDED.summer_votes,
        autumn_votes = EXCLUDED.autumn_votes,
        day_votes = EXCLUDED.day_votes,
        night_votes = EXCLUDED.night_votes,
        people_votes = EXCLUDED.people_votes,
        accords = EXCLUDED.accords,
        notes_top = EXCLUDED.notes_top,
        notes_middle = EXCLUDED.notes_middle,
        notes_base = EXCLUDED.notes_base,
        notes_flat = EXCLUDED.notes_flat,
        perfumers = EXCLUDED.perfumers,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url;
    """

    batch: List[Tuple] = []
    batch_size = 5000
    total_imported = 0

    with open(CSV_PATH, mode="r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)

        for row in reader:
            perfume_id = parse_int(row.get("id"))
            if not perfume_id:
                continue

            # Standard Fragrantica picture URL pattern
            image_url = f"https://fimgs.net/mdimg/perfume/375x500.{perfume_id}.jpg"

            item = (
                perfume_id,
                row.get("slug", "")[:255],
                row.get("name", "Unknown")[:255],
                row.get("brand", "Unknown")[:255],
                parse_int(row.get("year"), default=0) or None,
                row.get("collection", "")[:255] if row.get("collection") else None,
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

            if len(batch) >= batch_size:
                execute_values(cur, insert_sql, batch)
                conn.commit()
                total_imported += len(batch)
                print(f"Imported {total_imported:,} perfumes...")
                batch = []

        if batch:
            execute_values(cur, insert_sql, batch)
            conn.commit()
            total_imported += len(batch)

    cur.close()
    conn.close()

    elapsed = time.time() - start_time
    print(f"\nSuccessfully imported {total_imported:,} perfumes in {elapsed:.2f} seconds!")


if __name__ == "__main__":
    run_import()
