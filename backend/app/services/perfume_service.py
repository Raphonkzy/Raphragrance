"""
Raphragrance - Perfume Service (PostgreSQL with SQLite Automatic Fallback)
Supports both PostgreSQL (Docker) and SQLite local database seamlessly.
"""
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SQLITE_DB_PATH = BASE_DIR / "data" / "perfumes.db"


def _longevity_label(avg: Optional[float]) -> str:
    if avg is None:
        return "Moderate"
    if avg >= 4.0:
        return "Eternal"
    if avg >= 3.0:
        return "Long Lasting"
    if avg >= 2.0:
        return "Moderate"
    return "Weak"


def _sillage_label(avg: Optional[float]) -> str:
    if avg is None:
        return "Moderate"
    if avg >= 3.5:
        return "Enormous"
    if avg >= 2.5:
        return "Strong"
    if avg >= 1.8:
        return "Moderate"
    return "Intimate"


def _format_perfume(row: Dict[str, Any]) -> Dict[str, Any]:
    """Formats a database row into the Fragrance object expected by the frontend."""
    # Accords parsing
    accords_raw = row.get("accords") or ""
    main_accords = []
    main_accords_percentage = {}
    if accords_raw:
        for item in accords_raw.split("|"):
            if ":" in item:
                parts = item.split(":", 1)
                acc_name = parts[0].strip()
                strength = parts[1].strip()
                if acc_name:
                    main_accords.append(acc_name)
                    main_accords_percentage[acc_name] = f"{strength}%"
            elif item.strip():
                main_accords.append(item.strip())

    # Notes parsing
    top_notes = [n.strip() for n in (row.get("notes_top") or "").split("|") if n.strip()]
    mid_notes = [n.strip() for n in (row.get("notes_middle") or "").split("|") if n.strip()]
    base_notes = [n.strip() for n in (row.get("notes_base") or "").split("|") if n.strip()]
    flat_notes = [n.strip() for n in (row.get("notes_flat") or "").split("|") if n.strip()]

    general_notes = list(dict.fromkeys(top_notes + mid_notes + base_notes + flat_notes))

    # Season rankings
    seasons = [
        {"name": "winter", "score": float(row.get("winter_votes") or 0)},
        {"name": "spring", "score": float(row.get("spring_votes") or 0)},
        {"name": "summer", "score": float(row.get("summer_votes") or 0)},
        {"name": "fall", "score": float(row.get("autumn_votes") or 0)},
    ]
    max_season = max([s["score"] for s in seasons], default=0)
    if max_season > 0:
        for s in seasons:
            s["score"] = round((s["score"] / max_season) * 4.0, 1)

    # Occasion rankings
    day_v = float(row.get("day_votes") or 0)
    night_v = float(row.get("night_votes") or 0)
    max_day = max(day_v, night_v, 1.0)
    occasions = [
        {"name": "casual", "score": round((day_v / max_day) * 4.0, 1)},
        {"name": "evening", "score": round((night_v / max_day) * 4.0, 1)},
    ]

    total_time_votes = day_v + night_v
    day_night = []
    if total_time_votes > 0:
        day_ratio = day_v / total_time_votes
        night_ratio = night_v / total_time_votes
        if day_ratio >= 0.35:
            day_night.append({"name": "Day", "score": round(day_ratio * 100)})
        if night_ratio >= 0.35:
            day_night.append({"name": "Night", "score": round(night_ratio * 100)})

    rating_val = row.get("rating_avg")
    rating_str = f"{rating_val:.2f}" if rating_val is not None else "4.00"

    price_val = row.get("price_value_avg") or 3.0
    price_est = max(65, min(250, int(price_val * 42)))

    perfume_id = str(row.get("id"))
    image_url = row.get("image_url") or f"https://fimgs.net/mdimg/perfume/375x500.{perfume_id}.jpg"

    return {
        "_id": perfume_id,
        "Name": row.get("name") or "Unknown",
        "Brand": row.get("brand") or "Unknown",
        "Year": str(row.get("year") or "") if row.get("year") else None,
        "rating": rating_str,
        "Gender": (row.get("gender") or "unisex").lower(),
        "Price Value": f"{price_val:.1f}",
        "Price": f"{price_est}.00",
        "Image URL": image_url,
        "Image URL Transparent": image_url,
        "Purchase URL": row.get("url") or "",
        "Longevity": _longevity_label(row.get("longevity_avg")),
        "Sillage": _sillage_label(row.get("sillage_avg")),
        "General Notes": general_notes,
        "Notes": {
            "Top": [{"name": n} for n in top_notes],
            "Heart": [{"name": n} for n in mid_notes],
            "Base": [{"name": n} for n in base_notes],
        },
        "Main Accords": main_accords,
        "Main Accords Percentage": main_accords_percentage,
        "Season Ranking": seasons,
        "Occasion Ranking": occasions,
        "Day Night": day_night,
        "Description": row.get("description") or "",
    }


class PerfumeService:
    """Provides local database queries with automatic Postgres -> SQLite fallback."""

    def __init__(self, db_url: str):
        self.db_url = (db_url or "").strip()
        self.sqlite_path = str(SQLITE_DB_PATH)
        self._is_sqlite = False
        if not self.db_url:
            self._is_sqlite = True
            logger.info("Using local SQLite database: %s", self.sqlite_path)
        else:
            self._test_connection()

    def _test_connection(self):
        if not self.db_url:
            self._is_sqlite = True
            return
        try:
            import psycopg2
            conn = psycopg2.connect(self.db_url, connect_timeout=2)
            conn.close()
            self._is_sqlite = False
            logger.info("Connected to PostgreSQL database successfully.")
        except Exception:
            self._is_sqlite = True
            logger.info("PostgreSQL not reachable. Falling back to local SQLite: %s", self.sqlite_path)

    @property
    def is_using_mock(self) -> bool:
        return False

    def _query(self, sql_pg: str, sql_sqlite: str, params: list) -> List[Dict[str, Any]]:
        # Re-check PostgreSQL if currently in fallback
        if not self._is_sqlite:
            try:
                import psycopg2
                from psycopg2.extras import RealDictCursor
                with psycopg2.connect(self.db_url, connect_timeout=2) as conn:
                    with conn.cursor(cursor_factory=RealDictCursor) as cur:
                        cur.execute(sql_pg, params)
                        return [dict(r) for r in cur.fetchall()]
            except Exception as e:
                logger.warning("Postgres query failed, falling back to SQLite: %s", e)
                self._is_sqlite = True

        # SQLite query
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute(sql_sqlite, params)
                return [dict(r) for r in cur.fetchall()]
        except Exception as e:
            logger.error("SQLite query error: %s", e)
            return []

    def _query_one(self, sql_pg: str, sql_sqlite: str, params: list) -> Optional[Dict[str, Any]]:
        rows = self._query(sql_pg, sql_sqlite, params)
        return rows[0] if rows else None

    def get_fragrances(
        self,
        search: str = "",
        limit: int = 20,
        page: int = 1,
        gender: str = "",
        brand: str = "",
        sort_by: str = "popularity",
        sort_order: str = "desc",
    ) -> List[Dict[str, Any]]:
        offset = (page - 1) * limit
        conditions_pg = []
        conditions_sqlite = []
        params = []

        SEASON_KEYWORDS = {
            "summer": "summer_votes",
            "winter": "winter_votes",
            "spring": "spring_votes",
            "fall": "autumn_votes",
            "autumn": "autumn_votes",
        }

        TIME_KEYWORDS = {
            "day": "day_votes",
            "daytime": "day_votes",
            "night": "night_votes",
            "evening": "night_votes",
        }

        GENDER_KEYWORDS = {
            "men": "male",
            "man": "male",
            "male": "male",
            "women": "female",
            "woman": "female",
            "female": "female",
            "unisex": "unisex",
        }

        matched_season_col = None
        matched_time_col = None
        text_tokens = []

        if search:
            raw_tokens = [t.strip().lower() for t in search.split() if t.strip()]
            for token in raw_tokens:
                if token in SEASON_KEYWORDS and not matched_season_col:
                    matched_season_col = SEASON_KEYWORDS[token]
                elif token in TIME_KEYWORDS and not matched_time_col:
                    matched_time_col = TIME_KEYWORDS[token]
                elif token in GENDER_KEYWORDS and not gender:
                    gender = GENDER_KEYWORDS[token]
                else:
                    text_tokens.append(token)

            for token in text_tokens:
                pat = f"%{token}%"
                conditions_pg.append("((brand || ' ' || name) ILIKE %s OR accords ILIKE %s)")
                conditions_sqlite.append("((brand || ' ' || name) LIKE ? OR accords LIKE ?)")
                params.extend([pat, pat])

            if matched_season_col:
                s_col = matched_season_col
                conditions_pg.append(
                    f"(((brand || ' ' || name) ILIKE %s) OR ({s_col} > 0 AND ({s_col} * 1.0 / (winter_votes + spring_votes + summer_votes + autumn_votes + 0.001) >= 0.20)))"
                )
                conditions_sqlite.append(
                    f"(((brand || ' ' || name) LIKE ?) OR ({s_col} > 0 AND ({s_col} * 1.0 / (winter_votes + spring_votes + summer_votes + autumn_votes + 0.001) >= 0.20)))"
                )
                params.append(f"%{matched_season_col.replace('_votes', '')}%")

            if matched_time_col:
                t_col = matched_time_col
                conditions_pg.append(
                    f"(((brand || ' ' || name) ILIKE %s) OR ({t_col} > 0 AND ({t_col} * 1.0 / (day_votes + night_votes + 0.001) >= 0.35)))"
                )
                conditions_sqlite.append(
                    f"(((brand || ' ' || name) LIKE ?) OR ({t_col} > 0 AND ({t_col} * 1.0 / (day_votes + night_votes + 0.001) >= 0.35)))"
                )
                params.append(f"%{matched_time_col.replace('_votes', '')}%")

        if gender and gender.lower() in ("men", "male"):
            conditions_pg.append("gender ILIKE %s")
            conditions_sqlite.append("gender LIKE ?")
            params.append("%male%")
        elif gender and gender.lower() in ("women", "female"):
            conditions_pg.append("gender ILIKE %s")
            conditions_sqlite.append("gender LIKE ?")
            params.append("%female%")
        elif gender and gender.lower() == "unisex":
            conditions_pg.append("gender ILIKE %s")
            conditions_sqlite.append("gender LIKE ?")
            params.append("%unisex%")

        if brand:
            conditions_pg.append("brand ILIKE %s")
            conditions_sqlite.append("brand LIKE ?")
            params.append(f"%{brand}%")

        where_pg = f"WHERE {' AND '.join(conditions_pg)}" if conditions_pg else ""
        where_sqlite = f"WHERE {' AND '.join(conditions_sqlite)}" if conditions_sqlite else ""

        # Explicit sort mapping: (sort_by, sort_order) -> (pg_col, sqlite_col)
        normalized_order = sort_order.lower() if sort_order else "desc"
        order_key = (sort_by.lower() if sort_by else "popularity", normalized_order)

        EXPLICIT_SORT_MAP = {
            ("popularity", "desc"): ("vote_count DESC NULLS LAST, rating_avg DESC NULLS LAST", "vote_count DESC, rating_avg DESC"),
            ("popularity", "asc"):  ("vote_count ASC NULLS LAST, rating_avg ASC NULLS LAST", "vote_count ASC, rating_avg ASC"),
            ("rating", "desc"):     ("rating_avg DESC NULLS LAST, vote_count DESC NULLS LAST", "rating_avg DESC, vote_count DESC"),
            ("rating", "asc"):      ("rating_avg ASC NULLS LAST, vote_count ASC NULLS LAST", "rating_avg ASC, vote_count ASC"),
            ("name", "asc"):        ("name ASC", "name ASC"),
            ("name", "desc"):       ("name DESC", "name DESC"),
            ("brand", "asc"):       ("brand ASC, name ASC", "brand ASC, name ASC"),
            ("brand", "desc"):      ("brand DESC, name ASC", "brand DESC, name ASC"),
            ("year", "desc"):       ("year DESC NULLS LAST", "year DESC"),
            ("year", "asc"):        ("year ASC NULLS LAST", "year ASC"),
            ("longevity", "desc"):  ("longevity_avg DESC NULLS LAST", "longevity_avg DESC"),
            ("longevity", "asc"):   ("longevity_avg ASC NULLS LAST", "longevity_avg ASC"),
            ("sillage", "desc"):    ("sillage_avg DESC NULLS LAST", "sillage_avg DESC"),
            ("sillage", "asc"):     ("sillage_avg ASC NULLS LAST", "sillage_avg ASC"),
        }

        if matched_season_col and (not sort_by or sort_by == "popularity"):
            order_pg = f"{matched_season_col} DESC NULLS LAST, vote_count DESC NULLS LAST"
            order_sqlite = f"{matched_season_col} DESC, vote_count DESC"
        elif matched_time_col and (not sort_by or sort_by == "popularity"):
            order_pg = f"{matched_time_col} DESC NULLS LAST, vote_count DESC NULLS LAST"
            order_sqlite = f"{matched_time_col} DESC, vote_count DESC"
        else:
            order_pg, order_sqlite = EXPLICIT_SORT_MAP.get(
                order_key,
                ("vote_count DESC NULLS LAST, rating_avg DESC NULLS LAST", "vote_count DESC, rating_avg DESC")
            )

        sql_pg = f"""
            SELECT * FROM perfumes
            {where_pg}
            ORDER BY {order_pg}
            LIMIT %s OFFSET %s
        """
        sql_sqlite = f"""
            SELECT * FROM perfumes
            {where_sqlite}
            ORDER BY {order_sqlite}
            LIMIT ? OFFSET ?
        """
        all_params = params + [limit, offset]
        rows = self._query(sql_pg, sql_sqlite, all_params)
        return [_format_perfume(r) for r in rows]

    def get_fragrance_by_id(self, fragrance_id: str) -> Optional[Dict[str, Any]]:
        try:
            perfume_id = int(fragrance_id)
            sql_pg = "SELECT * FROM perfumes WHERE id = %s LIMIT 1"
            sql_sqlite = "SELECT * FROM perfumes WHERE id = ? LIMIT 1"
            params = [perfume_id]
        except (ValueError, TypeError):
            sql_pg = "SELECT * FROM perfumes WHERE slug = %s OR name ILIKE %s LIMIT 1"
            sql_sqlite = "SELECT * FROM perfumes WHERE slug = ? OR name LIKE ? LIMIT 1"
            params = [fragrance_id, fragrance_id]

        row = self._query_one(sql_pg, sql_sqlite, params)
        return _format_perfume(row) if row else None

    def match_fragrances(
        self,
        notes: str = "",
        accords: str = "",
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        conditions_pg = []
        conditions_sqlite = []
        params = []

        if notes:
            for note in notes.split(","):
                note = note.strip()
                if note:
                    conditions_pg.append(
                        "(notes_top ILIKE %s OR notes_middle ILIKE %s OR notes_base ILIKE %s OR notes_flat ILIKE %s)"
                    )
                    conditions_sqlite.append(
                        "(notes_top LIKE ? OR notes_middle LIKE ? OR notes_base LIKE ? OR notes_flat LIKE ?)"
                    )
                    pat = f"%{note}%"
                    params.extend([pat, pat, pat, pat])

        if accords:
            for accord in accords.split(","):
                accord = accord.strip()
                if accord:
                    conditions_pg.append("accords ILIKE %s")
                    conditions_sqlite.append("accords LIKE ?")
                    params.append(f"%{accord}%")

        where_pg = f"WHERE {' OR '.join(conditions_pg)}" if conditions_pg else ""
        where_sqlite = f"WHERE {' OR '.join(conditions_sqlite)}" if conditions_sqlite else ""

        sql_pg = f"SELECT * FROM perfumes {where_pg} ORDER BY vote_count DESC NULLS LAST LIMIT %s"
        sql_sqlite = f"SELECT * FROM perfumes {where_sqlite} ORDER BY vote_count DESC LIMIT ?"
        rows = self._query(sql_pg, sql_sqlite, params + [limit])
        return [_format_perfume(r) for r in rows]

    def get_similar(self, name: str, limit: int = 6) -> List[Dict[str, Any]]:
        ref = self.get_fragrance_by_id(name)
        if not ref:
            results = self.get_fragrances(search=name, limit=1)
            if results:
                ref = results[0]

        if not ref:
            return []

        main_accords = ref.get("Main Accords", [])
        params = [int(ref["_id"])]

        accord_pg = []
        accord_sqlite = []
        for accord in main_accords[:3]:
            accord_pg.append("accords ILIKE %s")
            accord_sqlite.append("accords LIKE ?")
            params.append(f"%{accord}%")

        where_pg = "WHERE id != %s"
        where_sqlite = "WHERE id != ?"

        if accord_pg:
            where_pg += f" AND ({' OR '.join(accord_pg)})"
            where_sqlite += f" AND ({' OR '.join(accord_sqlite)})"

        sql_pg = f"SELECT * FROM perfumes {where_pg} ORDER BY vote_count DESC NULLS LAST LIMIT %s"
        sql_sqlite = f"SELECT * FROM perfumes {where_sqlite} ORDER BY vote_count DESC LIMIT ?"
        rows = self._query(sql_pg, sql_sqlite, params + [limit])
        return [_format_perfume(r) for r in rows]

    def get_brand(self, brand_name: str) -> Dict[str, Any]:
        sql_pg = """
            SELECT brand, COUNT(*) as perfume_count, AVG(rating_avg) as avg_rating
            FROM perfumes WHERE brand ILIKE %s GROUP BY brand LIMIT 1
        """
        sql_sqlite = """
            SELECT brand, COUNT(*) as perfume_count, AVG(rating_avg) as avg_rating
            FROM perfumes WHERE brand LIKE ? GROUP BY brand LIMIT 1
        """
        row = self._query_one(sql_pg, sql_sqlite, [f"%{brand_name}%"])
        if row:
            return {
                "name": row["brand"],
                "perfume_count": row["perfume_count"],
                "avg_rating": round(float(row["avg_rating"] or 0), 2),
            }
        return {"name": brand_name, "perfume_count": 0, "avg_rating": 0.0}

    def get_notes(self, search: str = "") -> List[Dict[str, Any]]:
        all_notes = [
            "Bergamot", "Lavender", "Vanilla", "Patchouli", "Cedar", "Rose",
            "Jasmine", "Sandalwood", "Amber", "Musk", "Vetiver", "Tonka Bean",
            "Orange", "Cardamom", "Lemon", "Pink Pepper", "Grapefruit", "Neroli",
            "Oud", "Incense", "Cinnamon", "Iris", "Leather", "Tobacco"
        ]
        if search:
            all_notes = [n for n in all_notes if search.lower() in n.lower()]
        return [{"name": n} for n in all_notes]

    def get_accords(self, search: str = "") -> List[Dict[str, Any]]:
        all_accords = [
            "woody", "citrus", "aromatic", "warm spicy", "fresh spicy", "amber",
            "floral", "sweet", "vanilla", "earthy", "powdery", "musky", "fruity",
            "balsamic", "green", "white floral", "leather", "smoky", "fresh"
        ]
        if search:
            all_accords = [a for a in all_accords if search.lower() in a.lower()]
        return [{"name": a} for a in all_accords]
