"""Holiday router — mirrors HolidayCalendarController.java."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_role
from schemas.holiday import HolidayCalendarDTO
from services import holiday_service

router = APIRouter(prefix="/ems/holidays", tags=["Holiday"])


@router.get("")
@router.get("/")
def list_holidays(year: int = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return holiday_service.get_holidays_by_year(db, year)


@router.post("")
@router.post("/")
def add(dto: HolidayCalendarDTO, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    return holiday_service.add_holiday(db, dto.model_dump(), user["emp_id"])


@router.put("/{id}")
def update(id: int, dto: HolidayCalendarDTO, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    return holiday_service.update_holiday(db, id, dto.model_dump(exclude_none=True), user["emp_id"])


@router.delete("/{id}")
def delete(id: int, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    holiday_service.delete_holiday(db, id)
    return {"message": "Deleted"}


@router.delete("/year/{year}")
def delete_year(year: int, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    count = holiday_service.delete_all_by_year(db, year)
    return {"deleted": count}


@router.get("/non-working")
def non_working(start: str = Query(...), end: str = Query(...),
                user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import date
    return holiday_service.get_non_working_dates(db, date.fromisoformat(start), date.fromisoformat(end))
