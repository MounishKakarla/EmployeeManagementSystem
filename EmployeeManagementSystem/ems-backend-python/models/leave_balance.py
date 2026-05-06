"""LeaveBalance ORM model — maps to the 'leave_balances' table."""

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from core.database import Base


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    emp_id = Column("emp_id", String(20), ForeignKey("employees.emp_id"), nullable=False)
    year = Column(Integer, nullable=False)

    # Annual / Earned
    annual_total = Column(Integer, default=0)
    annual_used = Column(Integer, default=0)
    annual_carried_forward = Column(Integer, default=0)

    # Sick
    sick_total = Column(Integer, default=0)
    sick_used = Column(Integer, default=0)

    # Casual
    casual_total = Column(Integer, default=0)
    casual_used = Column(Integer, default=0)

    # Sick / Casual combined
    sick_casual_total = Column(Integer, default=0)
    sick_casual_used = Column(Integer, default=0)

    # Maternity
    maternity_total = Column(Integer, default=0)
    maternity_used = Column(Integer, default=0)

    # Paternity
    paternity_total = Column(Integer, default=0)
    paternity_used = Column(Integer, default=0)

    # Comp-off
    comp_off_earned = Column(Integer, default=0)
    comp_off_used = Column(Integer, default=0)

    # Unpaid
    unpaid_used = Column(Integer, default=0)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", lazy="joined")

    # ── Computed remaining properties ────────────────────────────────────────
    @property
    def remaining_annual(self) -> int:
        return max(0, (self.annual_total or 0) - (self.annual_used or 0))

    @property
    def remaining_sick(self) -> int:
        return max(0, (self.sick_total or 0) - (self.sick_used or 0))

    @property
    def remaining_casual(self) -> int:
        return max(0, (self.casual_total or 0) - (self.casual_used or 0))

    @property
    def remaining_sick_casual(self) -> int:
        return max(0, (self.sick_casual_total or 0) - (self.sick_casual_used or 0))

    @property
    def remaining_maternity(self) -> int:
        return max(0, (self.maternity_total or 0) - (self.maternity_used or 0))

    @property
    def remaining_paternity(self) -> int:
        return max(0, (self.paternity_total or 0) - (self.paternity_used or 0))

    @property
    def remaining_comp_off(self) -> int:
        return max(0, (self.comp_off_earned or 0) - (self.comp_off_used or 0))
