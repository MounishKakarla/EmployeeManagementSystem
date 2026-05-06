"""LeaveRequest ORM model — maps to the 'leave_requests' table."""

from sqlalchemy import (BigInteger, Column, Date, DateTime, Enum, ForeignKey,
                        Integer, String, Text, func)
from sqlalchemy.orm import relationship

from core.database import Base
from models.enums import LeaveStatus, LeaveType


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    emp_id = Column("emp_id", String(20), ForeignKey("employees.emp_id"), nullable=False)
    leave_type = Column(Enum(LeaveType, name="leave_type", create_type=False), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Integer, nullable=False)
    reason = Column(Text)
    status = Column(Enum(LeaveStatus, name="leave_status", create_type=False),
                    default=LeaveStatus.PENDING, nullable=False)
    reviewed_by = Column(String(20))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", lazy="joined")
