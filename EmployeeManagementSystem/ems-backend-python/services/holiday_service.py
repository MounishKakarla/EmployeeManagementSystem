"""Holiday service — mirrors HolidayCalendarServiceImpl.java."""

from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import extract

from core.exceptions import EntityNotFoundException
from models.holiday_calendar import HolidayCalendar
from services import leave_service


def _to_dto(h: HolidayCalendar) -> dict:
    return {
        "id": h.id, "holidayDate": h.holiday_date.isoformat(),
        "name": h.name, "description": h.description,
        "isMandatory": h.is_mandatory, "createdBy": h.created_by,
        "createdAt": h.created_at.isoformat() if h.created_at else None,
    }


def add_holiday(db: Session, dto: dict, added_by: str) -> dict:
    if db.query(HolidayCalendar).filter(HolidayCalendar.holiday_date == dto["holidayDate"]).first():
        raise ValueError(f"A holiday already exists on {dto['holidayDate']}")
    h = HolidayCalendar(
        holiday_date=dto["holidayDate"], name=dto["name"],
        description=dto.get("description"),
        is_mandatory=dto.get("isMandatory", True), created_by=added_by,
    )
    db.add(h)
    db.flush()
    result = _to_dto(h)
    leave_service.recalculate_affected_leaves(db, dto["holidayDate"])
    db.commit()
    return result


def update_holiday(db: Session, holiday_id: int, dto: dict, updated_by: str) -> dict:
    h = db.query(HolidayCalendar).filter(HolidayCalendar.id == holiday_id).first()
    if not h:
        raise EntityNotFoundException(f"Holiday not found: {holiday_id}")
    if dto.get("name") is not None: h.name = dto["name"]
    if dto.get("description") is not None: h.description = dto["description"]
    if dto.get("isMandatory") is not None: h.is_mandatory = dto["isMandatory"]
    db.commit()
    return _to_dto(h)


def delete_holiday(db: Session, holiday_id: int) -> None:
    h = db.query(HolidayCalendar).filter(HolidayCalendar.id == holiday_id).first()
    if not h:
        raise EntityNotFoundException(f"Holiday not found: {holiday_id}")
    db.delete(h)
    db.commit()


def get_holidays_by_year(db: Session, year: int) -> list[dict]:
    items = db.query(HolidayCalendar).filter(
        extract("year", HolidayCalendar.holiday_date) == year
    ).order_by(HolidayCalendar.holiday_date.asc()).all()
    return [_to_dto(h) for h in items]


def is_holiday_or_weekend(db: Session, dt: date) -> bool:
    if dt.weekday() >= 5:
        return True
    return db.query(HolidayCalendar).filter(HolidayCalendar.holiday_date == dt).first() is not None


def get_non_working_dates(db: Session, start: date, end: date) -> list[str]:
    public_holidays = {h.holiday_date for h in db.query(HolidayCalendar).filter(
        HolidayCalendar.holiday_date >= start, HolidayCalendar.holiday_date <= end
    ).all()}
    result = []
    cur = start
    while cur <= end:
        if cur.weekday() >= 5 or cur in public_holidays:
            result.append(cur.isoformat())
        cur += timedelta(days=1)
    return result


def delete_all_by_year(db: Session, year: int) -> int:
    count = db.query(HolidayCalendar).filter(
        extract("year", HolidayCalendar.holiday_date) == year
    ).delete(synchronize_session="fetch")
    db.commit()
    return count
