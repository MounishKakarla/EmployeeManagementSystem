"""Leave router — mirrors LeaveController.java."""

from typing import Optional
from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_role
from core.pagination import spring_page_response
from schemas.leave import LeaveRequestCreate, LeaveGrantRequest
from services import leave_service

router = APIRouter(prefix="/ems/leaves", tags=["Leave"])


@router.post("")
@router.post("/")
def submit(dto: LeaveRequestCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return leave_service.submit_leave(db, user["emp_id"], dto.model_dump())


@router.delete("/{id}")
def cancel(id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return leave_service.cancel_leave(db, user["emp_id"], id)


@router.get("/my")
def my_leaves(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
              user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    items, total = leave_service.get_my_leaves(db, user["emp_id"], page, size)
    return spring_page_response(items, total, page, size)


@router.get("/balance")
def my_balance(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return leave_service.get_balance(db, user["emp_id"])


@router.get("/pending")
def pending(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
            user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    items, total = leave_service.get_pending_leaves(db, user["emp_id"], page, size)
    return spring_page_response(items, total, page, size)


@router.get("/all")
def all_leaves(empId: Optional[str] = None, status: Optional[str] = None,
               page: int = Query(0, ge=0), size: int = Query(10, ge=1),
               user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    items, total = leave_service.get_all_leaves(db, empId, status, page, size)
    return spring_page_response(items, total, page, size)


@router.put("/{id}/review")
def review(id: int,
           action: str = Query(...),
           body: dict | None = Body(None),
           user: dict = Depends(require_role("ADMIN", "MANAGER")),
           db: Session = Depends(get_db)):
    notes = body.get("reviewNotes") if body else None
    return leave_service.review_leave(db, id, action, user["emp_id"], notes)


@router.get("/balance/{empId}")
def emp_balance(empId: str, user: dict = Depends(require_role("ADMIN", "MANAGER")),
                db: Session = Depends(get_db)):
    return leave_service.get_balance(db, empId)


@router.post("/grant/{empId}")
def grant(empId: str, dto: LeaveGrantRequest, user: dict = Depends(require_role("ADMIN")),
          db: Session = Depends(get_db)):
    return leave_service.grant_leave(db, user["emp_id"], empId, dto.model_dump())
