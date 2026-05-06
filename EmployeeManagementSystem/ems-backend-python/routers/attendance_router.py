"""Attendance router — mirrors AttendanceController.java."""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_role
from core.pagination import spring_page_response
from schemas.attendance import AttendanceDTO, CheckInRequest
from services import attendance_service

router = APIRouter(prefix="/ems/attendance", tags=["Attendance"])


@router.post("/check-in")
def check_in(req: CheckInRequest = CheckInRequest(), user: dict = Depends(get_current_user),
             db: Session = Depends(get_db)):
    return attendance_service.check_in(db, user["emp_id"], req.notes)


@router.post("/check-out")
def check_out(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_service.check_out(db, user["emp_id"])


@router.get("/today")
def today(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_service.get_today_status(db, user["emp_id"])


@router.get("/my")
def my_attendance(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
                  user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    items, total = attendance_service.get_my_attendance(db, user["emp_id"], page, size)
    return spring_page_response(items, total, page, size)


@router.get("/my/range")
def my_range(start: str = Query(...), end: str = Query(...),
             user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_service.get_my_attendance_range(
        db, user["emp_id"], date.fromisoformat(start), date.fromisoformat(end))


@router.get("/my/summary")
def my_summary(month: int = Query(...), year: int = Query(...),
               user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_service.get_my_summary(db, user["emp_id"], month, year)


@router.post("/override")
def override(dto: AttendanceDTO, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_service.create_or_override(db, dto.model_dump(), user["emp_id"])


@router.put("/{id}")
def update(id: int, dto: AttendanceDTO, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_service.update_attendance(db, id, dto.model_dump(exclude_none=True), user["emp_id"])


@router.delete("/{id}")
def delete(id: int, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    attendance_service.delete_attendance(db, id)
    return {"message": "Deleted"}


@router.get("/team")
def team(start: str = Query(...), end: str = Query(...),
         empId: Optional[str] = None, page: int = Query(0, ge=0), size: int = Query(10, ge=1),
         user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    items, total = attendance_service.get_team_attendance(
        db, date.fromisoformat(start), date.fromisoformat(end), empId, page, size)
    return spring_page_response(items, total, page, size)


@router.get("/daily")
def daily(date_param: str = Query(..., alias="date"),
          department: Optional[str] = None,
          user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    return attendance_service.get_daily_attendance(db, date.fromisoformat(date_param), department)


@router.get("/summary/{empId}")
def summary(empId: str, month: int = Query(...), year: int = Query(...),
            user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    return attendance_service.get_my_summary(db, empId, month, year)
