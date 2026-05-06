"""HolidayRepository — mirrors Spring Data JPA HolidayCalendarRepository."""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import extract

from models.holiday_calendar import HolidayCalendar
from repositories.base import BaseRepository


class HolidayRepository(BaseRepository[HolidayCalendar]):

    def __init__(self, db: Session) -> None:
        super().__init__(HolidayCalendar, db)

    def find_by_date(self, holiday_date: date) -> HolidayCalendar | None:
        return (
            self.db.query(HolidayCalendar)
            .filter(HolidayCalendar.holiday_date == holiday_date)
            .first()
        )

    def exists_on_date(self, dt: date) -> bool:
        return self.find_by_date(dt) is not None

    def find_by_year(self, year: int) -> list[HolidayCalendar]:
        return (
            self.db.query(HolidayCalendar)
            .filter(extract("year", HolidayCalendar.holiday_date) == year)
            .order_by(HolidayCalendar.holiday_date.asc())
            .all()
        )

    def find_dates_in_range(self, start: date, end: date) -> set[date]:
        """Returns a set of holiday dates within [start, end] — used for working-day calculations."""
        rows = (
            self.db.query(HolidayCalendar)
            .filter(
                HolidayCalendar.holiday_date >= start,
                HolidayCalendar.holiday_date <= end,
            )
            .all()
        )
        return {h.holiday_date for h in rows}

    def delete_by_year(self, year: int) -> int:
        """Bulk-delete all holidays for a given year; returns count deleted."""
        return (
            self.db.query(HolidayCalendar)
            .filter(extract("year", HolidayCalendar.holiday_date) == year)
            .delete(synchronize_session="fetch")
        )
