"""TimesheetRepository — mirrors Spring Data JPA TimesheetRepository."""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from models.timesheet import Timesheet
from models.employee import Employee
from models.enums import TimesheetStatus
from repositories.base import BaseRepository


class TimesheetRepository(BaseRepository[Timesheet]):

    def __init__(self, db: Session) -> None:
        super().__init__(Timesheet, db)

    def find_by_emp_and_week(self, emp_id: str, week_start: date) -> list[Timesheet]:
        return (
            self.db.query(Timesheet)
            .filter(
                Timesheet.emp_id == emp_id,
                Timesheet.week_start_date == week_start,
            )
            .all()
        )

    def find_by_emp_paginated(
        self,
        emp_id: str,
        from_date: date,
        to_date: date,
        offset: int,
        limit: int,
    ) -> tuple[list[Timesheet], int]:
        q = (
            self.db.query(Timesheet)
            .filter(
                Timesheet.emp_id == emp_id,
                Timesheet.week_start_date >= from_date,
                Timesheet.week_start_date <= to_date,
            )
            .order_by(Timesheet.week_start_date.desc())
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def find_pending_paginated(
        self, offset: int, limit: int
    ) -> tuple[list[Timesheet], int]:
        q = (
            self.db.query(Timesheet)
            .filter(Timesheet.status == TimesheetStatus.SUBMITTED)
            .order_by(Timesheet.submitted_at.asc())
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def find_team_paginated(
        self,
        search: str | None,
        status: str | None,
        from_date: date,
        to_date: date,
        offset: int,
        limit: int,
    ) -> tuple[list[Timesheet], int]:
        q = (
            self.db.query(Timesheet)
            .join(Employee)
            .filter(
                Timesheet.status != TimesheetStatus.DRAFT,
                Timesheet.week_start_date >= from_date,
                Timesheet.week_start_date <= to_date,
            )
        )
        if search:
            term = search.lower()
            q = q.filter(
                sa_func.lower(Employee.emp_id).like(f"%{term}%")
                | sa_func.lower(Employee.name).like(f"%{term}%")
            )
        if status:
            q = q.filter(Timesheet.status == TimesheetStatus(status))
        q = q.order_by(Timesheet.week_start_date.desc(), Employee.name.asc())
        return q.offset(offset).limit(limit).all(), q.count()
