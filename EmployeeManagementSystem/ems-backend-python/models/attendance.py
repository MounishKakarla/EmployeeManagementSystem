"""Attendance ORM model — maps to the 'attendance' table."""

from datetime import date, time
from decimal import Decimal

from sqlalchemy import (BigInteger, Column, Date, DateTime, Enum, ForeignKey,
                        Numeric, String, Text, Time, func)
from sqlalchemy.orm import relationship

from core.database import Base
from models.enums import AttendanceStatus


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    emp_id = Column("emp_id", String(20), ForeignKey("employees.emp_id"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    check_in_time = Column(Time)
    check_out_time = Column(Time)
    total_hours = Column(Numeric(5, 2))
    status = Column(Enum(AttendanceStatus, name="attendance_status", create_type=False),
                    default=AttendanceStatus.PRESENT)
    notes = Column(Text)
    recorded_by = Column(String(20))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", lazy="joined")

    @staticmethod
    def compute_total_hours(check_in: time | None, check_out: time | None) -> float | None:
        """Compute total hours — handles overnight shifts (checkout < checkin)."""
        if check_in is None or check_out is None:
            return None
        from datetime import datetime, timedelta
        dt_in = datetime.combine(date.today(), check_in)
        dt_out = datetime.combine(date.today(), check_out)
        diff = dt_out - dt_in
        if diff.total_seconds() <= 0:
            diff += timedelta(hours=24)
        return round(diff.total_seconds() / 3600.0, 2)
