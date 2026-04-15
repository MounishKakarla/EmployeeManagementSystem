"""
Chatbot Router
"""

from __future__ import annotations

import os
import traceback
from typing import Any, Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine

from utils.db_utils import (
    AUTO_FIELDS,
    SENSITIVE_KEYWORDS,
    get_next_id,
    get_primary_key_column,
    get_record_by_id,
    get_schema_preview,
    run_query,
)
from utils.llm_utils import detect_chart_intent, detect_crud_intent, get_sql_query_from_nl

load_dotenv()

router = APIRouter()


# ── DB config ──────────────────────────────────────────────────────────────────

class DBConfig(BaseModel):
    db_type:  str = "postgres"
    host:     str = "localhost"
    port:     int = 5432
    database: str
    user:     str
    password: str


def _default_db() -> DBConfig:
    return DBConfig(
        db_type  = os.getenv("DB_TYPE",     "postgres"),
        host     = os.getenv("DB_HOST",     "localhost"),
        port     = int(os.getenv("DB_PORT", "5432")),
        database = os.getenv("DB_NAME",     "EMSNew"),
        user     = os.getenv("DB_USER",     "postgres"),
        password = os.getenv("DB_PASSWORD", "1234"),
    )


# ── Request models ─────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    db: Optional[DBConfig] = None

class QueryRequest(BaseModel):
    question: str
    db: Optional[DBConfig] = None

class AddRequest(BaseModel):
    table: str
    data:  dict[str, Any]
    db:    Optional[DBConfig] = None

class UpdateRequest(BaseModel):
    table:    str
    pk_col:   str
    pk_value: Any
    data:     dict[str, Any]
    db:       Optional[DBConfig] = None

class DeleteRequest(BaseModel):
    table:    str
    pk_col:   str
    pk_value: Any
    db:       Optional[DBConfig] = None

class RecordRequest(BaseModel):
    table:    str
    pk_col:   str
    pk_value: Any
    db:       Optional[DBConfig] = None

class NextIdRequest(BaseModel):
    table:  str
    id_col: str
    db:     Optional[DBConfig] = None

class PKRequest(BaseModel):
    table: str
    db:    Optional[DBConfig] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _engine(cfg: Optional[DBConfig] = None):
    db = cfg or _default_db()
    if db.db_type == "mysql":
        url = f"mysql+pymysql://{db.user}:{db.password}@{db.host}:{db.port}/{db.database}"
    elif db.db_type == "postgres":
        url = f"postgresql+psycopg2://{db.user}:{db.password}@{db.host}:{db.port}/{db.database}"
    else:
        url = f"sqlite:///{db.database}"
    print(f"[DB] Connecting → {db.db_type}://{db.host}:{db.port}/{db.database} as {db.user}")
    return create_engine(url)

def _resolve_db(cfg: Optional[DBConfig]) -> DBConfig:
    return cfg or _default_db()

def _safe_schema(schema: dict) -> dict:
    return {
        table: [
            {
                "name":      c["name"],
                "type":      c["type"],
                "nullable":  c["nullable"],
                "sensitive": c.get("sensitive", False),
            }
            for c in cols
        ]
        for table, cols in schema.items()
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/connect")
def connect(req: ConnectRequest):
    try:
        db     = _resolve_db(req.db)
        engine = _engine(db)
        with engine.connect():
            pass
        schema = get_schema_preview(engine)
        print(f"[CONNECT] ✅ Connected to {db.database}")
        return {
            "connected": True,
            "db_type":   db.db_type,
            "database":  db.database,
            "schema":    _safe_schema(schema),
        }
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Connection failed: {exc}")


@router.post("/query")
def nl_query(req: QueryRequest):
    try:
        print(f"[QUERY] Question: {req.question}")

        # ── CRUD intent — return action signal, skip SQL ──────────────────────
        crud = detect_crud_intent(req.question)
        if crud:
            print(f"[QUERY] CRUD intent detected: {crud}")
            action_labels = {
                "add":    {"employee": "Add Employee",    "leave": "Apply Leave",      "attendance": "Mark Attendance",  "timesheet": "Add Timesheet",  "user": "Add User",    "role": "Add Role",    "holiday": "Add Holiday"},
                "update": {"employee": "Edit Employee",   "leave": "Edit Leave",       "attendance": "Edit Attendance",  "timesheet": "Edit Timesheet", "user": "Edit User",   "role": "Edit Role",   "holiday": "Edit Holiday"},
                "delete": {"employee": "Delete Employee", "leave": "Cancel Leave",     "attendance": "Delete Attendance","timesheet": "Delete Timesheet","user": "Delete User","role": "Delete Role","holiday": "Delete Holiday"},
            }
            label = action_labels.get(crud["action"], {}).get(crud["entity"], f"{crud['action']} {crud['entity']}")
            return {
                "sql":        None,
                "columns":    [],
                "rows":       [],
                "row_count":  0,
                "chart_type": None,
                "message":    f"Opening the {label} form for you.",
                "action":     crud["action"],
                "entity":     crud["entity"],
                "label":      label,
            }

        # ── Normal NL → SQL query ─────────────────────────────────────────────
        db     = _resolve_db(req.db)
        engine = _engine(db)

        print("[QUERY] Fetching schema...")
        schema = get_schema_preview(engine)
        print(f"[QUERY] Schema tables: {list(schema.keys())}")

        chart_meta = detect_chart_intent(req.question)
        sql_q      = chart_meta["sql_prompt"] if chart_meta else req.question
        print(f"[QUERY] Chart meta: {chart_meta}")

        print("[QUERY] Calling Groq LLM...")
        sql = get_sql_query_from_nl(sql_q, schema, db.db_type)
        print(f"[QUERY] Generated SQL: {sql}")

        if not sql:
            raise HTTPException(status_code=422, detail="Could not generate a valid SQL query.")

        print("[QUERY] Running SQL...")
        result = run_query(engine, sql)
        print(f"[QUERY] Result type: {type(result)}")

        if isinstance(result, pd.DataFrame):
            print(f"[QUERY] ✅ Returned {len(result)} rows")
            return {
                "sql":        sql,
                "columns":    list(result.columns),
                "rows":       result.to_dict(orient="records"),
                "row_count":  len(result),
                "chart_type": chart_meta["chart_type"] if chart_meta else None,
                "message":    None,
                "action":     None,
                "entity":     None,
                "label":      None,
            }
        else:
            print(f"[QUERY] ✅ DML result: {result}")
            return {
                "sql":        sql,
                "columns":    [],
                "rows":       [],
                "row_count":  0,
                "chart_type": None,
                "message":    result,
                "action":     None,
                "entity":     None,
                "label":      None,
            }

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/schema")
def get_schema(req: ConnectRequest):
    try:
        engine = _engine(req.db)
        schema = get_schema_preview(engine)
        return _safe_schema(schema)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/add")
def add_record(req: AddRequest):
    try:
        print(f"[ADD] Table: {req.table}, Data: {req.data}")
        engine = _engine(req.db)

        safe_data = {
            k: v for k, v in req.data.items()
            if not any(kw in k.lower() for kw in SENSITIVE_KEYWORDS)
            or k.lower() in ["password"]
        }

        if not safe_data:
            raise HTTPException(status_code=400, detail="No valid fields to insert.")

        cols   = ", ".join(safe_data.keys())
        params = ", ".join([f":{k}" for k in safe_data.keys()])
        sql    = f"INSERT INTO {req.table} ({cols}) VALUES ({params})"
        print(f"[ADD] SQL: {sql}")

        result = run_query(engine, sql, params=safe_data)
        if "❌" in result:
            raise HTTPException(status_code=400, detail=result)

        print(f"[ADD] ✅ {result}")
        return {"success": True, "message": result, "table": req.table}

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/update")
def update_record(req: UpdateRequest):
    try:
        print(f"[UPDATE] Table: {req.table}, PK: {req.pk_col}={req.pk_value}")
        engine = _engine(req.db)

        readonly    = set(AUTO_FIELDS) | {req.pk_col.lower()}
        update_data = {
            k: v for k, v in req.data.items()
            if k.lower() not in readonly
        }

        if not update_data:
            raise HTTPException(status_code=400, detail="No updatable fields provided.")

        set_clause = ", ".join([f"{k} = :{k}" for k in update_data.keys()])
        update_data["__pk__"] = req.pk_value
        sql = f"UPDATE {req.table} SET {set_clause} WHERE {req.pk_col} = :__pk__"
        print(f"[UPDATE] SQL: {sql}")

        result = run_query(engine, sql, params=update_data)
        if "❌" in result:
            raise HTTPException(status_code=400, detail=result)

        print(f"[UPDATE] ✅ {result}")
        return {"success": True, "message": result, "table": req.table, "pk": req.pk_value}

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/delete")
def delete_record(req: DeleteRequest):
    try:
        print(f"[DELETE] Table: {req.table}, PK: {req.pk_col}={req.pk_value}")
        engine = _engine(req.db)
        sql    = f"DELETE FROM {req.table} WHERE {req.pk_col} = :pk"
        result = run_query(engine, sql, params={"pk": req.pk_value})
        if "❌" in result:
            raise HTTPException(status_code=400, detail=result)
        print(f"[DELETE] ✅ {result}")
        return {"success": True, "message": result, "table": req.table, "pk": req.pk_value}
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/record")
def get_record(req: RecordRequest):
    try:
        print(f"[RECORD] Table: {req.table}, PK: {req.pk_col}={req.pk_value}")
        engine = _engine(req.db)
        record, err = get_record_by_id(engine, req.table, req.pk_col, req.pk_value)
        if err:
            raise HTTPException(status_code=500, detail=err)
        if record is None:
            raise HTTPException(status_code=404, detail=f"No record found where {req.pk_col} = '{req.pk_value}'")

        safe_record = {
            k: v for k, v in record.items()
            if not any(kw in k.lower() for kw in SENSITIVE_KEYWORDS)
        }
        print(f"[RECORD] ✅ Found record with {len(safe_record)} fields")
        return {"record": safe_record, "table": req.table, "pk_col": req.pk_col}

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/next-id")
def next_id(req: NextIdRequest):
    try:
        print(f"[NEXT-ID] Table: {req.table}, ID col: {req.id_col}")
        engine    = _engine(req.db)
        suggested = get_next_id(engine, req.table, req.id_col)
        print(f"[NEXT-ID] ✅ Suggested: {suggested}")
        return {"next_id": suggested, "table": req.table, "id_col": req.id_col}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/pk")
def get_pk(req: PKRequest):
    try:
        print(f"[PK] Table: {req.table}")
        engine = _engine(req.db)
        pk     = get_primary_key_column(engine, req.table)
        if not pk:
            raise HTTPException(status_code=404, detail=f"No PK found for table '{req.table}'")
        print(f"[PK] ✅ PK = {pk}")
        return {"table": req.table, "pk_col": pk}
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))