"""AttendanceRepository — mirrors Spring Data JPA AttendanceRepository."""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, extract

from models.attendance import Attendance
from models.employee import Employee
from models.enums import AttendanceStatus
from repositories.base import BaseRepository


class AttendanceRepository(BaseRepository[Attendance]):

    def __init__(self, db: Session) -> None:
        super().__init__(Attendance, db)

    # ── Single-record lookups ─────────────────────────────────────────────────

    def find_by_emp_and_date(self, emp_id: str, dt: date) -> Attendance | None:
        """findByEmployeeEmpIdAndAttendanceDate"""
        return self.db.query(Attendance).filter(
            Attendance.emp_id == emp_id,
            Attendance.attendance_date == dt,
        ).first()

    # ── Paginated / range queries ─────────────────────────────────────────────

    def find_by_emp_paginated(
        self, emp_id: str, offset: int, limit: int
    ) -> tuple[list[Attendance], int]:
        """findByEmployeeEmpIdOrderByAttendanceDateDesc"""
        q = (
            self.db.query(Attendance)
            .filter(Attendance.emp_id == emp_id)
            .order_by(Attendance.attendance_date.desc())
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def find_by_emp_range(self, emp_id: str, start: date, end: date) -> list[Attendance]:
        """findByEmployeeEmpIdAndAttendanceDateBetweenOrderByAttendanceDateAsc"""
        return (
            self.db.query(Attendance)
            .filter(
                Attendance.emp_id == emp_id,
                Attendance.attendance_date >= start,
                Attendance.attendance_date <= end,
            )
            .order_by(Attendance.attendance_date.asc())
            .all()
        )

    # ── Aggregate queries (used for monthly summaries) ────────────────────────

    def count_by_status_month_year(
        self, emp_id: str, status: AttendanceStatus, month: int, year: int
    ) -> int:
        """countByEmpIdAndMonthAndYearAndStatus"""
        return (
            self.db.query(Attendance)
            .filter(
                Attendance.emp_id == emp_id,
                extract("month", Attendance.attendance_date) == month,
                extract("year", Attendance.attendance_date) == year,
                Attendance.status == status,
            )
            .count()
        )

    def sum_hours_month_year(self, emp_id: str, month: int, year: int) -> float:
        """sumHoursByEmpIdAndMonthAndYear"""
        result = (
            self.db.query(sa_func.coalesce(sa_func.sum(Attendance.total_hours), 0.0))
            .filter(
                Attendance.emp_id == emp_id,
                extract("month", Attendance.attendance_date) == month,
                extract("year", Attendance.attendance_date) == year,
            )
            .scalar()
        )
        return float(result) if result else 0.0

    # ── Admin / team queries ──────────────────────────────────────────────────

    def find_team_paginated(
        self,
        start: date,
        end: date,
        emp_id: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[Attendance], int]:
        """findTeamAttendance"""
        q = (
            self.db.query(Attendance)
            .join(Employee)
            .filter(
                Attendance.attendance_date >= start,
                Attendance.attendance_date <= end,
            )
        )
        if emp_id:
            q = q.filter(Employee.emp_id == emp_id)
        q = q.order_by(Attendance.attendance_date.desc(), Employee.name.asc())
        return q.offset(offset).limit(limit).all(), q.count()

    def find_daily(self, dt: date, department: str | None) -> list[Attendance]:
        """findAllByDateWithEmployee / findByDateAndDepartment"""
        q = (
            self.db.query(Attendance)
            .join(Employee)
            .filter(Attendance.attendance_date == dt)
        )
        if department and department.strip():
            q = q.filter(
                sa_func.upper(Employee.department).like(f"%{department.strip().upper()}%")
            )
        return q.order_by(Employee.name.asc()).all()
