#!/usr/bin/env python3
"""
Parse every migration against the real PostgreSQL grammar.

Catches syntax errors before `supabase db push` does, which matters because a
migration that fails halfway leaves the database in a state you have to unpick
by hand.

Needs `pip3 install pglast`. Skips (exit 0) with a note if it isn't installed —
a missing optional dev tool shouldn't fail anyone's build.
"""
import pathlib
import sys

try:
    import pglast
except ImportError:
    print("· SQL check skipped — `pip3 install pglast` to enable it")
    sys.exit(0)

migrations = sorted(pathlib.Path("supabase/migrations").glob("*.sql"))
if not migrations:
    print("· No migrations found")
    sys.exit(0)

failed = False
for path in migrations:
    sql = path.read_text()
    try:
        statements = pglast.parse_sql(sql)
        print(f"✓ {path.name} — {len(statements)} statements")
    except pglast.parser.ParseError as err:
        failed = True
        print(f"✗ {path.name} — {err}")
        location = getattr(err, "location", None)
        if location:
            start = max(0, location - 150)
            print(f"   near: …{sql[start:location + 150]}…")

sys.exit(1 if failed else 0)
