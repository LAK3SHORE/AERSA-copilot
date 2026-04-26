"""Apply `db/views.sql` to MariaDB and run validation queries.

Run via:
    uv run python -m scripts.bootstrap_views

The script is idempotent: views are CREATE OR REPLACE. It also asserts the
Session-1 invariants from CLAUDE.md 14:
  - inventariomesdetalle_clean has < 11,772,750 rows (something filtered)
  - corrupt row 90806848 is excluded
  - inventario_full only contains finalizado/aplicado/terminado statuses
"""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

from db.connection import engine

VIEWS_SQL = Path(__file__).resolve().parent.parent / "db" / "views.sql"
RAW_DETAIL_ROWS = 11_772_750  # documented in CLAUDE.md 3.2
CORRUPT_ROW_ID = 90_806_848


def split_statements(sql: str) -> list[str]:
    """Split on `;` while ignoring SQL line comments (`-- ...`)."""
    cleaned = "\n".join(
        line for line in sql.splitlines() if not line.lstrip().startswith("--")
    )
    return [stmt.strip() for stmt in cleaned.split(";") if stmt.strip()]


def apply_views() -> int:
    sql = VIEWS_SQL.read_text(encoding="utf-8")
    statements = split_statements(sql)
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    return len(statements)


def validate() -> dict:
    with engine.connect() as conn:
        clean_rows = conn.execute(
            text("SELECT COUNT(*) FROM inventariomesdetalle_clean")
        ).scalar_one()
        corrupt_present = conn.execute(
            text(
                "SELECT COUNT(*) FROM inventariomesdetalle_clean "
                "WHERE idinventariomesdetalle = :id"
            ),
            {"id": CORRUPT_ROW_ID},
        ).scalar_one()
        full_rows = conn.execute(
            text("SELECT COUNT(*) FROM inventario_full")
        ).scalar_one()
        bad_status = conn.execute(
            text(
                "SELECT COUNT(*) FROM inventario_full "
                "WHERE estatus NOT IN ('finalizado','aplicado','terminado')"
            )
        ).scalar_one()
        distinct_periodos = conn.execute(
            text("SELECT COUNT(DISTINCT periodo) FROM inventario_full")
        ).scalar_one()
        distinct_empresas = conn.execute(
            text("SELECT COUNT(DISTINCT idempresa) FROM inventario_full")
        ).scalar_one()

    return {
        "inventariomesdetalle_clean_rows": int(clean_rows),
        "rows_filtered_out": RAW_DETAIL_ROWS - int(clean_rows),
        "corrupt_row_present": int(corrupt_present),
        "inventario_full_rows": int(full_rows),
        "rows_with_bad_status": int(bad_status),
        "distinct_periodos": int(distinct_periodos),
        "distinct_empresas": int(distinct_empresas),
    }


def main() -> int:
    print(f"[bootstrap] applying {VIEWS_SQL.relative_to(VIEWS_SQL.parent.parent.parent)}")
    n = apply_views()
    print(f"[bootstrap] executed {n} statement(s)")

    print("[bootstrap] validating invariants ...")
    r = validate()
    for k, v in r.items():
        print(f"  {k:38s} = {v:>15,}")

    failures: list[str] = []
    if r["inventariomesdetalle_clean_rows"] >= RAW_DETAIL_ROWS:
        failures.append("clean view did not filter any rows")
    if r["corrupt_row_present"] != 0:
        failures.append("corrupt row 90806848 leaked into clean view")
    if r["rows_with_bad_status"] != 0:
        failures.append("inventario_full contains non-{finalizado,aplicado,terminado} rows")

    if failures:
        print("\n[bootstrap] FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\n[bootstrap] OK · all invariants pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
