"""
Interactive SQL Terminal for Raphragrance Database
Usage:
    cd backend
    .\\.venv\\Scripts\\python db_cli.py
"""
import os
try:
    import readline
except ImportError:
    pass
import sqlite3
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "perfumes.db"


def print_table(headers, rows):
    if not rows:
        print("(0 rows)\n")
        return

    # Calculate column widths
    str_rows = [[str(v) if v is not None else "NULL" for v in row] for row in rows]
    widths = [len(h) for h in headers]
    for row in str_rows:
        for i, val in enumerate(row):
            widths[i] = max(widths[i], min(len(val), 50))

    # Format header
    header_line = " | ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    sep_line = "-+-".join("-" * widths[i] for i in range(len(headers)))

    print(header_line)
    print(sep_line)
    for row in str_rows:
        line = " | ".join(val[:50].ljust(widths[i]) for i, val in enumerate(row))
        print(line)
    print(f"\n({len(rows)} rows)\n")


def main():
    if not DB_PATH.exists():
        print(f"Database tidak ditemukan di {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("=" * 60)
    print("  Raphragrance Database Interactive Terminal")
    print("  Database: backend/data/perfumes.db (131,930 perfumes)")
    print("  - Ketik query SQL apa saja (akhiri dengan ;)")
    print("  - Ketik '.tables' untuk melihat daftar tabel")
    print("  - Ketik '.schema' untuk melihat struktur kolom")
    print("  - Ketik 'exit' atau 'quit' untuk keluar")
    print("=" * 60)

    query_buffer = []

    while True:
        try:
            prompt = "perfumes-db> " if not query_buffer else "         ...> "
            line = input(prompt).strip()

            if not query_buffer and line.lower() in ("exit", "quit", "q", "\\q"):
                print("Bye!")
                break

            if not line:
                continue

            if not query_buffer and line == ".tables":
                cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [r[0] for r in cur.fetchall()]
                print("Tables: " + ", ".join(tables) + "\n")
                continue

            if not query_buffer and line == ".schema":
                cur.execute("PRAGMA table_info(perfumes)")
                cols = [(r[1], r[2]) for r in cur.fetchall()]
                print("Columns in 'perfumes':")
                for col_name, col_type in cols:
                    print(f"  - {col_name:20} ({col_type})")
                print()
                continue

            query_buffer.append(line)

            if line.endswith(";"):
                sql = " ".join(query_buffer)
                query_buffer = []

                try:
                    cur.execute(sql)
                    if cur.description:
                        headers = [d[0] for d in cur.description]
                        rows = cur.fetchall()
                        print_table(headers, rows)
                    else:
                        conn.commit()
                        print(f"Query OK, {cur.rowcount} rows affected.\n")
                except Exception as e:
                    print(f"SQL Error: {e}\n")

        except (KeyboardInterrupt, EOFError):
            print("\nBye!")
            break

    conn.close()


if __name__ == "__main__":
    main()
