"""Holiday service — business logic only; all DB access via HolidayRepository."""

from datetime import date, timedelta
from sqlalchemy.orm import Session

from core.exceptions import EntityNotFoundException
from models.holiday_calendar import HolidayCalendar
from repositories.holiday_repository import HolidayRepository
from services import leave_service


def _to_dto(h: HolidayCalendar) -> dict:
    return {
        "id": h.id, "holidayDate": h.holiday_date.isoformat(),
        "name": h.name, "description": h.description,
        "isMandatory": h.is_mandatory, "createdBy": h.created_by,
        "createdAt": h.created_at.isoformat() if h.created_at else None,
    }


def add_holiday(db: Session, dto: dict, added_by: str) -> dict:
    repo = HolidayRepository(db)
    if repo.exists_on_date(dto["holidayDate"]):
        raise ValueError(f"A holiday already exists on {dto['holidayDate']}")
    h = HolidayCalendar(
        holiday_date=dto["holidayDate"], name=dto["name"],
        description=dto.get("description"),
        is_mandatory=dto.get("isMandatory", True), created_by=added_by,
    )
    repo.save(h)
    repo.flush()
    result = _to_dto(h)
    leave_service.recalculate_affected_leaves(db, dto["holidayDate"])
    repo.commit()
    return result


def update_holiday(db: Session, holiday_id: int, dto: dict, updated_by: str) -> dict:
    repo = HolidayRepository(db)
    h = repo.find_by_id(holiday_id)
    if not h:
        raise EntityNotFoundException(f"Holiday not found: {holiday_id}")
    if dto.get("name") is not None: h.name = dto["name"]
    if dto.get("description") is not None: h.description = dto["description"]
    if dto.get("isMandatory") is not None: h.is_mandatory = dto["isMandatory"]
    repo.commit()
    return _to_dto(h)


def delete_holiday(db: Session, holiday_id: int) -> None:
    repo = HolidayRepository(db)
    h = repo.find_by_id(holiday_id)
    if not h:
        raise EntityNotFoundException(f"Holiday not found: {holiday_id}")
    repo.delete(h)
    repo.commit()


def get_holidays_by_year(db: Session, year: int) -> list[dict]:
    return [_to_dto(h) for h in HolidayRepository(db).find_by_year(year)]


def is_holiday_or_weekend(db: Session, dt: date) -> bool:
    if dt.weekday() >= 5:
        return True
    return HolidayRepository(db).exists_on_date(dt)


def get_non_working_dates(db: Session, start: date, end: date) -> list[str]:
    public_holidays = HolidayRepository(db).find_dates_in_range(start, end)
    result = []
    cur = start
    while cur <= end:
        if cur.weekday() >= 5 or cur in public_holidays:
            result.append(cur.isoformat())
        cur += timedelta(days=1)
    return result


def delete_all_by_year(db: Session, year: int) -> int:
    repo = HolidayRepository(db)
    count = repo.delete_by_year(year)
    repo.commit()
    return count
