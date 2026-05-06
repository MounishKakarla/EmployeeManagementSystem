"""Timesheet router — mirrors TimesheetController.java."""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_role
from core.pagination import spring_page_response
from schemas.timesheet import TimesheetDTO, TimesheetReviewRequest, TimesheetSubmitRequest
from services import timesheet_service

router = APIRouter(prefix="/ems/timesheets", tags=["Timesheet"])


@router.get("/current-week")
def current_week(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return timesheet_service.get_current_week(db, user["emp_id"])


@router.get("/week")
def week(weekStartDate: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return timesheet_service.get_week(db, user["emp_id"], date.fromisoformat(weekStartDate))


@router.post("/")
def save(dto: TimesheetDTO, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return timesheet_service.save_entry(db, user["emp_id"], dto.model_dump())


@router.post("/submit")
def submit(req: TimesheetSubmitRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return timesheet_service.submit_week(db, user["emp_id"], req.weekStartDate)


@router.get("/my")
def my_timesheets(from_date: Optional[str] = Query(None, alias="from"),
                  to_date: Optional[str] = Query(None, alias="to"),
                  page: int = Query(0, ge=0), size: int = Query(10, ge=1),
                  user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    f = date.fromisoformat(from_date) if from_date else None
    t = date.fromisoformat(to_date) if to_date else None
    items, total = timesheet_service.get_my_timesheets(db, user["emp_id"], f, t, page, size)
    return spring_page_response(items, total, page, size)


@router.get("/pending")
def pending(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
            user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    items, total = timesheet_service.get_pending_timesheets(db, page, size)
    return spring_page_response(items, total, page, size)


@router.get("/team")
def team(empId: Optional[str] = None, status: Optional[str] = None,
         from_date: Optional[str] = Query(None, alias="from"),
         to_date: Optional[str] = Query(None, alias="to"),
         page: int = Query(0, ge=0), size: int = Query(10, ge=1),
         user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    f = date.fromisoformat(from_date) if from_date else None
    t = date.fromisoformat(to_date) if to_date else None
    items, total = timesheet_service.get_team_timesheets(db, empId, status, f, t, page, size)
    return spring_page_response(items, total, page, size)


@router.delete("/{id}")
def delete(id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    timesheet_service.delete_entry(db, user["emp_id"], id)
    return {"message": "Deleted"}


@router.put("/{id}/review")
def review(id: int, req: TimesheetReviewRequest,
           user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    return timesheet_service.review_entry(db, id, req.action.value, user["emp_id"], req.reviewNotes)
