"""Audit, DB config, Import routers."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import require_role
from core.pagination import spring_page_response
from core.config import settings
from services import audit_service, excel_import_service

audit_router = APIRouter(prefix="/ems/audit", tags=["Audit"])
db_config_router = APIRouter(prefix="/ems", tags=["DBConfig"])
import_router = APIRouter(prefix="/ems/employees", tags=["Import"])


@audit_router.get("/logs")
def all_logs(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
             user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    items, total = audit_service.get_all_logs(db, page, size)
    return spring_page_response([audit_service.to_dto(a) for a in items], total, page, size)


@audit_router.get("/logs/search")
def search_logs(user_param: Optional[str] = Query(None, alias="user"),
                action: Optional[str] = None, target: Optional[str] = None,
                page: int = Query(0, ge=0), size: int = Query(10, ge=1),
                user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    items, total = audit_service.search_logs(db, user_param, action, target, page, size)
    return spring_page_response([audit_service.to_dto(a) for a in items], total, page, size)


@audit_router.get("/logs/user/{empId}")
def logs_by_user(empId: str, page: int = Query(0, ge=0), size: int = Query(10, ge=1),
                 user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    items, total = audit_service.get_logs_by_user(db, empId, page, size)
    return spring_page_response([audit_service.to_dto(a) for a in items], total, page, size)


@db_config_router.get("/db-config")
def db_config(user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    return {
        "host": settings.db_host, "port": settings.db_port,
        "database": settings.db_name, "username": settings.db_user,
        "password": settings.db_password,
    }


@import_router.post("/import")
async def import_excel(file: UploadFile = File(...),
                       user: dict = Depends(require_role("ADMIN")),
                       db: Session = Depends(get_db)):
    content = await file.read()
    return excel_import_service.import_employees(db, content, user["emp_id"])
