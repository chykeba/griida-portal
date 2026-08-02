#!/usr/bin/env python3
"""
Execute every migration against an in-memory SQLite database.

Stronger than parsing: it proves the DDL actually runs, that constraints and
triggers are valid, and it costs nothing. Catches problems before they reach
D1, where a half-applied migration has to be unpicked by hand.
"""
import pathlib
import sqlite3
import sys

migrations = sorted(pathlib.Path("db/migrations").glob("*.sql"))
if not migrations:
    print("· No migrations found")
    sys.exit(0)

failed = False
con = sqlite3.connect(":memory:")
for path in migrations:
    try:
        con.executescript(path.read_text())
        tables = con.execute(
            "select count(*) from sqlite_master "
            "where type='table' and name not like 'sqlite_%'"
        ).fetchone()[0]
        triggers = con.execute(
            "select count(*) from sqlite_master where type='trigger'"
        ).fetchone()[0]
        print(f"✓ {path.name} — {tables} tables, {triggers} triggers")
    except sqlite3.Error as err:
        failed = True
        print(f"✗ {path.name} — {err}")

sys.exit(1 if failed else 0)
