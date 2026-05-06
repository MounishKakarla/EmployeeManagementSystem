"""Chatbot router — merged from ems-chatbot/routers/chatbot.py with adjusted imports."""

from __future__ import annotations
import os, traceback
from typing import Any, Optional
import pandas as pd
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine

from chatbot.db_utils import (AUTO_FIELDS, SENSITIVE_KEYWORDS, get_next_id,
                               get_primary_key_column, get_record_by_id,
                               get_schema_preview, run_query)
from chatbot.llm_utils import detect_chart_intent, detect_crud_intent, get_sql_query_from_nl

load_dotenv()
router = APIRouter()

class DBConfig(BaseModel):
    db_type: str = "postgres"; host: str = "localhost"; port: int = 5432
    database: str; user: str; password: str

def _default_db() -> DBConfig:
    return DBConfig(db_type=os.getenv("DB_TYPE","postgres"), host=os.getenv("DB_HOST","localhost"),
                    port=int(os.getenv("DB_PORT","5432")), database=os.getenv("DB_NAME","EMSNew"),
                    user=os.getenv("DB_USER","postgres"), password=os.getenv("DB_PASSWORD","1234"))

class ConnectRequest(BaseModel): db: Optional[DBConfig] = None
class QueryRequest(BaseModel): question: str; db: Optional[DBConfig] = None
class AddRequest(BaseModel): table: str; data: dict[str, Any]; db: Optional[DBConfig] = None
class UpdateRequest(BaseModel): table: str; pk_col: str; pk_value: Any; data: dict[str, Any]; db: Optional[DBConfig] = None
class DeleteRequest(BaseModel): table: str; pk_col: str; pk_value: Any; db: Optional[DBConfig] = None
class RecordRequest(BaseModel): table: str; pk_col: str; pk_value: Any; db: Optional[DBConfig] = None
class NextIdRequest(BaseModel): table: str; id_col: str; db: Optional[DBConfig] = None
class PKRequest(BaseModel): table: str; db: Optional[DBConfig] = None

def _engine(cfg=None):
    db = cfg or _default_db()
    url = f"postgresql+psycopg2://{db.user}:{db.password}@{db.host}:{db.port}/{db.database}" if db.db_type == "postgres" else f"mysql+pymysql://{db.user}:{db.password}@{db.host}:{db.port}/{db.database}" if db.db_type == "mysql" else f"sqlite:///{db.database}"
    return create_engine(url)

def _resolve_db(cfg): return cfg or _default_db()
def _safe_schema(schema): return {t: [{"name":c["name"],"type":c["type"],"nullable":c["nullable"],"sensitive":c.get("sensitive",False)} for c in cols] for t,cols in schema.items()}

@router.post("/connect")
def connect(req: ConnectRequest):
    try:
        db = _resolve_db(req.db); engine = _engine(db)
        with engine.connect(): pass
        return {"connected":True,"db_type":db.db_type,"database":db.database,"schema":_safe_schema(get_schema_preview(engine))}
    except Exception as exc: raise HTTPException(400, f"Connection failed: {exc}")

@router.post("/query")
def nl_query(req: QueryRequest):
    try:
        crud = detect_crud_intent(req.question)
        if crud:
            labels = {"add":{"employee":"Add Employee","leave":"Apply Leave","attendance":"Mark Attendance","timesheet":"Add Timesheet","user":"Add User","role":"Add Role","holiday":"Add Holiday"},"update":{"employee":"Edit Employee","leave":"Edit Leave","attendance":"Edit Attendance","timesheet":"Edit Timesheet"},"delete":{"employee":"Delete Employee","leave":"Cancel Leave","attendance":"Delete Attendance","timesheet":"Delete Timesheet"}}
            label = labels.get(crud["action"],{}).get(crud["entity"],f"{crud['action']} {crud['entity']}")
            return {"sql":None,"columns":[],"rows":[],"row_count":0,"chart_type":None,"message":f"Opening the {label} form for you.","action":crud["action"],"entity":crud["entity"],"label":label}
        db = _resolve_db(req.db); engine = _engine(db); schema = get_schema_preview(engine)
        chart_meta = detect_chart_intent(req.question)
        sql_q = chart_meta["sql_prompt"] if chart_meta else req.question
        sql = get_sql_query_from_nl(sql_q, schema, db.db_type)
        if not sql: raise HTTPException(422, "Could not generate a valid SQL query.")
        result = run_query(engine, sql)
        if isinstance(result, pd.DataFrame):
            return {"sql":sql,"columns":list(result.columns),"rows":result.to_dict(orient="records"),"row_count":len(result),"chart_type":chart_meta["chart_type"] if chart_meta else None,"message":None,"action":None,"entity":None,"label":None}
        return {"sql":sql,"columns":[],"rows":[],"row_count":0,"chart_type":None,"message":result,"action":None,"entity":None,"label":None}
    except HTTPException: raise
    except Exception as exc: traceback.print_exc(); raise HTTPException(500, str(exc))

@router.post("/schema")
def get_schema(req: ConnectRequest):
    try: return _safe_schema(get_schema_preview(_engine(req.db)))
    except Exception as exc: raise HTTPException(500, str(exc))

@router.post("/add")
def add_record(req: AddRequest):
    try:
        engine = _engine(req.db)
        safe_data = {k:v for k,v in req.data.items() if not any(kw in k.lower() for kw in SENSITIVE_KEYWORDS) or k.lower() in ["password"]}
        if not safe_data: raise HTTPException(400, "No valid fields.")
        cols = ", ".join(safe_data.keys()); params = ", ".join([f":{k}" for k in safe_data.keys()])
        result = run_query(engine, f"INSERT INTO {req.table} ({cols}) VALUES ({params})", params=safe_data)
        if "❌" in result: raise HTTPException(400, result)
        return {"success":True,"message":result,"table":req.table}
    except HTTPException: raise
    except Exception as exc: raise HTTPException(500, str(exc))

@router.put("/update")
def update_record(req: UpdateRequest):
    try:
        engine = _engine(req.db)
        readonly = set(AUTO_FIELDS) | {req.pk_col.lower()}
        data = {k:v for k,v in req.data.items() if k.lower() not in readonly}
        if not data: raise HTTPException(400, "No updatable fields.")
        set_c = ", ".join([f"{k} = :{k}" for k in data.keys()]); data["__pk__"] = req.pk_value
        result = run_query(engine, f"UPDATE {req.table} SET {set_c} WHERE {req.pk_col} = :__pk__", params=data)
        if "❌" in result: raise HTTPException(400, result)
        return {"success":True,"message":result,"table":req.table,"pk":req.pk_value}
    except HTTPException: raise
    except Exception as exc: raise HTTPException(500, str(exc))

@router.delete("/delete")
def delete_record(req: DeleteRequest):
    try:
        engine = _engine(req.db)
        result = run_query(engine, f"DELETE FROM {req.table} WHERE {req.pk_col} = :pk", params={"pk":req.pk_value})
        if "❌" in result: raise HTTPException(400, result)
        return {"success":True,"message":result,"table":req.table,"pk":req.pk_value}
    except HTTPException: raise
    except Exception as exc: raise HTTPException(500, str(exc))

@router.post("/record")
def get_record(req: RecordRequest):
    try:
        record, err = get_record_by_id(_engine(req.db), req.table, req.pk_col, req.pk_value)
        if err: raise HTTPException(500, err)
        if not record: raise HTTPException(404, f"No record found where {req.pk_col} = '{req.pk_value}'")
        safe = {k:v for k,v in record.items() if not any(kw in k.lower() for kw in SENSITIVE_KEYWORDS)}
        return {"record":safe,"table":req.table,"pk_col":req.pk_col}
    except HTTPException: raise
    except Exception as exc: raise HTTPException(500, str(exc))

@router.post("/next-id")
def next_id(req: NextIdRequest):
    try: return {"next_id":get_next_id(_engine(req.db), req.table, req.id_col),"table":req.table,"id_col":req.id_col}
    except Exception as exc: raise HTTPException(500, str(exc))

@router.post("/pk")
def get_pk(req: PKRequest):
    try:
        pk = get_primary_key_column(_engine(req.db), req.table)
        if not pk: raise HTTPException(404, f"No PK found for table '{req.table}'")
        return {"table":req.table,"pk_col":pk}
    except HTTPException: raise
    except Exception as exc: raise HTTPException(500, str(exc))
