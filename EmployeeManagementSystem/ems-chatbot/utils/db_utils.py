"""
db_utils.py — pure SQLAlchemy helpers, no Streamlit dependency
"""

import re
import pandas as pd
from sqlalchemy import create_engine, text, inspect

SENSITIVE_KEYWORDS = [
    "password", "passwd", "pwd", "secret", "token",
    "key", "hash", "salt", "otp", "pin", "ssn",
    "credit_card", "cvv", "card_number", "auth",
]

AUTO_FIELDS = [
    "created_at", "updated_at", "password_changed_at",
    "uuid", "row_version",
]


def get_engine(db_type: str, user: str, password: str,
               host: str, database: str, port: int):
    if db_type == "mysql":
        url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
    elif db_type == "postgres":
        url = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
    else:
        url = f"sqlite:///{database}"
    return create_engine(url)


def _strip_sensitive_columns(df: pd.DataFrame) -> pd.DataFrame:
    cols_to_drop = [
        c for c in df.columns
        if any(kw in c.lower() for kw in SENSITIVE_KEYWORDS)
    ]
    return df.drop(columns=cols_to_drop) if cols_to_drop else df


def run_query(engine, query: str, params: dict | None = None):
    """
    Execute a SQL query.
    Returns:
      - pd.DataFrame for SELECT / SHOW / DESC
      - str message   for DML (INSERT / UPDATE / DELETE)
    """
    try:
        dialect     = engine.dialect.name
        query_upper = query.strip().upper()

        if any(w in query_upper for w in ["DROP", "TRUNCATE"]):
            return "⚠️ Security Block: DROP and TRUNCATE are disabled."

        # Normalise boolean literals for PostgreSQL
        if dialect == "postgresql":
            query = re.sub(r"=\s*1\b", "= TRUE",  query)
            query = re.sub(r"=\s*0\b", "= FALSE", query)

        with engine.connect() as conn:
            if any(query_upper.startswith(w) for w in ["SELECT", "SHOW", "DESC"]):
                df = pd.read_sql(text(query), conn, params=params or {})
                df = _strip_sensitive_columns(df)
                if not df.empty:
                    df.index = range(1, len(df) + 1)
                return df
            else:
                with conn.begin():
                    result = conn.execute(text(query), params or {})
                try:
                    affected = result.rowcount
                    return (
                        f"✅ Success. Rows affected: {affected}"
                        if affected != -1
                        else "✅ Operation completed."
                    )
                except Exception:
                    return "✅ Operation completed."

    except Exception as exc:
        return f"❌ SQL Error: {exc}"


def get_record_by_id(engine, table_name: str, id_column: str, id_value):
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(f"SELECT * FROM {table_name} WHERE CAST({id_column} AS TEXT) = :id"),
                {"id": str(id_value)},
            ).fetchone()
            return (dict(result._mapping), None) if result else (None, None)
    except Exception as exc:
        return None, str(exc)


def get_primary_key_column(engine, table_name: str) -> str | None:
    try:
        inspector = inspect(engine)
        pk_cols   = inspector.get_pk_constraint(table_name).get("constrained_columns", [])
        return pk_cols[0] if pk_cols else None
    except Exception:
        return None


def get_schema_preview(engine) -> dict:
    inspector = inspect(engine)
    schema    = {}
    for table_name in inspector.get_table_names():
        cols = []
        for col in inspector.get_columns(table_name):
            cols.append({
                "name":      col["name"],
                "nullable":  col.get("nullable", True),
                "type":      str(col["type"]),
                "sensitive": any(kw in col["name"].lower() for kw in SENSITIVE_KEYWORDS),
            })
        schema[table_name] = cols
    return schema


def get_next_id(engine, table_name: str, id_column: str) -> str:
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(f"SELECT {id_column} FROM {table_name} ORDER BY {id_column} DESC LIMIT 1")
            ).fetchone()
            if not result:
                return "1"
            last_id = str(result[0])
            match   = re.search(r"([a-zA-Z]+)(\d+)", last_id)
            if match:
                prefix  = match.group(1)
                num_str = match.group(2)
                return f"{prefix}{str(int(num_str) + 1).zfill(len(num_str))}"
            return str(int(last_id) + 1) if last_id.isdigit() else ""
    except Exception:
        return ""