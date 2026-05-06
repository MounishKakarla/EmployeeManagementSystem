"""Timesheet ORM model — maps to the 'timesheets' table."""

from decimal import Decimal

from sqlalchemy import (BigInteger, Column, Date, DateTime, Enum, ForeignKey,
                        Numeric, String, Text, Time, func)
from sqlalchemy.orm import relationship

from core.database import Base
from models.enums import TimesheetStatus


class Timesheet(Base):
    __tablename__ = "timesheets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    emp_id = Column("emp_id", String(20), ForeignKey("employees.emp_id"), nullable=False)
    week_start_date = Column(Date, nullable=False)
    project = Column(String(200))
    task_description = Column(Text)
    start_time = Column(Time)
    end_time = Column(Time)

    monday_hours = Column(Numeric(5, 2), default=0)
    tuesday_hours = Column(Numeric(5, 2), default=0)
    wednesday_hours = Column(Numeric(5, 2), default=0)
    thursday_hours = Column(Numeric(5, 2), default=0)
    friday_hours = Column(Numeric(5, 2), default=0)
    saturday_hours = Column(Numeric(5, 2), default=0)
    sunday_hours = Column(Numeric(5, 2), default=0)

    total_hours = Column(Numeric(6, 2), default=0)

    status = Column(Enum(TimesheetStatus, name="timesheet_status", create_type=False),
                    default=TimesheetStatus.DRAFT, nullable=False)
    submitted_at = Column(DateTime)
    approved_by = Column(String(20))
    approved_at = Column(DateTime)
    review_notes = Column(Text)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", lazy="joined")

    def compute_total(self) -> Decimal:
        """Sum Mon–Sun hours."""
        fields = [
            self.monday_hours, self.tuesday_hours, self.wednesday_hours,
            self.thursday_hours, self.friday_hours, self.saturday_hours,
            self.sunday_hours,
        ]
        return sum((f or Decimal("0")) for f in fields)
