"""LeaveRequestRepository + LeaveBalanceRepository."""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from models.leave_request import LeaveRequest
from models.leave_balance import LeaveBalance
from models.employee import Employee
from models.enums import LeaveStatus
from repositories.base import BaseRepository


class LeaveRequestRepository(BaseRepository[LeaveRequest]):

    def __init__(self, db: Session) -> None:
        super().__init__(LeaveRequest, db)

    def find_by_emp_paginated(
        self, emp_id: str, offset: int, limit: int
    ) -> tuple[list[LeaveRequest], int]:
        q = (
            self.db.query(LeaveRequest)
            .filter(LeaveRequest.emp_id == emp_id)
            .order_by(LeaveRequest.created_at.desc())
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def find_pending_admin(
        self, offset: int, limit: int
    ) -> tuple[list[LeaveRequest], int]:
        q = (
            self.db.query(LeaveRequest)
            .filter(LeaveRequest.status == LeaveStatus.PENDING)
            .order_by(LeaveRequest.created_at.asc())
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def find_pending_for_dept(
        self, dept: str, offset: int, limit: int
    ) -> tuple[list[LeaveRequest], int]:
        q = (
            self.db.query(LeaveRequest)
            .join(Employee)
            .filter(
                LeaveRequest.status == LeaveStatus.PENDING,
                sa_func.upper(Employee.department) == dept.upper(),
            )
            .order_by(LeaveRequest.created_at.asc())
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def find_all_filtered(
        self,
        emp_id: str | None,
        status: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[LeaveRequest], int]:
        q = self.db.query(LeaveRequest)
        if emp_id:
            q = q.filter(LeaveRequest.emp_id == emp_id)
        if status:
            q = q.filter(LeaveRequest.status == LeaveStatus(status))
        q = q.order_by(LeaveRequest.created_at.desc())
        return q.offset(offset).limit(limit).all(), q.count()

    def count_overlapping(self, emp_id: str, start: date, end: date) -> int:
        """Count PENDING or APPROVED requests that overlap the given date range."""
        return (
            self.db.query(LeaveRequest)
            .filter(
                LeaveRequest.emp_id == emp_id,
                LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
                LeaveRequest.start_date <= end,
                LeaveRequest.end_date >= start,
            )
            .count()
        )

    def count_approved_conflicts(
        self, emp_id: str, start: date, end: date, exclude_id: int | None = None
    ) -> int:
        """Count APPROVED requests that overlap, optionally excluding one id."""
        q = self.db.query(LeaveRequest).filter(
            LeaveRequest.emp_id == emp_id,
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
        if exclude_id is not None:
            q = q.filter(LeaveRequest.id != exclude_id)
        return q.count()

    def find_pending_overlapping(
        self, emp_id: str, start: date, end: date
    ) -> list[LeaveRequest]:
        """All PENDING requests for an employee overlapping the given range."""
        return (
            self.db.query(LeaveRequest)
            .filter(
                LeaveRequest.emp_id == emp_id,
                LeaveRequest.status == LeaveStatus.PENDING,
                LeaveRequest.start_date <= end,
                LeaveRequest.end_date >= start,
            )
            .all()
        )

    def find_approved_covering_date(self, holiday_date: date) -> list[LeaveRequest]:
        """All APPROVED requests whose range covers a specific date (used when adding holidays)."""
        return (
            self.db.query(LeaveRequest)
            .filter(
                LeaveRequest.status == LeaveStatus.APPROVED,
                LeaveRequest.start_date <= holiday_date,
                LeaveRequest.end_date >= holiday_date,
            )
            .all()
        )

    def find_approved_in_range(self, emp_id: str, start: date, end: date) -> list[LeaveRequest]:
        """APPROVED leaves for an employee overlapping [start, end] — used by timesheet validation."""
        return (
            self.db.query(LeaveRequest)
            .filter(
                LeaveRequest.emp_id == emp_id,
                LeaveRequest.status == LeaveStatus.APPROVED,
                LeaveRequest.start_date <= end,
                LeaveRequest.end_date >= start,
            )
            .all()
        )


class LeaveBalanceRepository(BaseRepository[LeaveBalance]):

    def __init__(self, db: Session) -> None:
        super().__init__(LeaveBalance, db)

    def find_by_emp_year(self, emp_id: str, year: int) -> LeaveBalance | None:
        return (
            self.db.query(LeaveBalance)
            .filter(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year)
            .first()
        )
